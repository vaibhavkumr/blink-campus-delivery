'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { db, id, config } = require('./db');
const { CAMPUSES, MODIFIERS, GEOFENCE, BUNDLES } = require('./seed-data');

// ── Geofencing ───────────────────────────────────────────────────────
// Ray-casting point-in-polygon against a campus delivery zone. Polygon is
// [lng, lat] pairs. Returns true when the drop-off is inside the zone.
function insideZone(campusId, lat, lng) {
  const poly = GEOFENCE[campusId];
  if (!poly) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function campusById(campusId) {
  return CAMPUSES.find((c) => c.id === campusId) || CAMPUSES[0];
}

function buildingCoord(campusId, name) {
  const c = campusById(campusId);
  const b = c.buildings.find((x) => x.name === name);
  return b ? { lat: b.lat, lng: b.lng } : c.center;
}

// ── Fastest route (real driving directions via OSRM, no API key) ─────
// Returns the route geometry ([lng,lat] pairs), duration (min), distance (km).
// Falls back to a straight line + haversine estimate if OSRM is unreachable.
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

async function fastestRoute(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    const r = data.routes && data.routes[0];
    if (r) {
      return {
        coordinates: r.geometry.coordinates,
        durationMin: Math.max(1, Math.round(r.duration / 60)),
        distanceKm: Math.round((r.distance / 1000) * 10) / 10,
        source: 'osrm',
      };
    }
  } catch {
    // fall through to estimate
  }
  const km = haversineKm(from, to);
  return {
    coordinates: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
    durationMin: Math.max(1, Math.round((km / 18) * 60)), // ~18 km/h courier avg
    distanceKm: Math.round(km * 10) / 10,
    source: 'estimate',
  };
}

const RECEIPTS_DIR = path.join(__dirname, 'public', 'receipts');
try {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
} catch {
  // directory already exists
}

const STEPS = ['PLACED', 'ACCEPTED', 'PICKING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const STATUS_COL = {
  ACCEPTED: 'accepted_at',
  PICKING: 'picking_at',
  OUT_FOR_DELIVERY: 'out_at',
  DELIVERED: 'delivered_at',
};

const dollars = (cents) => Math.round(cents) / 100;

// ── Catalog ──────────────────────────────────────────────────────────
function getCatalog() {
  const categories = db
    .prepare('SELECT key, emoji FROM categories ORDER BY sort')
    .all();
  const products = db
    .prepare('SELECT id, name, emoji, image_url, price_cents, category, vendor_id, in_stock FROM products ORDER BY sort')
    .all()
    .map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      image: p.image_url || null,
      // Transparent pricing: base price + flat platform markup (UNL spec).
      basePrice: dollars(p.price_cents),
      price: dollars(p.price_cents + config.MARKUP_CENTS),
      category: p.category,
      vendorId: p.vendor_id,
      inStock: !!p.in_stock,
      modifiers: MODIFIERS[p.id] || [],
    }));
  return { categories, products, markup: dollars(config.MARKUP_CENTS) };
}

function getCampuses() {
  return CAMPUSES;
}

// ── Vendors ──────────────────────────────────────────────────────────
function getVendors() {
  return db.prepare('SELECT id, name, emoji, kitchen, is_active FROM vendors').all().map((v) => ({
    id: v.id,
    name: v.name,
    emoji: v.emoji,
    kitchen: !!v.kitchen,
    isActive: !!v.is_active,
  }));
}

function getVendor(id_) {
  return db.prepare('SELECT * FROM vendors WHERE id = ?').get(id_);
}

function setVendorActive(vendorId, active) {
  db.prepare('UPDATE vendors SET is_active = ? WHERE id = ?').run(active ? 1 : 0, vendorId);
  return getVendor(vendorId);
}

// Distinct vendor ids represented in an order (via each item's product).
function orderVendorIds(orderId) {
  return db
    .prepare(
      'SELECT DISTINCT p.vendor_id v FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?'
    )
    .all(orderId)
    .map((r) => r.v);
}

// Does an order contain items from a kitchen (cook-to-order) vendor?
function orderHasKitchen(orderId) {
  return (
    db
      .prepare(
        `SELECT COUNT(*) c FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         JOIN vendors v ON v.id = p.vendor_id
         WHERE oi.order_id = ? AND v.kitchen = 1`
      )
      .get(orderId).c > 0
  );
}

// ── Users / loyalty ──────────────────────────────────────────────────
function getUserById(uid) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
}

function serializeSession(user) {
  if (!user) return null;
  const ledger = db
    .prepare('SELECT id, delta, reason, created_at FROM points_ledger WHERE user_id = ? ORDER BY created_at DESC')
    .all(user.id)
    .map((e) => ({ id: e.id, delta: e.delta, reason: e.reason, at: e.created_at }));
  return {
    phone: user.phone,
    name: user.name,
    campusId: user.campus_id,
    points: user.points,
    referralCode: user.referral_code,
    credit: dollars(user.credit_cents || 0),
    ledger,
  };
}

function addPoints(uid, delta, reason, orderId = null) {
  db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(delta, uid);
  db.prepare(
    'INSERT INTO points_ledger (id, user_id, delta, reason, order_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id('pts'), uid, delta, reason, orderId, Date.now());
}

// ── Notifications ────────────────────────────────────────────────────
// Persisted event feed the customer app polls. The app also raises an
// on-device local notification when it sees a new one. Remote push
// (FCM/APNs) plugs in here as an additional transport.
// Send an Expo push to a device token (reaches a fully-closed phone).
async function sendExpoPush(token, title, body) {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default' }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // best-effort — the in-app feed still has it
  }
}

