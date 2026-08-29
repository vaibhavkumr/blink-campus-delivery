'use strict';

// Central configuration for the Blink backend.
// Everything money-related is stored and computed in integer cents to
// avoid floating-point drift; dollars are only produced at the API edge.

require('./env'); // load .env into process.env before we read it
const path = require('node:path');

module.exports = {
  PORT: Number(process.env.PORT) || 4010,
  HOST: '0.0.0.0', // bind on all interfaces so phones on the LAN can reach it
  DB_PATH: process.env.BLINK_DB || path.join(__dirname, 'blink.db'),

  // Auth
  TOKEN_SECRET: process.env.BLINK_SECRET || 'blink-dev-secret-change-me',
  TOKEN_TTL_MS: 1000 * 60 * 60 * 24 * 30, // 30 days
  OTP_TTL_MS: 1000 * 60 * 5, // 5 minutes
  DEV_OTP: '123456', // dev bypass code
  // Dev bypass is auto-disabled once real SMS is configured (below).
  DEV_OTP_ENABLED: !(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  ),

  // Firebase phone auth. Set FIREBASE_PROJECT_ID to accept Firebase ID tokens
  // at /api/auth/firebase (the client verifies the SMS code; the server just
  // validates the resulting token's signature). No service-account key needed
  // — verification uses Google's public certs.
  FIREBASE: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
  },

  // SMS verification codes (Twilio). Set these to send real texts.
  TWILIO: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM || '', // your Twilio phone number, e.g. +14025551234
  },

  // Driver / staff dashboard access
  STAFF_KEY: process.env.BLINK_STAFF_KEY || 'blink',

  // Pricing (cents)
  DELIVERY_FEE_CENTS: 299,
  SERVICE_FEE_CENTS: 99, // flat $0.99 service fee
  MARKUP_CENTS: 0, // catalog prices shown as-is (margin comes from fees)
  // Zero-minimum cart: any order allowed, but a small-order fee applies
  // when the subtotal is below the threshold.
  SMALL_ORDER_THRESHOLD_CENTS: 800, // $8.00
  SMALL_ORDER_FEE_CENTS: 199, // $1.99
  TAX_RATE: 0.075,
  WELCOME_BONUS: 200,
  REDEEM_POINTS: 100,
  REDEEM_VALUE_CENTS: 500,
  REFERRAL_CREDIT_CENTS: 500, // "give $5, get $5" — both sides after 1st delivery
  FREE_DELIVERY_THRESHOLD_CENTS: 1500, // "$15 to unlock free delivery"

  // ── Unit economics knobs (all in cents) ─────────────────────────────
  // What the courier is paid per delivery (on top of 100% of the tip).
  // Of the $2.99 delivery fee the customer pays, Blink keeps the difference.
  DRIVER_BASE_PAY_CENTS: 250, // $2.50 to the courier
  // Stripe's processing cut, taken out of each charge (not billed to you).
  STRIPE: {
    pct: 0.029,
    fixedCents: 30,
    // Paste test keys (sk_test_… / pk_test_…) to run real test-mode charges;
    // empty = the fee is modeled but no card is actually charged.
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  },

  // Demo order auto-advance cadence (seconds after placedAt).
  // A driver can accept/advance any order manually, which stops auto-advance.
  // Auto-advance pauses while an order has unresolved out-of-stock items.
  CADENCE: {
    ACCEPTED: 15,
    PICKING: 40,
    OUT_FOR_DELIVERY: 75,
    DELIVERED: 150,
  },

  // Fail-safe escalation for kitchen (restaurant) orders left unaccepted.
  // Values are seconds after placedAt, DEMO-SCALED. Production maps to the
  // spec's minutes: sms1=0, sms2=180 (3m), call=300 (5m), pause=420 (7m).
  ESCALATION: {
    sms2: 20, // second escalation SMS
    call: 40, // Twilio text-to-speech call ("press 1 to confirm")
    pause: 60, // auto-pause the vendor (is_active = false) + alert admin
  },

  // Courier dispatch fallback for orders no courier has claimed. Seconds,
  // DEMO-SCALED (production: broadcast=120 (2m), adminAlert=300 (5m)).
  DISPATCH: {
    broadcast: 20, // re-broadcast a high-priority alert to all on-shift couriers
    adminAlert: 40, // escalate to the admin panel for manual assignment
  },

  // Admin command center access
  ADMIN_KEY: process.env.BLINK_ADMIN_KEY || 'founders',
};
