# ⚡ Blink

Fast campus delivery for Creighton and UNL — snacks and essentials from a
campus-edge gas station, delivered to your dorm. Built with Expo (React
Native), runs on iOS, Android, and web from one codebase. Targeting a
September 1 launch.

## Architecture

Three interconnected components, per the Blink spec:

- **Customer app** — Expo (React Native), one codebase for iOS, Android, web.
- **Backend** — a dependency-free Node.js server with a SQLite database
  (`server/`). Handles auth, catalog, orders, the order state machine, the
  out-of-stock substitution loop, and loyalty. See [server/README.md](server/README.md).
- **Driver dashboard** — a web page for couriers, served by the backend at
  `/driver`: accept orders, shop the item checklist, mark items out of stock,
  and deliver.

The app auto-detects the backend address from the Expo dev host, so the same
build works in the web preview (localhost) and on a physical phone (your PC's
LAN IP) with no configuration.

## Current status (working MVP)

- 📱 Phone sign-up with OTP — dev mode accepts code `123456`; signed tokens
- 🏫 Campus picker (Creighton / UNL) with dorm-level delivery buildings
- 🛍️ Server-driven catalog with categories, live stock flags, and cart
- 🛒 **Zero-minimum cart** — order any size; a $1.99 small-order fee applies
  under $8 with an "add $X more to avoid the fee" nudge
- 💳 **Express checkout** — Apple Pay / Google Pay / card UI (stubbed until
  Stripe keys are added); delivery + service + small-order fees, tax, tips, and
  loyalty redemption all computed and validated **server-side**
- 📦 Live order tracking — Placed → Courier assigned → Shopper shopping →
  Out for delivery → Delivered, polled live
- 🔄 **Out-of-stock substitution loop** — a driver marks an item unavailable,
  the customer is prompted in real time to pick a same-category substitute or
  get a refund; delivery is blocked and totals recompute until it's resolved
- 🧑‍🚀 **Driver dashboard** — order queue, one-tap accept, in-store checklist,
  company-card reminder, out-of-stock buttons, deliver
- ⭐ Loyalty in the database: 200-pt welcome bonus, 1 pt/$1 on delivery,
  100 pts = $5 off, full audit ledger

## Run it (two processes)

```bash
# 1. Backend  (terminal 1)
cd server && node server.js

# 2. App  (terminal 2)
npm install
npm run web      # browser, or
npm start        # then scan the QR with Expo Go on your phone
```

Operational dashboards (served by the backend):

- **Driver** — `http://localhost:4010/driver` (key `blink`)
- **Kitchen (KDS)** — `http://localhost:4010/kds?vendor=grill` (no login)
- **Admin command center** — `http://localhost:4010/admin` (key `founders`)

The backend must be running for the app to work. On a phone, make sure the
phone and PC are on the same Wi-Fi (the app reaches the backend over the LAN).

## Phase 2 (restaurant tier, from the UNL spec)

On top of the gas-station model, the app now supports **cook-to-order
vendors**. A seeded "Late Night Grill" (category **Late Night**) demonstrates:

- **Kitchen Display System** (`/kds?vendor=<id>`) — a per-vendor screen with a
  flashing + audio alarm on new orders and Accept / Reject buttons. Restaurant
  orders are held until the kitchen accepts.
- **Admin command center** (`/admin`) — a live 5-column order kanban with
  cancel/refund, vendor pause/activate toggles, and the courier fleet.
- **Fail-safe escalation** — unaccepted kitchen orders escalate SMS → SMS →
  Twilio call → auto-pause the vendor. SMS/call are stubbed (need Twilio keys);
  the auto-pause is live. Timings are demo-scaled; production uses the spec's
  3 / 5 / 7-minute steps.

## Project layout

```
src/app/               screens (expo-router)
  auth/                phone + OTP sign-in
  (tabs)/              Shop, Orders, Rewards
  cart.tsx             cart + checkout
  order/[id].tsx       live order tracking
src/lib/
  store.tsx            app state + polling
  api.ts               backend API client
  config.ts            backend URL auto-detection
  campuses.ts          campus + building lists
server/                Node backend (see server/README.md)
  server.js            HTTP API
  logic.js             orders, loyalty, out-of-stock loop
  db.js                SQLite schema + seed
  seed-data.js         catalog (replace with real inventory)
  public/driver.html   courier dashboard
supabase/schema.sql    equivalent Postgres schema for managed hosting
```

## Path to production (vs. the Sept 1 roadmap)

Done: customer checkout + zero-minimum cart + small-order fee, order tracking,
out-of-stock substitution loop, driver dashboard, loyalty — all server-backed.

Remaining, and what each needs from you:

1. **Inventory** — replace `server/seed-data.js` `PRODUCTS` with the real
   gas-station catalog (same shape), restart the backend.
2. **Payments** — add Stripe keys; wire Apple Pay / Google Pay via Stripe
   (the checkout UI and server-side totals are already in place).
3. **Auth** — wire an SMS provider (Firebase Phone Auth / Twilio) into
   `/api/auth/request-code`; the token flow is already in place.
4. **Deploy the backend** — Railway / Render / Fly (or migrate to managed
   Postgres using `supabase/schema.sql`).
5. **Push notifications** — FCM/APNs for dispatch + out-of-stock prompts
   (currently the app polls every 3s).
6. **Native driver app** — the `/driver` web dashboard covers the workflow;
   a packaged driver app adds GPS streaming + maps.
7. **Ship** — Apple Developer ($99/yr) + Google Play ($25), build with Expo EAS.