function notify(userId, title, body, orderId = null) {
  db.prepare(
    'INSERT INTO notifications (id, user_id, order_id, title, body, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
  ).run(id('ntf'), userId, orderId, title, body, Date.now());
  const u = getUserById(userId);
  if (u && u.push_token) sendExpoPush(u.push_token, title, body);
}

function setPushToken(userId, token) {
  db.prepare('UPDATE users SET push_token = ? WHERE id = ?').run(token || null, userId);
  return { ok: true };
}

function listNotifications(userId) {
  return db
    .prepare('SELECT id, order_id, title, body, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(userId)
    .map((n) => ({ id: n.id, orderId: n.order_id, title: n.title, body: n.body, read: !!n.read, at: n.created_at }));
}

function markNotificationsRead(userId) {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
  return listNotifications(userId);
}

const STATUS_NOTE = {
  ACCEPTED: ['Courier assigned', 'A courier claimed your order and is heading to the store.'],
  PICKING: ['Shopper shopping', 'Your courier is grabbing your items now.'],
  OUT_FOR_DELIVERY: ['Out for delivery', 'Your order is on the way to you!'],
  DELIVERED: ['Delivered', 'Your Blink order has arrived. Enjoy!'],
};

// Find-or-create user on successful verification.
function makeReferralCode(phone) {
  return 'BLINK' + phone.slice(-4) + Math.random().toString(36).slice(2, 4).toUpperCase();
}

function upsertUser(phone, campusId) {
  const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (existing) return existing;
  const uid = id('usr');
  db.prepare(
    'INSERT INTO users (id, phone, name, campus_id, points, referral_code, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
  ).run(uid, phone, '', campusId, makeReferralCode(phone), Date.now());
  addPoints(uid, config.WELCOME_BONUS, 'Welcome bonus');
  return getUserById(uid);
}

// ── Referrals ("give $5, get $5") ────────────────────────────────────
// A new user applies a friend's code → both are credited $5 the first time
// the new user completes (gets delivered) an order.
function applyReferral(user, code) {
  if (user.referred_by) throw new Error('already_referred');
  const referrer = db.prepare('SELECT * FROM users WHERE referral_code = ?').get(String(code || '').trim().toUpperCase());
  if (!referrer) throw new Error('bad_code');
  if (referrer.id === user.id) throw new Error('own_code');
  db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrer.id, user.id);
  return { ok: true, referrer: referrer.referral_code };
}

// Called when an order is delivered: release both-sided referral credit once.
function maybeReleaseReferral(userId) {
  const u = getUserById(userId);
  if (!u || !u.referred_by || u.ref_rewarded) return;
  const amt = config.REFERRAL_CREDIT_CENTS;
  db.prepare('UPDATE users SET credit_cents = credit_cents + ?, ref_rewarded = 1 WHERE id = ?').run(amt, u.id);
  db.prepare('UPDATE users SET credit_cents = credit_cents + ? WHERE id = ?').run(amt, u.referred_by);
  notify(u.id, 'Referral reward', `You earned $${amt / 100} credit — thanks for joining a friend!`);
  notify(u.referred_by, 'Your friend joined!', `You earned $${amt / 100} referral credit.`);
}

// ── Bundles ("Blink Picks") ──────────────────────────────────────────
function getBundles() {
  return BUNDLES.map((b) => {
    const items = b.productIds
      .map((pid) => db.prepare('SELECT id, name, emoji, price_cents, in_stock FROM products WHERE id = ?').get(pid))
      .filter((p) => p && p.in_stock);
    return {
      id: b.id,
      name: b.name,
      emoji: b.emoji,
      productIds: b.productIds,
      items: items.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, price: dollars(p.price_cents) })),
      total: dollars(items.reduce((s, p) => s + p.price_cents, 0)),
    };
  });
}

// ── Social proof / stats ─────────────────────────────────────────────
function weekStats(campusId) {
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const total = db
    .prepare("SELECT COUNT(*) c FROM orders WHERE campus_id = ? AND status != 'CANCELLED' AND placed_at >= ?")
    .get(campusId, weekAgo).c;
  const byBuilding = db
    .prepare(
      "SELECT building, COUNT(*) c FROM orders WHERE campus_id = ? AND status != 'CANCELLED' AND placed_at >= ? GROUP BY building ORDER BY c DESC LIMIT 5"
    )
    .all(campusId, weekAgo)
    .map((r) => ({ building: r.building, orders: r.c }));
  return { ordersThisWeek: total, leaderboard: byBuilding };
}

