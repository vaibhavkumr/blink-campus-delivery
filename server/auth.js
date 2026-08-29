'use strict';

const crypto = require('node:crypto');
const config = require('./config');

// Lightweight signed tokens (HMAC-SHA256). Not a full JWT library, but
// tamper-proof and stateless — good enough for this backend. Swap for a
// real JWT/session layer if you move auth to Supabase/Firebase.

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto
    .createHmac('sha256', config.TOKEN_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto
    .createHmac('sha256', config.TOKEN_SECRET)
    .update(body)
    .digest('base64url');
  // constant-time compare
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function makeToken(userId) {
  return sign({ uid: userId, exp: Date.now() + config.TOKEN_TTL_MS });
}

// Generate a 6-digit code. In dev the fixed DEV_OTP is also accepted.
function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function otpMatches(entered, stored) {
  if (config.DEV_OTP_ENABLED && entered === config.DEV_OTP) return true;
  return stored != null && entered === stored;
}

module.exports = { makeToken, verifyToken: verify, generateOtp, otpMatches };
