# Blink Backend

A dependency-free Node.js backend for the Blink app. Uses only Node
built-ins — `node:http`, `node:sqlite`, `node:crypto` — so there is nothing
to `npm install` and nothing to break. Data lives in a local SQLite file
(`blink.db`), created automatically on first run.

## Run it

```bash
cd server
node server.js
```

- API: `http://localhost:4010`
- Store dashboard: `http://localhost:4010/store` (access key: `npmart`)

Requires Node 22.5+ (for built-in `node:sqlite`; you have v24). The
experimental-SQLite warning on startup is harmless.

## What it does

- **Auth** — phone number → OTP → signed token. Dev code `123456` always
  works; real per-phone codes are generated and stored too (wire an SMS
  provider into `/api/auth/request-code` for production).
- **Catalog** — products + categories, seeded from `seed-data.js`. Replace
  `PRODUCTS` there with the real NPMart inventory (same shape) and restart.
- **Orders** — server computes all totals in cents (never trusts the client),
  runs the state machine, and awards loyalty points on delivery.
- **Loyalty** — 200-pt welcome bonus, 1 pt/$1 earned, 100 pts = $5 off, with a
  full audit ledger. All in the database.
- **Live status** — orders auto-advance on a demo timer; the store dashboard
  can override any order manually (which stops the timer for that order).

## API summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET  | `/api/health` | — | liveness |
| GET  | `/api/catalog` | — | products + categories |
| GET  | `/api/campuses` | — | campuses + buildings |
| POST | `/api/auth/request-code` | — | send OTP `{phone}` |
| POST | `/api/auth/verify` | — | `{phone,code,campusId}` → token + session |
| GET  | `/api/me` | token | current user + points ledger |
| GET  | `/api/orders` | token | your orders |
| POST | `/api/orders` | token | place order |
| GET  | `/api/orders/:id` | token | one order (live status) |
| POST | `/api/orders/:id/items/:itemId/resolve` | token | substitute or refund an out-of-stock item |
| GET  | `/api/driver/orders` | staff key | order queue (dashboard) |
| POST | `/api/driver/orders/:id/accept` | staff key | courier claims an order |
| POST | `/api/driver/orders/:id/status` | staff key | advance an order |
| POST | `/api/driver/orders/:id/items/:itemId/out-of-stock` | staff key | mark item unavailable |
| POST | `/api/driver/stock` | staff key | toggle product availability |

Auth is `Authorization: Bearer <token>`. Driver/staff endpoints use the
`X-Staff-Key` header (or `?key=`), default `blink`.

## Configuration

Everything is in `config.js`, overridable by env vars:
`PORT`, `BLINK_SECRET`, `BLINK_STAFF_KEY`, `BLINK_DB`.

## Files

```
server.js      HTTP server + routing
db.js          SQLite schema + seed
logic.js       orders, loyalty, serialization
auth.js        token signing + OTP
config.js      all tunables
seed-data.js   catalog + campuses (replace with real inventory)
public/driver.html   courier dashboard
```

## Production path

This runs as-is on Railway/Render/Fly (your planned host). To move to
managed Postgres later, the equivalent schema is in `../supabase/schema.sql`;
the query layer in `logic.js` is small and isolated for that swap.