// ── Group / floor orders ─────────────────────────────────────────────
function serializeGroup(g) {
  const rows = db.prepare('SELECT * FROM group_items WHERE group_id = ?').all(g.id);
  const items = rows.map((r) => {
    const p = db.prepare('SELECT name, emoji, price_cents FROM products WHERE id = ?').get(r.product_id);
    return {
      id: r.id,
      productId: r.product_id,
      name: p ? p.name : r.product_id,
      emoji: p ? p.emoji : '🛒',
      price: p ? dollars(p.price_cents) : 0,
      qty: r.qty,
      who: r.user_name || 'Someone',
      lineTotal: p ? dollars(p.price_cents * r.qty) : 0,
    };
  });
  const subtotalCents = rows.reduce((s, r) => {
    const p = db.prepare('SELECT price_cents FROM products WHERE id = ?').get(r.product_id);
    return s + (p ? p.price_cents * r.qty : 0);
  }, 0);
  const threshold = config.FREE_DELIVERY_THRESHOLD_CENTS;
  return {
    id: g.id,
    code: g.code,
    hostId: g.host_id,
    building: g.building,
    status: g.status,
    orderId: g.order_id,
    items,
    subtotal: dollars(subtotalCents),
    freeDeliveryThreshold: dollars(threshold),
    toFreeDelivery: dollars(Math.max(0, threshold - subtotalCents)),
    unlocked: subtotalCents >= threshold,
    people: [...new Set(rows.map((r) => r.user_name || 'Someone'))],
  };
}

function getGroup(idOrCode) {
  const g =
    db.prepare('SELECT * FROM group_carts WHERE id = ?').get(idOrCode) ||
    db.prepare('SELECT * FROM group_carts WHERE code = ?').get(String(idOrCode || '').trim().toUpperCase());
  return g ? serializeGroup(g) : null;
}

function createGroup(user, building) {
  const gid = id('grp');
  const code = 'FLOOR' + Math.random().toString(36).slice(2, 5).toUpperCase();
  db.prepare(
    'INSERT INTO group_carts (id, code, host_id, campus_id, building, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(gid, code, user.id, user.campus_id, building || '', 'open', Date.now());
  return serializeGroup(db.prepare('SELECT * FROM group_carts WHERE id = ?').get(gid));
}

function addGroupItem(code, user, productId, qty) {
  const g = db.prepare('SELECT * FROM group_carts WHERE code = ?').get(String(code || '').trim().toUpperCase());
  if (!g) throw new Error('group_not_found');
  if (g.status !== 'open') throw new Error('group_closed');
  const p = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!p) throw new Error('bad_product');
  const q = Math.max(1, Math.floor(Number(qty || 1)));
  const existing = db
    .prepare('SELECT * FROM group_items WHERE group_id = ? AND user_id = ? AND product_id = ?')
    .get(g.id, user.id, productId);
  if (existing) {
    db.prepare('UPDATE group_items SET qty = qty + ? WHERE id = ?').run(q, existing.id);
  } else {
    db.prepare(
      'INSERT INTO group_items (id, group_id, user_id, user_name, product_id, qty) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id('gi'), g.id, user.id, user.name || user.phone.slice(-4), productId, q);
  }
  return serializeGroup(db.prepare('SELECT * FROM group_carts WHERE id = ?').get(g.id));
}

// Host checks out the whole group as one order to one drop-off (self-batched).
function checkoutGroup(code, user, opts) {
  const g = db.prepare('SELECT * FROM group_carts WHERE code = ?').get(String(code || '').trim().toUpperCase());
  if (!g) throw new Error('group_not_found');
  if (g.host_id !== user.id) throw new Error('not_host');
  if (g.status !== 'open') throw new Error('group_closed');
  const rows = db.prepare('SELECT product_id, SUM(qty) qty FROM group_items WHERE group_id = ? GROUP BY product_id').all(g.id);
  if (rows.length === 0) throw new Error('empty_cart');
  const order = createOrder(user, {
    items: rows.map((r) => ({ productId: r.product_id, qty: r.qty })),
    building: opts.building || g.building,
    note: opts.note || 'Group / floor order',
    tip: opts.tip || 0,
    redeemPoints: false,
  });
  db.prepare("UPDATE group_carts SET status = 'placed', order_id = ? WHERE id = ?").run(order.id, g.id);
  return order;
}

// ── Orders ───────────────────────────────────────────────────────────
function shortId(orderId) {
  return orderId.slice(-5).toUpperCase();
}

function rawItems(orderId) {
  return db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
}

// An item's effective price after substitution/refund.
function effectiveCents(it) {
  if (it.item_status === 'refunded') return 0;
  if (it.item_status === 'substituted') return (it.sub_price_cents ?? it.price_cents) * it.qty;
  return it.price_cents * it.qty;
}

function orderNeedsSubstitution(orderId) {
  return (
    db
      .prepare("SELECT COUNT(*) c FROM order_items WHERE order_id = ? AND item_status = 'out_of_stock'")
      .get(orderId).c > 0
  );
}

// Progress + ETA are derived server-side so every client shows the same
// thing. driveProgress animates the map strip during OUT_FOR_DELIVERY.
function derive(order) {
  const idx = STEPS.indexOf(order.status);
  const elapsed = (Date.now() - order.placed_at) / 1000;
  const total = config.CADENCE.DELIVERED;
  const delivered = order.status === 'DELIVERED';
  const etaMinutes = delivered ? 0 : Math.max(1, Math.ceil((total - elapsed) / 60));
  let driveProgress = 0;
  if (delivered) driveProgress = 1;
  else if (order.status === 'OUT_FOR_DELIVERY') {
    const span = config.CADENCE.DELIVERED - config.CADENCE.OUT_FOR_DELIVERY;
    driveProgress = Math.max(0, Math.min(1, (elapsed - config.CADENCE.OUT_FOR_DELIVERY) / span));
  }
  return { stepIndex: idx, etaMinutes, driveProgress };
}

function serializeOrder(order) {
  const items = rawItems(order.id).map((it) => ({
    id: it.id,
    productId: it.product_id,
    name: it.name,
    emoji: it.emoji,
    price: dollars(it.price_cents),
    qty: it.qty,
    modifier: it.modifier || '',
    itemStatus: it.item_status,
    substitute:
      it.item_status === 'substituted'
        ? {
            productId: it.sub_product_id,
            name: it.sub_name,
            emoji: it.sub_emoji,
            price: dollars(it.sub_price_cents),
          }
        : null,
  }));
  const d = derive(order);
  const needsSubstitution = items.some((i) => i.itemStatus === 'out_of_stock');
  return {
    id: order.id,
    shortId: shortId(order.id),
    items,
    subtotal: dollars(order.subtotal_cents),
    deliveryFee: dollars(order.delivery_fee_cents),
    serviceFee: dollars(order.service_fee_cents),
    smallOrderFee: dollars(order.small_order_fee_cents),
    tax: dollars(order.tax_cents),
    tip: dollars(order.tip_cents),
    discount: dollars(order.discount_cents),
    total: dollars(order.total_cents),
    campusId: order.campus_id,
    building: order.building,
    note: order.note,
    status: order.status,
    stepIndex: d.stepIndex,
    etaMinutes: d.etaMinutes,
    driveProgress: d.driveProgress,
    needsSubstitution,
    driverName: order.driver_name || null,
    kitchenStatus: order.kitchen_status,
    escalationLevel: order.escalation_level,
    dispatchLevel: order.dispatch_level,
    receiptCaptured: !!order.receipt_path,
    paid: !!order.paid,
    vendorIds: orderVendorIds(order.id),
    pointsEarned: order.points_earned,
    pointsRedeemed: order.points_redeemed,
    placedAt: order.placed_at,
  };
}

function getOrder(orderId, userId = null) {
  const o = userId
    ? db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId)
    : db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  return o || null;
}

