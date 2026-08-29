'use strict';

const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const config = require('./config');
const seed = require('./seed-data');

const db = new DatabaseSync(config.DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  phone         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  campus_id     TEXT NOT NULL,
  points        INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT,
  referred_by   TEXT,          -- user_id of the referrer, once applied
  ref_rewarded  INTEGER NOT NULL DEFAULT 0, -- both sides paid out after 1st delivery
  credit_cents  INTEGER NOT NULL DEFAULT 0, -- referral credit balance
  push_token    TEXT,          -- Expo push token for remote notifications
  created_at    INTEGER NOT NULL
);

-- Group / floor orders: one shared cart many people add to.
CREATE TABLE IF NOT EXISTS group_carts (
  id         TEXT PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,
  host_id    TEXT NOT NULL,
  campus_id  TEXT NOT NULL,
  building   TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'open', -- open | placed
  order_id   TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS group_items (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES group_carts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  user_name  TEXT NOT NULL DEFAULT '',
  product_id TEXT NOT NULL,
  qty        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS points_ledger (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  order_id    TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS otps (
  phone       TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vendors (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  emoji     TEXT NOT NULL DEFAULT '🏪',
  kitchen   INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '🛒',
  image_url   TEXT,
  price_cents INTEGER NOT NULL,
  category    TEXT NOT NULL,
  vendor_id   TEXT NOT NULL DEFAULT 'snackhub',
  in_stock    INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  key   TEXT PRIMARY KEY,
  emoji TEXT NOT NULL,
  sort  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  campus_id          TEXT NOT NULL,
  building           TEXT NOT NULL,
  note               TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'PLACED',
  subtotal_cents     INTEGER NOT NULL,
  delivery_fee_cents INTEGER NOT NULL,
  service_fee_cents  INTEGER NOT NULL DEFAULT 0,
  small_order_fee_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents          INTEGER NOT NULL,
  tip_cents          INTEGER NOT NULL DEFAULT 0,
  discount_cents     INTEGER NOT NULL DEFAULT 0,
  total_cents        INTEGER NOT NULL,
  points_earned      INTEGER NOT NULL DEFAULT 0,
  points_redeemed    INTEGER NOT NULL DEFAULT 0,
  points_awarded     INTEGER NOT NULL DEFAULT 0,
  auto               INTEGER NOT NULL DEFAULT 1,
  driver_id          TEXT,
  driver_name        TEXT,
  -- kitchen_status: n/a | pending | cooking | rejected  (restaurant orders)
  kitchen_status     TEXT NOT NULL DEFAULT 'n/a',
  escalation_level   INTEGER NOT NULL DEFAULT 0,
  dispatch_level     INTEGER NOT NULL DEFAULT 0,
  receipt_path       TEXT,
  paid               INTEGER NOT NULL DEFAULT 1, -- 0 until Stripe Checkout completes
  stripe_session_id  TEXT,
  placed_at          INTEGER NOT NULL,
  accepted_at        INTEGER,
  picking_at         INTEGER,
  out_at             INTEGER,
  delivered_at       INTEGER,
  cancelled_at       INTEGER
);

CREATE TABLE IF NOT EXISTS order_items (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  qty         INTEGER NOT NULL,
  modifier    TEXT NOT NULL DEFAULT '',
  -- item_status: ok | out_of_stock | substituted | refunded
  item_status TEXT NOT NULL DEFAULT 'ok',
  sub_product_id  TEXT,
  sub_name        TEXT,
  sub_emoji       TEXT,
  sub_price_cents INTEGER
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  order_id   TEXT,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  read       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS couriers (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  scooter_deposit_cents INTEGER NOT NULL DEFAULT 0,
  deposit_status       TEXT NOT NULL DEFAULT 'none'
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON points_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);
`);

// ── Seed catalog once (idempotent upsert so re-seeding won't duplicate) ──
function seedCatalog() {
  const upVendor = db.prepare(`
    INSERT INTO vendors (id, name, emoji, kitchen, is_active)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, emoji=excluded.emoji, kitchen=excluded.kitchen
  `);
  for (const v of seed.VENDORS) upVendor.run(v.id, v.name, v.emoji, v.kitchen, v.is_active);

  const upProd = db.prepare(`
    INSERT INTO products (id, name, emoji, image_url, price_cents, category, vendor_id, in_stock, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, emoji=excluded.emoji, image_url=excluded.image_url,
      price_cents=excluded.price_cents, category=excluded.category,
      vendor_id=excluded.vendor_id, sort=excluded.sort
  `);
  for (const p of seed.PRODUCTS) {
    upProd.run(p.id, p.name, p.emoji, p.image_url, p.price_cents, p.category, p.vendor_id, p.in_stock, p.sort);
  }
  const upCat = db.prepare(`
    INSERT INTO categories (key, emoji, sort) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET emoji=excluded.emoji, sort=excluded.sort
  `);
  for (const c of seed.CATEGORIES) upCat.run(c.key, c.emoji, c.sort);

  const upCourier = db.prepare(`
    INSERT INTO couriers (id, name, scooter_deposit_cents, deposit_status)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name
  `);
  for (const c of seed.COURIERS) upCourier.run(c.id, c.name, c.scooter_deposit_cents, c.deposit_status);
}
seedCatalog();

const id = (prefix) => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;

module.exports = { db, id, config };
