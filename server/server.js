'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { db, config } = require('./db');
const auth = require('./auth');
const logic = require('./logic');
const sms = require('./sms');
const fbverify = require('./firebase-verify');

// ── tiny helpers ─────────────────────────────────────────────────────
function send(res, status, body, extraHeaders = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Store-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...extraHeaders,
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 8e6) req.destroy(); // allow receipt-photo uploads
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function authUser(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  const payload = auth.verifyToken(token);
  if (!payload) return null;
  return logic.getUserById(payload.uid);
}

function normalizePhone(raw) {
  return String(raw || '').replace(/\D/g, '');
}

// ── routes ───────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);

  if (req.method === 'OPTIONS') return send(res, 204, '');

  try {
    // Health
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return send(res, 200, { ok: true, time: Date.now() });
    }

    // Catalog + campuses (public)
    if (req.method === 'GET' && url.pathname === '/api/catalog') {
      return send(res, 200, logic.getCatalog());
    }
    if (req.method === 'GET' && url.pathname === '/api/campuses') {
      return send(res, 200, logic.getCampuses());
    }

    // Geofence check for a drop-off point (public).
    if (req.method === 'GET' && url.pathname === '/api/geofence') {
      const campus = url.searchParams.get('campus') || 'unl';
      const lat = Number(url.searchParams.get('lat'));
      const lng = Number(url.searchParams.get('lng'));
      return send(res, 200, { inside: logic.insideZone(campus, lat, lng) });
    }

    // Fastest driving route between two points (real OSRM directions).
    if (req.method === 'GET' && url.pathname === '/api/route') {
      const from = { lat: Number(url.searchParams.get('fromLat')), lng: Number(url.searchParams.get('fromLng')) };
      const to = { lat: Number(url.searchParams.get('toLat')), lng: Number(url.searchParams.get('toLng')) };
      return send(res, 200, await logic.fastestRoute(from, to));
    }

    // Route for a specific order: store → drop-off (used by the driver map).
    if (parts[0] === 'api' && parts[1] === 'orders' && parts[2] && parts[3] === 'route' && req.method === 'GET') {
      const order = logic.getOrder(parts[2]);
      if (!order) return send(res, 404, { error: 'not_found' });
      const campus = logic.campusById(order.campus_id);
      const drop = logic.buildingCoord(order.campus_id, order.building);
      const route = await logic.fastestRoute(campus.store, drop);
      return send(res, 200, { store: campus.store, drop, ...route });
    }

    // ── Auth ──
    if (req.method === 'POST' && url.pathname === '/api/auth/request-code') {
      const { phone } = await readJson(req);
      const digits = normalizePhone(phone);
      if (digits.length !== 10) return send(res, 400, { error: 'invalid_phone' });
      const code = auth.generateOtp();
      db.prepare(
        `INSERT INTO otps (phone, code, expires_at, attempts) VALUES (?, ?, ?, 0)
         ON CONFLICT(phone) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at, attempts=0`
      ).run(digits, code, Date.now() + config.OTP_TTL_MS);
      // Send the real text when Twilio is configured; otherwise the dev code
      // (123456) works and we surface it as a hint. Never leak a real code.
      if (sms.smsEnabled()) {
        sms.sendSms(digits, `Your Blink verification code is ${code}`).catch(() => {});
      }
      return send(res, 200, { ok: true, devHint: config.DEV_OTP_ENABLED ? config.DEV_OTP : undefined });
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/verify') {
      const { phone, code, campusId } = await readJson(req);
      const digits = normalizePhone(phone);
      if (digits.length !== 10) return send(res, 400, { error: 'invalid_phone' });
      const row = db.prepare('SELECT * FROM otps WHERE phone = ?').get(digits);
      const expired = row && Date.now() > row.expires_at;
      const stored = row && !expired ? row.code : null;
      if (!auth.otpMatches(String(code || '').trim(), stored)) {
        if (row) db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE phone = ?').run(digits);
        return send(res, 401, { error: 'bad_code' });
      }
      db.prepare('DELETE FROM otps WHERE phone = ?').run(digits);
      const campus = campusId === 'unl' ? 'unl' : 'creighton';
      const user = logic.upsertUser(digits, campus);
      return send(res, 200, {
        token: auth.makeToken(user.id),
        session: logic.serializeSession(user),
      });
    }

    // Firebase phone auth: the client already verified the SMS code with
    // Firebase and sends us the resulting ID token. We verify its signature
    // (against Google's public keys) and mint the same Blink session.
    if (req.method === 'POST' && url.pathname === '/api/auth/firebase') {
      if (!config.FIREBASE.projectId) return send(res, 400, { error: 'firebase_not_configured' });
      const { idToken, campusId } = await readJson(req);
      let payload;
      try {
        payload = await fbverify.verifyIdToken(idToken);
      } catch {
        return send(res, 401, { error: 'invalid_token' });
      }
      // Firebase gives an E.164 number (+14025550134); reduce to 10 US digits.
      let digits = normalizePhone(payload.phone_number);
      if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
      if (digits.length !== 10) return send(res, 400, { error: 'no_phone' });
      const campus = campusId === 'unl' ? 'unl' : 'creighton';
      const user = logic.upsertUser(digits, campus);
      return send(res, 200, {
        token: auth.makeToken(user.id),
        session: logic.serializeSession(user),
      });
    }

    // ── Authenticated user routes ──
    if (url.pathname === '/api/me' && req.method === 'GET') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      return send(res, 200, logic.serializeSession(user));
    }

    if (url.pathname === '/api/orders' && req.method === 'GET') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      return send(res, 200, logic.listOrders(user.id));
    }

    if (url.pathname === '/api/notifications' && req.method === 'GET') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      return send(res, 200, logic.listNotifications(user.id));
    }

    // Payments config (public): tells the app whether real Stripe is on.
    if (url.pathname === '/api/payments/config' && req.method === 'GET') {
      return send(res, 200, {
        enabled: logic.stripeEnabled(),
        publishableKey: config.STRIPE.publishableKey || '',
      });
    }
    // Create a Stripe Checkout Session for an order.
    if (parts[0] === 'api' && parts[1] === 'orders' && parts[2] && parts[3] === 'checkout' && req.method === 'POST') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      const order = logic.getOrder(parts[2], user.id);
      if (!order) return send(res, 404, { error: 'not_found' });
      const origin = 'http://' + req.headers.host;
      try {
        return send(res, 200, await logic.createCheckoutSession(order, origin));
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    // Confirm payment after the customer returns from Checkout.
    if (parts[0] === 'api' && parts[1] === 'orders' && parts[2] && parts[3] === 'confirm' && req.method === 'POST') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      const order = logic.getOrder(parts[2], user.id);
      if (!order) return send(res, 404, { error: 'not_found' });
      try {
        return send(res, 200, await logic.confirmPayment(parts[2]));
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }

    // Bundles + social-proof stats (public)
    if (url.pathname === '/api/bundles' && req.method === 'GET') {
      return send(res, 200, logic.getBundles());
    }
    if (url.pathname === '/api/stats' && req.method === 'GET') {
      return send(res, 200, logic.weekStats(url.searchParams.get('campus') || 'unl'));
    }

    // Referral: apply a friend's code
    if (url.pathname === '/api/referral/apply' && req.method === 'POST') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      const { code } = await readJson(req);
      try {
        logic.applyReferral(user, code);
        return send(res, 200, { ok: true, session: logic.serializeSession(logic.getUserById(user.id)) });
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }

    // Group / floor orders
    if (url.pathname === '/api/group' && req.method === 'POST') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      const { building } = await readJson(req);
      return send(res, 200, logic.createGroup(user, building));
    }
    if (parts[0] === 'api' && parts[1] === 'group' && parts[2] && parts[3] === undefined && req.method === 'GET') {
      const g = logic.getGroup(parts[2]);
      if (!g) return send(res, 404, { error: 'not_found' });
      return send(res, 200, g);
    }
    if (parts[0] === 'api' && parts[1] === 'group' && parts[2] && parts[3] === 'add' && req.method === 'POST') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      const { productId, qty } = await readJson(req);
      try {
        return send(res, 200, logic.addGroupItem(parts[2], user, productId, qty));
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    if (parts[0] === 'api' && parts[1] === 'group' && parts[2] && parts[3] === 'checkout' && req.method === 'POST') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      const body = await readJson(req);
      try {
        const order = logic.checkoutGroup(parts[2], user, body);
        return send(res, 200, { order, session: logic.serializeSession(logic.getUserById(user.id)) });
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    if (url.pathname === '/api/notifications/read' && req.method === 'POST') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      return send(res, 200, logic.markNotificationsRead(user.id));
    }
    // Register a device's Expo push token for remote notifications.
    if (url.pathname === '/api/push/register' && req.method === 'POST') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      const { token } = await readJson(req);
      return send(res, 200, logic.setPushToken(user.id, token));
    }

    if (url.pathname === '/api/orders' && req.method === 'POST') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      const body = await readJson(req);
      try {
        const order = logic.createOrder(user, body);
        return send(res, 201, { order, session: logic.serializeSession(logic.getUserById(user.id)) });
      } catch (e) {
        const known = ['empty_cart', 'outside_zone'];
        return send(res, 400, { error: known.includes(e.message) ? e.message : 'bad_request' });
      }
    }

    // Customer resolves an out-of-stock item (substitute or refund).
    if (
      parts[0] === 'api' && parts[1] === 'orders' && parts[2] &&
      parts[3] === 'items' && parts[4] && parts[5] === 'resolve' && req.method === 'POST'
    ) {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      const owned = logic.getOrder(parts[2], user.id);
      if (!owned) return send(res, 404, { error: 'not_found' });
      const { substituteProductId, refund } = await readJson(req);
      try {
        const order = logic.resolveItem(parts[2], parts[4], { substituteProductId, refund });
        return send(res, 200, order);
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }

    if (parts[0] === 'api' && parts[1] === 'orders' && parts[2] && req.method === 'GET') {
      const user = authUser(req);
      if (!user) return send(res, 401, { error: 'unauthorized' });
      const order = logic.getOrder(parts[2], user.id);
      if (!order) return send(res, 404, { error: 'not_found' });
      return send(res, 200, logic.serializeOrder(order));
    }

    // ── Driver / staff API (protected by staff key) ──
    const staffKeyOk = () =>
      (req.headers['x-staff-key'] || url.searchParams.get('key')) === config.STAFF_KEY;

    if (url.pathname === '/api/driver/orders' && req.method === 'GET') {
      if (!staffKeyOk()) return send(res, 401, { error: 'unauthorized' });
      return send(res, 200, logic.driverOrders());
    }

    if (parts[0] === 'api' && parts[1] === 'driver' && parts[2] === 'orders' && parts[4] === 'accept' && req.method === 'POST') {
      if (!staffKeyOk()) return send(res, 401, { error: 'unauthorized' });
      const { driverName } = await readJson(req);
      try {
        return send(res, 200, logic.acceptOrder(parts[3], driverName));
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }

    if (parts[0] === 'api' && parts[1] === 'driver' && parts[2] === 'orders' && parts[4] === 'status' && req.method === 'POST') {
      if (!staffKeyOk()) return send(res, 401, { error: 'unauthorized' });
      const { status } = await readJson(req);
      try {
        return send(res, 200, logic.setStatus(parts[3], status, { manual: true }));
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }

    // Driver marks a checklist item out of stock.
    if (
      parts[0] === 'api' && parts[1] === 'driver' && parts[2] === 'orders' && parts[3] &&
      parts[4] === 'items' && parts[5] && parts[6] === 'out-of-stock' && req.method === 'POST'
    ) {
      if (!staffKeyOk()) return send(res, 401, { error: 'unauthorized' });
      try {
        return send(res, 200, logic.markItemOutOfStock(parts[3], parts[5]));
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }

    if (url.pathname === '/api/driver/stock' && req.method === 'POST') {
      if (!staffKeyOk()) return send(res, 401, { error: 'unauthorized' });
      const { productId, inStock } = await readJson(req);
      return send(res, 200, logic.setStock(productId, !!inStock));
    }

    // Courier uploads a receipt photo (base64 data URL).
    if (parts[0] === 'api' && parts[1] === 'driver' && parts[2] === 'orders' && parts[4] === 'receipt' && req.method === 'POST') {
      if (!staffKeyOk()) return send(res, 401, { error: 'unauthorized' });
      const { image } = await readJson(req);
      try {
        return send(res, 200, logic.saveReceipt(parts[3], image));
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }

    // ── Restaurant KDS API (no login — the per-vendor link is the key) ──
    if (url.pathname === '/api/kds/orders' && req.method === 'GET') {
      const vendor = url.searchParams.get('vendor');
      if (!vendor) return send(res, 400, { error: 'vendor_required' });
      return send(res, 200, logic.kdsOrders(vendor));
    }
    if (parts[0] === 'api' && parts[1] === 'kds' && parts[2] === 'orders' && parts[4] === 'accept' && req.method === 'POST') {
      return send(res, 200, logic.acceptKitchen(parts[3]));
    }
    if (parts[0] === 'api' && parts[1] === 'kds' && parts[2] === 'orders' && parts[4] === 'reject' && req.method === 'POST') {
      return send(res, 200, logic.rejectKitchen(parts[3]));
    }
    if (url.pathname === '/api/vendors' && req.method === 'GET') {
      return send(res, 200, logic.getVendors());
    }

    // ── Admin command center API (protected by admin key) ──
    const adminKeyOk = () =>
      (req.headers['x-admin-key'] || url.searchParams.get('key')) === config.ADMIN_KEY;

    if (url.pathname === '/api/admin/overview' && req.method === 'GET') {
      if (!adminKeyOk()) return send(res, 401, { error: 'unauthorized' });
      return send(res, 200, {
        orders: logic.adminOrders(),
        vendors: logic.getVendors(),
        fleet: logic.fleet(),
        couriers: logic.getCouriers(),
      });
    }
    if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'orders' && parts[4] === 'reassign' && req.method === 'POST') {
      if (!adminKeyOk()) return send(res, 401, { error: 'unauthorized' });
      try {
        return send(res, 200, logic.reassignOrder(parts[3]));
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'couriers' && parts[4] === 'deposit' && req.method === 'POST') {
      if (!adminKeyOk()) return send(res, 401, { error: 'unauthorized' });
      const { status } = await readJson(req);
      return send(res, 200, logic.setDeposit(parts[3], status));
    }
    if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'orders' && parts[4] === 'cancel' && req.method === 'POST') {
      if (!adminKeyOk()) return send(res, 401, { error: 'unauthorized' });
      try {
        return send(res, 200, logic.cancelOrder(parts[3]));
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'vendors' && parts[4] === 'active' && req.method === 'POST') {
      if (!adminKeyOk()) return send(res, 401, { error: 'unauthorized' });
      const { active } = await readJson(req);
      return send(res, 200, logic.setVendorActive(parts[3], !!active));
    }

    // Static images: uploaded receipts + product photos.
    if (req.method === 'GET' && (url.pathname.startsWith('/receipts/') || url.pathname.startsWith('/products/') || url.pathname.startsWith('/menu/'))) {
      const safe = path.normalize(url.pathname).replace(/^(\.\.[\/\\])+/, '');
      const file = path.join(__dirname, 'public', safe);
      if (fs.existsSync(file)) {
        const ext = path.extname(file).slice(1);
        res.writeHead(200, { 'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}`, 'Access-Control-Allow-Origin': '*' });
        return res.end(fs.readFileSync(file));
      }
      return send(res, 404, { error: 'not_found' });
    }

    // ── Stripe Checkout return pages ──
    if (req.method === 'GET' && (url.pathname === '/pay/success' || url.pathname === '/pay/cancel')) {
      const ok = url.pathname === '/pay/success';
      return send(
        res,
        200,
        `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
        <div style="font-family:system-ui;text-align:center;padding:64px 24px;color:#1A1413;background:#FBF7F1;min-height:100vh">
          <div style="width:72px;height:72px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;background:${ok ? '#9E1B1B' : '#EBE3D8'}">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="${ok ? '#fff' : '#7C736E'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              ${ok ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}
            </svg>
          </div>
          <h1 style="font-weight:800">${ok ? 'Payment complete' : 'Payment canceled'}</h1>
          <p style="color:#7C736E">${ok ? 'Your Blink order is confirmed.' : 'No charge was made.'} You can return to the app.</p>
        </div>`
      );
    }

    // ── Static dashboard pages ──
    if (req.method === 'GET' && url.pathname === '/kds') {
      return send(res, 200, fs.readFileSync(path.join(__dirname, 'public', 'kds.html'), 'utf8'));
    }
    if (req.method === 'GET' && url.pathname === '/admin') {
      return send(res, 200, fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8'));
    }
    if (req.method === 'GET' && (url.pathname === '/driver' || url.pathname === '/store' || url.pathname === '/')) {
      return send(res, 200, fs.readFileSync(path.join(__dirname, 'public', 'driver.html'), 'utf8'));
    }

    return send(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error('Request error:', err);
    return send(res, 500, { error: 'server_error' });
  }
});

// Advance demo orders + run the escalation + courier-dispatch loops.
setInterval(() => {
  try {
    logic.tickAutoOrders();
    logic.escalationTick();
    logic.dispatchTick();
  } catch (e) {
    console.error('tick error', e);
  }
}, 3000);

server.listen(config.PORT, config.HOST, () => {
  console.log(`Blink backend on http://${config.HOST}:${config.PORT}`);
  console.log(`Driver dashboard:  http://localhost:${config.PORT}/driver  (key: ${config.STAFF_KEY})`);
  console.log(`Kitchen KDS:       http://localhost:${config.PORT}/kds?vendor=grill`);
  console.log(`Admin command:     http://localhost:${config.PORT}/admin  (key: ${config.ADMIN_KEY})`);
});