function listOrders(userId) {
  return db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY placed_at DESC')
    .all(userId)
    .map(serializeOrder);
}

// Recompute all money on an order from its current item states. Used after
// a substitution or refund so totals always reflect what's actually being
// delivered. Keeps the same fee/discount rules as createOrder.
function recomputeTotals(orderId) {
  const order = getOrder(orderId);
  const items = rawItems(orderId);
  const subtotal = items.reduce((s, it) => s + effectiveCents(it), 0);
  const discount = Math.min(order.discount_cents, subtotal);
  const smallOrderFee =
    subtotal > 0 && subtotal < config.SMALL_ORDER_THRESHOLD_CENTS ? config.SMALL_ORDER_FEE_CENTS : 0;
  const tax = Math.round((subtotal - discount) * config.TAX_RATE);
  const total =
    subtotal - discount + tax + order.delivery_fee_cents + order.service_fee_cents + smallOrderFee + order.tip_cents;
  db.prepare(
    `UPDATE orders SET subtotal_cents = ?, small_order_fee_cents = ?, tax_cents = ?, total_cents = ?, points_earned = ? WHERE id = ?`
  ).run(subtotal, smallOrderFee, tax, total, Math.floor(subtotal / 100), orderId);
}

// Create an order from a validated cart. Prices come from the DB, never
// the client. Applies the zero-minimum small-order fee + flat service fee.
function createOrder(user, { items, building, note, tip, redeemPoints }) {
  const cleanTipCents = Math.max(0, Math.round(Number(tip || 0) * 100));
  const resolved = [];
  for (const line of items || []) {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(line.productId);
    const qty = Math.max(0, Math.floor(Number(line.qty || 0)));
    if (!p || qty <= 0) continue;
    // Resolve a required modifier by matching its label server-side (never
    // trust a client-supplied price delta).
    let modifierLabel = '';
    let modifierDelta = 0;
    const groups = MODIFIERS[p.id] || [];
    if (line.modifier && groups.length) {
      // A build-your-own selection is "Label A · Label B · …". Match each part
      // against the item's groups and sum the deltas — never trust the client.
      const matched = [];
      for (const part of String(line.modifier).split(' · ').map((s) => s.trim()).filter(Boolean)) {
        for (const g of groups) {
          const opt = g.options.find((o) => o.label === part);
          if (opt) {
            modifierDelta += opt.priceDelta;
            matched.push(opt.label);
            break;
          }
        }
      }
      modifierLabel = matched.join(' · ');
    }
    // Unit price = base + platform markup + modifier delta.
    const unit = p.price_cents + config.MARKUP_CENTS + modifierDelta;
    resolved.push({ product: p, qty, unit, modifierLabel });
  }
  if (resolved.length === 0) throw new Error('empty_cart');

  // Geofence: the drop-off must sit inside the campus delivery zone.
  const drop = buildingCoord(user.campus_id, building || '');
  if (!insideZone(user.campus_id, drop.lat, drop.lng)) throw new Error('outside_zone');

  const subtotal = resolved.reduce((s, r) => s + r.unit * r.qty, 0);
  const canRedeem = redeemPoints && user.points >= config.REDEEM_POINTS;
  const pointsDiscount = canRedeem ? Math.min(config.REDEEM_VALUE_CENTS, subtotal) : 0;
  const smallOrderFee =
    subtotal < config.SMALL_ORDER_THRESHOLD_CENTS ? config.SMALL_ORDER_FEE_CENTS : 0;
  const serviceFee = config.SERVICE_FEE_CENTS;
  // Free delivery once the cart clears the threshold.
  const deliveryFee = subtotal >= config.FREE_DELIVERY_THRESHOLD_CENTS ? 0 : config.DELIVERY_FEE_CENTS;
  const tax = Math.round((subtotal - pointsDiscount) * config.TAX_RATE);
  let total =
    subtotal - pointsDiscount + tax + deliveryFee + serviceFee + smallOrderFee + cleanTipCents;
  // Referral credit acts like a gift card — applied to the final total.
  const creditApplied = Math.min(user.credit_cents || 0, Math.max(0, total));
  total -= creditApplied;
  const discount = pointsDiscount + creditApplied;
  const orderId = id('ord');
  const now = Date.now();

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, user_id, campus_id, building, note, status,
      subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents,
      tax_cents, tip_cents, discount_cents, total_cents,
      points_earned, points_redeemed, points_awarded, auto, placed_at
    ) VALUES (?, ?, ?, ?, ?, 'PLACED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (id, order_id, product_id, name, emoji, price_cents, qty, modifier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    insertOrder.run(
      orderId, user.id, user.campus_id, building || '', note || '',
      subtotal, deliveryFee, serviceFee, smallOrderFee,
      tax, cleanTipCents, discount, total,
      Math.floor(subtotal / 100), canRedeem ? config.REDEEM_POINTS : 0, now
    );
    for (const r of resolved) {
      insertItem.run(id('itm'), orderId, r.product.id, r.product.name, r.product.emoji, r.unit, r.qty, r.modifierLabel);
    }
    if (canRedeem) {
      addPoints(user.id, -config.REDEEM_POINTS, `Redeemed $${config.REDEEM_VALUE_CENTS / 100} off`, orderId);
    }
    if (creditApplied > 0) {
      db.prepare('UPDATE users SET credit_cents = credit_cents - ? WHERE id = ?').run(creditApplied, user.id);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  // If the order includes cook-to-order items, it waits for the kitchen to
  // accept it (KDS) before a courier proceeds. Snack Hub orders skip this.
  if (orderHasKitchen(orderId)) {
    db.prepare("UPDATE orders SET kitchen_status = 'pending' WHERE id = ?").run(orderId);
  }
  // With Stripe on, hold the order until payment completes.
  if (stripeEnabled()) {
    db.prepare('UPDATE orders SET paid = 0 WHERE id = ?').run(orderId);
  }
  notify(user.id, 'Order placed', `We got your order #${shortId(orderId)} — finding a courier.`, orderId);
  return serializeOrder(getOrder(orderId));
}

