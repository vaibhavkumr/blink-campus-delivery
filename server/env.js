'use strict';

// Tiny .env loader (no dependency). Reads server/.env and populates
// process.env before config.js reads it. Real env vars always win.
const fs = require('node:fs');
const path = require('node:path');

try {
  const file = path.join(__dirname, '.env');
  if (fs.existsSync(file)) {
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([\w.]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  }
} catch {
  // no .env — fine, use real env vars / defaults
}
