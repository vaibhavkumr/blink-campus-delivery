'use strict';

// Dependency-free Firebase ID token verification.
// A Firebase ID token is an RS256 JWT signed by Google. Rather than pull in
// the heavy firebase-admin SDK, we verify it ourselves with node:crypto:
//   1. fetch Google's public x509 certs (cached per Cache-Control),
//   2. check the RS256 signature against the cert named by the token's `kid`,
//   3. validate the standard claims (aud / iss / exp / iat / sub).
// This keeps the backend true to its no-dependencies design.

const crypto = require('node:crypto');
const config = require('./config');

const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let certCache = { certs: null, exp: 0 };

async function getCerts() {
  const now = Date.now();
  if (certCache.certs && now < certCache.exp) return certCache.certs;
  const res = await fetch(CERT_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('certs_fetch_failed');
  const certs = await res.json(); // { "<kid>": "-----BEGIN CERTIFICATE-----..." }
  const cc = res.headers.get('cache-control') || '';
  const m = /max-age=(\d+)/.exec(cc);
  const ttl = m ? Number(m[1]) * 1000 : 3600 * 1000;
  certCache = { certs, exp: now + ttl };
  return certs;
}

function b64urlToBuf(s) {
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function b64urlToJson(s) {
  return JSON.parse(b64urlToBuf(s).toString('utf8'));
}

// Verifies the token and returns its decoded payload (including phone_number),
// or throws with a short error code.
async function verifyIdToken(idToken) {
  const projectId = config.FIREBASE.projectId;
  if (!projectId) throw new Error('firebase_not_configured');
  if (!idToken || typeof idToken !== 'string') throw new Error('missing_token');

  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('malformed');
  const [h, p, sig] = parts;

  const header = b64urlToJson(h);
  const payload = b64urlToJson(p);
  if (header.alg !== 'RS256') throw new Error('bad_alg');

  const certs = await getCerts();
  const pem = certs[header.kid];
  if (!pem) throw new Error('unknown_kid');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${h}.${p}`);
  verifier.end();
  if (!verifier.verify(crypto.createPublicKey(pem), b64urlToBuf(sig))) {
    throw new Error('bad_signature');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error('bad_aud');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad_iss');
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('expired');
  if (typeof payload.iat !== 'number' || payload.iat > now + 300) throw new Error('bad_iat');
  if (!payload.sub) throw new Error('no_sub');

  return payload;
}

module.exports = { verifyIdToken };
