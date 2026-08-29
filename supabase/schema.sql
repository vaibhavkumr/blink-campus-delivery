-- NPDash — Supabase schema
-- Run this in the Supabase SQL editor once the (free) project is created.
-- Enables PostGIS for campus geofences.

create extension if not exists postgis;

-- ── Users ────────────────────────────────────────────────────────────
-- Supabase auth.users holds credentials; this table holds app profile.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  phone text unique not null,
  name text default '',
  campus_id text not null check (campus_id in ('creighton', 'unl')),
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now()
);

-- ── Loyalty ledger ───────────────────────────────────────────────────
create table points_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles on delete cascade,
  delta integer not null,
  reason text not null,
  order_id uuid,
  created_at timestamptz not null default now()
);

-- ── Catalog ──────────────────────────────────────────────────────────
create table products (
  id text primary key,
  name text not null,
  emoji text not null default '🛒',
  image_url text,
  price_cents integer not null check (price_cents > 0),
  category text not null,
  in_stock boolean not null default true,
  sort integer not null default 0
);

-- ── Campuses & geofences ─────────────────────────────────────────────
create table campuses (
  id text primary key,
  name text not null,
  city text not null,
  -- delivery zone polygon; point-in-polygon checked with ST_Contains
  zone geography(polygon, 4326),
  store_lat double precision,
  store_lng double precision,
  open_hour smallint not null default 10,
  close_hour smallint not null default 2
);

create table buildings (
  id bigint generated always as identity primary key,
  campus_id text not null references campuses,
  name text not null,
  lat double precision,
  lng double precision
);

insert into campuses (id, name, city) values
  ('creighton', 'Creighton University', 'Omaha'),
  ('unl', 'University of Nebraska–Lincoln', 'Lincoln');

-- ── Orders ───────────────────────────────────────────────────────────
create type order_status as enum
  ('PLACED', 'ACCEPTED', 'PICKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles,
  campus_id text not null references campuses,
  building text not null,
  note text default '',
  status order_status not null default 'PLACED',
  subtotal_cents integer not null,
  delivery_fee_cents integer not null,
  tax_cents integer not null,
  tip_cents integer not null default 0,
  discount_cents integer not null default 0,
  total_cents integer not null,
  points_earned integer not null default 0,
  points_redeemed integer not null default 0,
  stripe_payment_intent text,
  driver_id uuid,
  placed_at timestamptz not null default now(),
  accepted_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);

create table order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders on delete cascade,
  product_id text not null references products,
  name text not null,
  price_cents integer not null,
  qty integer not null check (qty > 0),
  fulfilled boolean not null default true -- false = out of stock at pick time
);

-- ── Drivers ──────────────────────────────────────────────────────────
create table drivers (
  id uuid primary key references auth.users,
  name text not null,
  campus_id text not null references campuses,
  active boolean not null default false,
  lat double precision,
  lng double precision,
  updated_at timestamptz not null default now()
);

create index orders_user_idx on orders (user_id, placed_at desc);
create index orders_active_idx on orders (campus_id, status)
  where status not in ('DELIVERED', 'CANCELLED');

-- ── Row Level Security ───────────────────────────────────────────────
alter table profiles enable row level security;
alter table points_ledger enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table products enable row level security;
alter table campuses enable row level security;
alter table buildings enable row level security;

create policy "own profile" on profiles
  for select using (auth.uid() = id);
create policy "own ledger" on points_ledger
  for select using (auth.uid() = user_id);
create policy "own orders" on orders
  for select using (auth.uid() = user_id);
create policy "own order items" on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
  );
create policy "catalog is public" on products for select using (true);
create policy "campuses are public" on campuses for select using (true);
create policy "buildings are public" on buildings for select using (true);

-- Writes (placing orders, status changes, points) go through edge
-- functions using the service role, so no insert/update policies here.

-- ── Geofence check helper ────────────────────────────────────────────
create or replace function point_in_zone(campus text, lat double precision, lng double precision)
returns boolean
language sql stable as $$
  select coalesce(
    st_contains(zone::geometry, st_setsrid(st_makepoint(lng, lat), 4326)),
    false
  )
  from campuses where id = campus;
$$;