// Move an order to a new status, stamping the timestamp and awarding
// loyalty points the first time it reaches DELIVERED. Delivery is blocked
// while any item is awaiting a customer substitution decision.
function setStatus(orderId, status, { manual = false } = {}) {
  const order = getOrder(orderId);
  if (!order) throw new Error('not_found');
  if (!STEPS.includes(status)) throw new Error('bad_status');

  const forward = STEPS.indexOf(status);
  if (forward >= STEPS.indexOf('OUT_FOR_DELIVERY') && orderNeedsSubstitution(orderId)) {
    throw new Error('needs_substitution');
  }

  const col = STATUS_COL[status];
  const stamp = col ? `, ${col} = COALESCE(${col}, ?)` : '';
  const autoClause = manual ? ', auto = 0' : '';
  if (col) {
    db.prepare(`UPDATE orders SET status = ?${stamp}${autoClause} WHERE id = ?`).run(status, Date.now(), orderId);
  } else {
    db.prepare(`UPDATE orders SET status = ?${autoClause} WHERE id = ?`).run(status, orderId);
  }

  if (status === 'DELIVERED' && !order.points_awarded) {
    const fresh = getOrder(orderId);
    const pts = fresh.points_earned;
    db.prepare('UPDATE orders SET points_awarded = 1 WHERE id = ?').run(orderId);
    if (pts > 0) addPoints(order.user_id, pts, `Order delivered — #${shortId(orderId)}`, orderId);
    maybeReleaseReferral(order.user_id); // pay out "give $5, get $5" on first delivery
  }
  // Notify the customer on real forward transitions.
  if (status !== order.status && STATUS_NOTE[status]) {
    notify(order.user_id, STATUS_NOTE[status][0], STATUS_NOTE[status][1], orderId);
  }
  return serializeOrder(getOrder(orderId));
}

// A driver claims an order from the queue.
function acceptOrder(orderId, driverName) {
  const order = getOrder(orderId);
  if (!order) throw new Error('not_found');
  if (order.driver_id) throw new Error('already_claimed');
  db.prepare('UPDATE orders SET driver_id = ?, driver_name = ?, auto = 0 WHERE id = ?').run(
    id('drv'),
    driverName || 'Courier',
    orderId
  );
  return setStatus(orderId, 'ACCEPTED', { manual: true });
}

// Driver marks a checklist item unavailable → pings the customer to resolve.
function markItemOutOfStock(orderId, itemId) {
  const it = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(itemId, orderId);
  if (!it) throw new Error('item_not_found');
  db.prepare("UPDATE order_items SET item_status = 'out_of_stock' WHERE id = ?").run(itemId);
  const order = getOrder(orderId);
  notify(order.user_id, 'Item out of stock', `${it.name} is unavailable — tap to pick a substitute or refund.`, orderId);
  return serializeOrder(getOrder(orderId));
}

