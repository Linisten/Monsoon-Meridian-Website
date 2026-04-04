-- ============================================================
-- MONSOON MERIDIAN — Complete Unified Supabase Schema + Seed Data
-- Run this entire file in Supabase SQL Editor
-- (Go to: supabase.com → your project → SQL Editor → New Query)
-- ============================================================

-- ============================================================
-- CORE DATABASES
-- ============================================================

-- 1. ITEMS TABLE
create table if not exists public.items (
  id               uuid primary key default gen_random_uuid(),
  code             text,
  name             text not null,
  category         text default 'GENERAL',
  unit             text default 'NOS',
  pack             text default 'NOS',
  price            numeric(10,2) default 0,
  mrp              numeric(10,2) default 0,
  cost_price       numeric(10,2) default 0,
  stock_quantity   numeric(10,3) default 0,
  low_stock_alert  numeric(10,3) default 5,
  image_url        text,
  tax_category     text,
  is_active        boolean default true,
  barcode_type     text default 'SYSTEM GENERATED',
  item_type        text default 'INVENTORY',
  created_at       timestamptz default now()
);

-- 2. SALES TABLE
create table if not exists public.sales (
  id                  uuid primary key default gen_random_uuid(),
  total_amount        numeric(10,2) not null,
  tax_percent         numeric(10,2) default 0,
  customer_name       text default 'Walk-in Customer',
  gross_total         numeric(10,2) default 0,
  discount_amount     numeric(10,2) default 0,
  payment_method      text default 'CASH',
  razorpay_payment_id text,
  items_json          jsonb,
  created_at          timestamptz default now()
);

-- 3. PURCHASES TABLE
create table if not exists public.purchases (
  id               uuid primary key default gen_random_uuid(),
  supplier         text,
  total_amount     numeric(10,2) not null,
  bill_no          text,
  bill_date        date,
  payment_mode     text default 'Cash',
  reference_no     text,
  tax_type         text default 'Included Tax',
  other_charges    jsonb,
  notes            text,
  items_json       jsonb,
  created_at       timestamptz default now()
);

-- 4. SETTINGS TABLE (one row per shop)
create table if not exists public.settings (
  id               uuid primary key default gen_random_uuid(),
  company_name     text default 'Monsoon Meridian',
  shop_name        text default 'Monsoon Meridian',
  address          text default '123 Premium Arcade, Business Bay',
  phone            text default '+91 9876543210',
  gst_no           text default '32AABCU9603R1ZX',
  email            text default 'info@monsoonmeridian.com',
  upi_id           text default 'monsoonmeridian@upi',
  razorpay_key     text,
  app_version      text default '1.0.0',
  update_message   text,
  created_at       timestamptz default now()
);

-- Insert default settings row (only if table is empty)
insert into public.settings (company_name)
select 'Monsoon Meridian'
where not exists (select 1 from public.settings);

-- ============================================================
-- MASTER TABLES
-- ============================================================

create table if not exists public.customer (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  email      text,
  address    text,
  created_at timestamptz default now()
);

create table if not exists public.supplier (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  contact_person text,
  phone          text,
  gst_no         text,
  address        text,
  created_at     timestamptz default now()
);

create table if not exists public.tax (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  rate_percent numeric(5,2) default 0,
  description  text,
  created_at   timestamptz default now()
);

create table if not exists public.unit (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz default now()
);

create table if not exists public.packtype (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz default now()
);

create table if not exists public.category (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz default now()
);

create table if not exists public.company (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  address      text,
  phone        text,
  email        text,
  gst_no       text,
  created_at   timestamptz default now()
);

create table if not exists public.shop (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  phone      text,
  created_at timestamptz default now()
);

create table if not exists public.users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  role       text default 'Staff',
  created_at timestamptz default now()
);

create table if not exists public.date (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz default now()
);

