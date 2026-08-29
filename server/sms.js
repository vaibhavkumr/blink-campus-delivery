'use strict';

const config = require('./config');

function smsEnabled() {
  const t = config.TWILIO;
  return !!(t.accountSid && t.authToken && t.from);
}

// Send an SMS via the Twilio REST API (no SDK). `to` is a 10-digit US number.
async function sendSms(to, body) {
  if (!smsEnabled()) return { sent: false, reason: 'not_configured' };
  const { accountSid, authToken, from } = config.TWILIO;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: `+1${to}`, From: from, Body: body }).toString(),
        signal: AbortSignal.timeout(10000),
      }
    );
    const j = await res.json();
    return { sent: !!j.sid, error: j.message };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}

module.exports = { smsEnabled, sendSms };