// Customer resolves an out-of-stock item: choose a substitute or refund it.
function resolveItem(orderId, itemId, { substituteProductId, refund }) {
  const it = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(itemId, orderId);
  if (!it) throw new Error('item_not_found');
  if (refund) {
    db.prepare("UPDATE order_items SET item_status = 'refunded' WHERE id = ?").run(itemId);
  } else {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(substituteProductId);
    if (!p) throw new Error('bad_substitute');
    db.prepare(
      `UPDATE order_items SET item_status = 'substituted',
        sub_product_id = ?, sub_name = ?, sub_emoji = ?, sub_price_cents = ? WHERE id = ?`
    ).run(p.id, p.name, p.emoji, p.price_cents, itemId);
  }
  recomputeTotals(orderId);
  return serializeOrder(getOrder(orderId));
}

// Called on an interval: advance auto (demo) orders whose next step is due.
// Pauses an order while it has an unresolved out-of-stock item.
function tickAutoOrders() {
  const active = db
    .prepare("SELECT * FROM orders WHERE auto = 1 AND status != 'DELIVERED' AND status != 'CANCELLED'")
    .all();
  const now = Date.now();
  for (const o of active) {
    if (!o.paid) continue; // wait for Stripe payment to complete
    if (orderNeedsSubstitution(o.id)) continue; // wait for the customer
    if (o.kitchen_status === 'pending') continue; // wait for the restaurant (KDS)
    const elapsed = (now - o.placed_at) / 1000;
    let target = o.status;
    for (const step of ['ACCEPTED', 'PICKING', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
      if (elapsed >= config.CADENCE[step]) target = step;
    }
    if (target !== o.status) {
      try {
        setStatus(o.id, target, { manual: false });
      } catch {
        // blocked (e.g. needs_substitution) — skip this tick
      }
    }
  }
}

// ── Driver / staff dashboard view ────────────────────────────────────
function driverOrders() {
  const rows = db.prepare('SELECT * FROM orders ORDER BY placed_at DESC LIMIT 50').all();
  return rows.map((o) => {
    const s = serializeOrder(o);
    const user = getUserById(o.user_id);
    return { ...s, phone: user ? user.phone : '', auto: !!o.auto, claimed: !!o.driver_id };
  });
}

function setStock(productId, inStock) {
  db.prepare('UPDATE products SET in_stock = ? WHERE id = ?').run(inStock ? 1 : 0, productId);
  return db.prepare('SELECT id, in_stock FROM products WHERE id = ?').get(productId);
}

// ── Stripe Checkout (hosted pay page, via REST — no SDK needed) ───────
// When a secret key is set, real Checkout Sessions are created and orders
// wait (paid = 0) until payment completes. With no key, orders are treated
// as paid immediately (demo/stub) so the app still works.
function stripeEnabled() {
  return !!config.STRIPE.secretKey;
}

async function stripePost(path, params) {
  const res = await fetch('https://api.stripe.com/v1' + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + config.STRIPE.secretKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(12000),
  });
  return res.json();
}

async function stripeGet(path) {
  const res = await fetch('https://api.stripe.com/v1' + path, {
    headers: { Authorization: 'Bearer ' + config.STRIPE.secretKey },
    signal: AbortSignal.timeout(12000),
  });
  return res.json();
}

// Create a Checkout Session for an order's total. `origin` is the backend's
// own URL so Stripe can redirect the browser back after payment.
async function createCheckoutSession(order, origin) {
  if (!stripeEnabled()) return { enabled: false };
  const session = await stripePost('/checkout/sessions', {
    mode: 'payment',
    success_url: `${origin}/pay/success?order=${order.id}`,
    cancel_url: `${origin}/pay/cancel?order=${order.id}`,
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': `Blink order #${shortId(order.id)}`,
    'line_items[0][price_data][unit_amount]': String(order.total_cents),
    'line_items[0][quantity]': '1',
    'metadata[order_id]': order.id,
  });
  if (session && session.id) {
    db.prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').run(session.id, order.id);
    return { enabled: true, url: session.url, sessionId: session.id };
  }
  return { enabled: true, error: (session && session.error && session.error.message) || 'stripe_error' };
}

// After the customer returns from Checkout, verify with Stripe and release
// the order for fulfillment if paid.
async function confirmPayment(orderId) {
  const order = getOrder(orderId);
  if (!order) throw new Error('not_found');
  if (order.paid) return { paid: true };
  if (!order.stripe_session_id) return { paid: false };
  const session = await stripeGet('/checkout/sessions/' + order.stripe_session_id);
  if (session && session.payment_status === 'paid') {
    db.prepare('UPDATE orders SET paid = 1 WHERE id = ?').run(orderId);
    return { paid: true };
  }
  return { paid: false };
}

// ── Unit economics / profit ──────────────────────────────────────────
// Breaks a single order into where the money goes and what Blink keeps.
// COGS (items) and tax are pass-through; the courier gets base pay + tip;
// Stripe takes its cut of the whole charge; loyalty discounts come out of
// Blink's margin. Everything in cents.
function orderEconomics(order) {
  const units = db.prepare('SELECT COALESCE(SUM(qty),0) u FROM order_items WHERE order_id = ?').get(order.id).u;
  const total = order.total_cents;
  const stripeFee = Math.round(total * config.STRIPE.pct + config.STRIPE.fixedCents);
  const driverPay = config.DRIVER_BASE_PAY_CENTS + order.tip_cents;
  const deliveryMargin = order.delivery_fee_cents - config.DRIVER_BASE_PAY_CENTS;
  const markupRevenue = config.MARKUP_CENTS * units;
  const grossRevenue = order.service_fee_cents + order.small_order_fee_cents + deliveryMargin + markupRevenue;
  const netProfit = grossRevenue - stripeFee - order.discount_cents;
  return {
    customerPaid: total,
    cogs: order.subtotal_cents, // paid to the store (pass-through)
    tax: order.tax_cents, // remitted to the state (pass-through)
    driverPay, // courier base pay + 100% tip
    grossRevenue, // service + small-order fee + delivery margin + markup
    stripeFee,
    loyaltyCost: order.discount_cents,
    netProfit,
  };
}