-- ============================================================
-- DISABLE ROW LEVEL SECURITY (for dev)
-- ============================================================
alter table public.items     disable row level security;
alter table public.sales     disable row level security;
alter table public.purchases disable row level security;
alter table public.settings  disable row level security;
alter table public.customer  disable row level security;
alter table public.supplier  disable row level security;
alter table public.tax       disable row level security;
alter table public.unit      disable row level security;
alter table public.packtype  disable row level security;
alter table public.category  disable row level security;
alter table public.company   disable row level security;
alter table public.shop      disable row level security;
alter table public.users     disable row level security;
alter table public.date      disable row level security;

-- ============================================================
-- SEED DATA
-- ============================================================

insert into public.tax (name, rate_percent, description) values
  ('GST 5%',  5.00,  'Standard goods GST'),
  ('GST 12%', 12.00, 'Processed foods GST'),
  ('GST 18%', 18.00, 'Premium goods GST'),
  ('Zero Rated', 0.00, 'Exempt / Zero rated')
on conflict do nothing;

insert into public.unit (name, description) values
  ('KG',  'Kilogram'),
  ('NOS', 'Number of pieces'),
  ('LTR', 'Litre'),
  ('GMS', 'Grams'),
  ('MTR', 'Metres')
on conflict do nothing;

insert into public.packtype (name, description) values
  ('Loose',    'Loose / bulk packed'),
  ('Box',      'Carton / box packed'),
  ('Pouch',    'Sealed pouch'),
  ('Jar',      'Glass or plastic jar'),
  ('Tin',      'Metal tin')
on conflict do nothing;

insert into public.category (name, description) values
  ('SPICES',     'Premium spices and condiments'),
  ('CHOCOLATES', 'Artisan and imported chocolates'),
  ('TEA',        'Specialty teas'),
  ('COFFEE',     'Single-origin and blended coffees'),
  ('NUTS',       'Dry fruits and premium nuts')
on conflict do nothing;

insert into public.company (name, address, phone, email, gst_no) values
  ('Monsoon Meridian', '123 Premium Arcade, Business Bay', '+91 9876543210', 'info@monsoonmeridian.com', '32AABCU9603R1ZX')
on conflict do nothing;

insert into public.items (code, name, category, pack, price, stock_quantity, low_stock_alert) values
  ('SP-001', 'Kerala Cardamom (8mm)',      'SPICES',     'KG',  2800, 10,  3),
  ('SP-002', 'Ceylon Cinnamon Quills',     'SPICES',     'KG',  1500, 25,  5),
  ('SP-003', 'Tellicherry Black Pepper',   'SPICES',     'KG',   850, 50, 10),
  ('SP-004', 'Clove Premium',              'SPICES',     'KG',  1200, 15,  3),
  ('SP-005', 'Kashmiri Saffron',           'SPICES',     'NOS',  300,100, 20),
  ('SP-006', 'Star Anise',                 'SPICES',     'KG',   600, 30,  5),
  ('CH-001', 'Dark Truffle 70%',           'CHOCOLATES', 'NOS',  450, 40, 10),
  ('CH-002', 'Belgian Hazelnut Praline',   'CHOCOLATES', 'NOS',  650, 30,  5),
  ('CH-003', 'Milk Cocoa Bar',             'CHOCOLATES', 'NOS',  120,150, 20),
  ('CH-004', 'White Ivory Chocolate',      'CHOCOLATES', 'NOS',  250, 20,  5),
  ('CH-005', 'Dark Bitter 85%',            'CHOCOLATES', 'NOS',  380, 35,  8),
  ('TE-001', 'Darjeeling First Flush',     'TEA',        'KG',  1200, 15,  3),
  ('TE-002', 'Assam CTC Premium',          'TEA',        'KG',   450, 40,  8),
  ('TE-003', 'Kashmiri Kahwa Mix',         'TEA',        'NOS',  380, 25,  5),
  ('CF-001', 'Arabica Roasted Beans',      'COFFEE',     'KG',   900, 40,  8),
  ('CF-002', 'Robusta Espresso Blend',     'COFFEE',     'KG',   600, 30,  5),
  ('NT-001', 'Premium Cashew W240',        'NUTS',       'KG',   800, 20,  4),
  ('NT-002', 'California Almonds',         'NUTS',       'KG',   950, 25,  5)
on conflict do nothing;