// Aggregates profit across orders. Cancelled orders are excluded; delivered
// orders are "realized", in-progress are "projected".
function ownerEconomics() {
  const orders = db
    .prepare("SELECT * FROM orders WHERE status != 'CANCELLED' ORDER BY placed_at DESC LIMIT 200")
    .all();
  const rows = orders.map((o) => {
    const e = orderEconomics(o);
    return { shortId: shortId(o.id), status: o.status, delivered: o.status === 'DELIVERED', ...e };
  });
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const delivered = rows.filter((r) => r.delivered);
  const realizedProfit = delivered.reduce((s, r) => s + r.netProfit, 0);
  const totals = {
    orders: rows.length,
    delivered: delivered.length,
    customerPaid: sum('customerPaid'),
    grossRevenue: sum('grossRevenue'),
    stripeFees: sum('stripeFee'),
    driverPay: sum('driverPay'),
    loyaltyCost: sum('loyaltyCost'),
    netProfit: sum('netProfit'),
    realizedProfit,
    avgProfit: rows.length ? Math.round(sum('netProfit') / rows.length) : 0,
  };
  const marginPct = totals.customerPaid ? (totals.netProfit / totals.customerPaid) * 100 : 0;
  return {
    rows,
    totals: { ...totals, marginPct: Math.round(marginPct * 10) / 10 },
    knobs: {
      deliveryFee: config.DELIVERY_FEE_CENTS,
      serviceFee: config.SERVICE_FEE_CENTS,
      smallOrderFee: config.SMALL_ORDER_FEE_CENTS,
      markup: config.MARKUP_CENTS,
      driverBasePay: config.DRIVER_BASE_PAY_CENTS,
      stripePct: config.STRIPE.pct,
      stripeFixed: config.STRIPE.fixedCents,
      stripeLive: !!config.STRIPE.secretKey,
    },
  };
}

// Courier uploads a photo of the gas-station receipt for bookkeeping.
// dataUrl is "data:image/...;base64,....". Saved under public/receipts.
function saveReceipt(orderId, dataUrl) {
  const order = getOrder(orderId);
  if (!order) throw new Error('not_found');
  const m = /^data:(image\/\w+);base64,(.+)$/s.exec(dataUrl || '');
  if (!m) throw new Error('bad_image');
  const ext = m[1].split('/')[1].replace('jpeg', 'jpg');
  const file = `${shortId(orderId)}_${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(RECEIPTS_DIR, file), Buffer.from(m[2], 'base64'));
  db.prepare('UPDATE orders SET receipt_path = ? WHERE id = ?').run(`receipts/${file}`, orderId);
  return { ok: true, receipt: `receipts/${file}` };
}

// ── Courier dispatch fallback ────────────────────────────────────────
// Orders no courier has claimed escalate: re-broadcast to all couriers,
// then alert the admin panel for manual assignment.
function needsCourier(o) {
  return !o.driver_id && o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.kitchen_status !== 'pending';
}

function dispatchTick() {
  const rows = db
    .prepare("SELECT * FROM orders WHERE driver_id IS NULL AND status NOT IN ('DELIVERED','CANCELLED')")
    .all();
  const now = Date.now();
  for (const o of rows) {
    if (!needsCourier(o)) continue;
    const elapsed = (now - o.placed_at) / 1000;
    let level = 0;
    if (elapsed >= config.DISPATCH.broadcast) level = 1;
    if (elapsed >= config.DISPATCH.adminAlert) level = 2;
    if (level <= o.dispatch_level) continue;
    db.prepare('UPDATE orders SET dispatch_level = ? WHERE id = ?').run(level, o.id);
    if (level === 1) console.log(`[dispatch] #${shortId(o.id)}: high-priority re-broadcast to all on-shift couriers`);
    if (level === 2) console.log(`[dispatch] #${shortId(o.id)}: no courier after ${Math.round(config.DISPATCH.adminAlert)}s — admin manual-assign alert`);
  }
}

// ── Admin actions ────────────────────────────────────────────────────
function reassignOrder(orderId) {
  const o = getOrder(orderId);
  if (!o) throw new Error('not_found');
  // Release the courier and drop it back into the open queue.
  db.prepare(
    "UPDATE orders SET driver_id = NULL, driver_name = NULL, status = 'PLACED', dispatch_level = 0, accepted_at = NULL WHERE id = ?"
  ).run(orderId);
  return serializeOrder(getOrder(orderId));
}

function getCouriers() {
  return db.prepare('SELECT * FROM couriers').all().map((c) => ({
    id: c.id,
    name: c.name,
    scooterDeposit: dollars(c.scooter_deposit_cents),
    depositStatus: c.deposit_status, // none | held | returned
  }));
}

function setDeposit(courierId, status) {
  const held = status === 'held' ? 15000 : status === 'returned' ? 0 : 0;
  db.prepare('UPDATE couriers SET deposit_status = ?, scooter_deposit_cents = ? WHERE id = ?').run(
    status,
    status === 'held' ? 15000 : held,
    courierId
  );
  return getCouriers();
}

// ── Restaurant KDS (Kitchen Display System) ──────────────────────────
// Orders containing this vendor's items that still need a kitchen decision
// or are being cooked. Accessed by a per-vendor link, no login (per spec).
function kdsOrders(vendorId) {
  const rows = db
    .prepare(
      `SELECT DISTINCT o.* FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE p.vendor_id = ? AND o.status != 'CANCELLED'
       ORDER BY o.placed_at DESC LIMIT 40`
    )
    .all(vendorId);
  return rows.map((o) => {
    const s = serializeOrder(o);
    // Only show this vendor's line items on the kitchen ticket.
    const mine = rawItems(o.id).filter((it) => {
      const p = db.prepare('SELECT vendor_id FROM products WHERE id = ?').get(it.product_id);
      return p && p.vendor_id === vendorId;
    });
    return { ...s, kitchenItems: mine.map((it) => ({ name: it.name, emoji: it.emoji, qty: it.qty })) };
  });
}

function acceptKitchen(orderId) {
  db.prepare("UPDATE orders SET kitchen_status = 'cooking', escalation_level = 0 WHERE id = ?").run(orderId);
  return serializeOrder(getOrder(orderId));
}

function rejectKitchen(orderId) {
  db.prepare("UPDATE orders SET kitchen_status = 'rejected', status = 'CANCELLED', cancelled_at = ? WHERE id = ?").run(
    Date.now(),
    orderId
  );
  return serializeOrder(getOrder(orderId));
}

// ── Admin command center ─────────────────────────────────────────────
function adminOrders() {
  const rows = db.prepare('SELECT * FROM orders ORDER BY placed_at DESC LIMIT 60').all();
  return rows.map((o) => {
    const s = serializeOrder(o);
    const user = getUserById(o.user_id);
    return { ...s, phone: user ? user.phone : '', claimed: !!o.driver_id };
  });
}

function cancelOrder(orderId) {
  const o = getOrder(orderId);
  if (!o) throw new Error('not_found');
  db.prepare("UPDATE orders SET status = 'CANCELLED', cancelled_at = ? WHERE id = ?").run(Date.now(), orderId);
  return serializeOrder(getOrder(orderId));
}

// Distinct couriers currently on shift (have claimed active orders).
function fleet() {
  return db
    .prepare(
      `SELECT driver_name, COUNT(*) active FROM orders
       WHERE driver_id IS NOT NULL AND status NOT IN ('DELIVERED','CANCELLED')
       GROUP BY driver_name`
    )
    .all()
    .map((r) => ({ name: r.driver_name || 'Courier', activeOrders: r.active }));
}

// Fail-safe escalation loop for restaurant orders left unaccepted. SMS and
// the text-to-speech call are stubbed (logged) — wire Twilio for real. The
// auto-pause at the final level is real.
function escalationTick() {
  const pending = db
    .prepare("SELECT * FROM orders WHERE kitchen_status = 'pending' AND status != 'CANCELLED'")
    .all();
  const now = Date.now();
  for (const o of pending) {
    const elapsed = (now - o.placed_at) / 1000;
    let level = 1; // level 1 fires immediately on placement (alarm + SMS to manager)
    if (elapsed >= config.ESCALATION.sms2) level = 2;
    if (elapsed >= config.ESCALATION.call) level = 3;
    if (elapsed >= config.ESCALATION.pause) level = 4;
    if (level <= o.escalation_level) continue;
    db.prepare('UPDATE orders SET escalation_level = ? WHERE id = ?').run(level, o.id);
    const tag = `[escalation] order #${shortId(o.id)}`;
    if (level === 1) console.log(`${tag}: alarm + SMS to manager (stub)`);
    if (level === 2) console.log(`${tag}: second escalation SMS (stub)`);
    if (level === 3) console.log(`${tag}: Twilio text-to-speech call (stub)`);
    if (level === 4) {
      for (const vid of orderVendorIds(o.id)) {
        const v = getVendor(vid);
        if (v && v.kitchen) setVendorActive(vid, 0);
      }
      console.log(`${tag}: auto-paused vendor + alerted admin (real pause)`);
    }
  }
}

module.exports = {
  STEPS,
  getCatalog,
  getCampuses,
  getVendors,
  getUserById,
  serializeSession,
  upsertUser,
  createOrder,
  getOrder,
  listOrders,
  serializeOrder,
  setStatus,
  acceptOrder,
  markItemOutOfStock,
  resolveItem,
  tickAutoOrders,
  driverOrders,
  setStock,
  kdsOrders,
  acceptKitchen,
  rejectKitchen,
  adminOrders,
  cancelOrder,
  fleet,
  setVendorActive,
  escalationTick,
  listNotifications,
  markNotificationsRead,
  saveReceipt,
  dispatchTick,
  reassignOrder,
  getCouriers,
  setDeposit,
  insideZone,
  buildingCoord,
  fastestRoute,
  campusById,
  orderEconomics,
  ownerEconomics,
  applyReferral,
  getBundles,
  weekStats,
  createGroup,
  getGroup,
  addGroupItem,
  checkoutGroup,
  stripeEnabled,
  createCheckoutSession,
  confirmPayment,
  setPushToken,
};
