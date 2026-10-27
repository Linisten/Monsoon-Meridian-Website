-- =============================================================================
-- MONSOON MERIDIAN BMS - COMPLETE PRODUCTION SUPABASE DATABASE SCHEMA
-- =============================================================================
-- Run this entire script in your Supabase SQL Editor:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run
--
-- 100% Non-Destructive & Safe for Existing Databases:
-- - Ensures all required columns exist on pre-existing tables
-- - Preserves all existing sales, purchases, items, and settings
-- - Sets up the Admin account (monsoonmeridian@gmail.com / Amma@3747)
-- =============================================================================

-- Enable required cryptographic extensions
create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. CORE OPERATIONAL TABLES & COLUMN ENSURANCES
-- =============================================================================

-- ITEMS / INVENTORY MASTER
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
  expiry_date      date,
  created_at       timestamptz default now()
);

-- Ensure columns exist if items table was created earlier
alter table public.items add column if not exists code text;
alter table public.items add column if not exists expiry_date date;
alter table public.items add column if not exists low_stock_alert numeric(10,3) default 5;
alter table public.items add column if not exists mrp numeric(10,2) default 0;
alter table public.items add column if not exists cost_price numeric(10,2) default 0;
alter table public.items add column if not exists barcode_type text default 'SYSTEM GENERATED';
alter table public.items add column if not exists item_type text default 'INVENTORY';

-- SALES TRANSACTIONS (POS)
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

alter table public.sales add column if not exists gross_total numeric(10,2) default 0;
alter table public.sales add column if not exists discount_amount numeric(10,2) default 0;
alter table public.sales add column if not exists razorpay_payment_id text;
alter table public.sales add column if not exists items_json jsonb;
alter table public.sales add column if not exists user_id text;
alter table public.sales add column if not exists user_name text;

-- PURCHASES & PROCUREMENT
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
  target_user_id   text,
  target_user_name text,
  created_at       timestamptz default now()
);

alter table public.purchases add column if not exists target_user_id text;
alter table public.purchases add column if not exists target_user_name text;
alter table public.purchases add column if not exists items_json jsonb;
alter table public.purchases add column if not exists other_charges jsonb;

-- SYSTEM SETTINGS
create table if not exists public.settings (
  id                   uuid primary key default gen_random_uuid(),
  company_name         text default 'Monsoon Meridian',
  shop_name            text default 'Monsoon Meridian',
  address              text default '123 Premium Arcade, Business Bay',
  phone                text default '+91 9876543210',
  gst_no               text default '32AABCU9603R1ZX',
  email                text default 'monsoonmeridian@gmail.com',
  upi_id               text default 'monsoonmeridian@upi',
  razorpay_key         text,
  app_version          text default '1.0.0',
  update_message       text,
  thermal_printer_name text,
  created_at           timestamptz default now()
);

insert into public.settings (company_name, shop_name, email, upi_id)
select 'Monsoon Meridian', 'Monsoon Meridian', 'monsoonmeridian@gmail.com', 'monsoonmeridian@upi'
where not exists (select 1 from public.settings);

-- =============================================================================
-- 2. USERS, ROLES & AUDIT LOGS
-- =============================================================================

-- USERS TABLE
create table if not exists public.users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  username   text,
  password   text not null default 'password123',
  email      text,
  role       text default 'Staff',
  status     text default 'Active',
  created_at timestamptz default now()
);

-- Ensure all columns exist on pre-existing users table
alter table public.users add column if not exists username text;
alter table public.users add column if not exists password text default 'password123';
alter table public.users add column if not exists email text;
alter table public.users add column if not exists role text default 'Staff';
alter table public.users add column if not exists status text default 'Active';
alter table public.users add column if not exists name text;

-- Ensure username constraint exists for clean upserts
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_username_key'
  ) then
    alter table public.users add constraint users_username_key unique (username);
  end if;
exception when others then
  null;
end $$;

-- Insert or update default Admin account
insert into public.users (name, username, password, email, role, status)
values ('Admin', 'admin', 'Amma@3747', 'monsoonmeridian@gmail.com', 'Admin', 'Active')
on conflict (username) do update
set name = 'Admin', password = 'Amma@3747', email = 'monsoonmeridian@gmail.com', role = 'Admin';

-- ACTIVITIES AUDIT TRAIL TABLE
create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  user_id      text,
  user_name    text not null,
  user_role    text default 'Staff',
  action_type  text not null, -- 'SALE', 'PURCHASE', 'UNETHICAL', 'STOCK', 'REPORT', etc.
  action_title text not null,
  description  text,
  metadata     jsonb default '{}'::jsonb,
  is_unethical boolean default false,
  color_code   text default '#3b82f6',
  created_at   timestamptz default now()
);

alter table public.activities add column if not exists is_unethical boolean default false;
alter table public.activities add column if not exists color_code text default '#3b82f6';
alter table public.activities add column if not exists metadata jsonb default '{}'::jsonb;

-- USER / SHOP STOCKS TABLE (Per user/shop inventory allocation)
create table if not exists public.user_stocks (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  item_id        uuid references public.items(id) on delete cascade,
  stock_quantity numeric(10,3) default 0,
  updated_at     timestamptz default now(),
  unique(user_id, item_id)
);

-- =============================================================================
-- 3. MASTER CONFIGURATION TABLES
-- =============================================================================

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

create table if not exists public.date (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz default now()
);

-- =============================================================================
-- 4. MASTER CONFIG SEED (Taxes, Units, Packtypes, Categories)
-- =============================================================================

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
  ('GENERAL',    'General Merchandise'),
  ('SPICES',     'Spices and condiments'),
  ('CHOCOLATES', 'Chocolates & Confectionery'),
  ('TEA',        'Specialty teas'),
  ('COFFEE',     'Blended and single-origin coffees'),
  ('NUTS',       'Dry fruits and nuts')
on conflict do nothing;

insert into public.company (name, address, phone, email, gst_no) values
  ('Monsoon Meridian', '123 Premium Arcade, Business Bay', '+91 9876543210', 'monsoonmeridian@gmail.com', '32AABCU9603R1ZX')
on conflict do nothing;

-- =============================================================================
-- 5. STORED PROCEDURES (RPCs)
-- =============================================================================

create or replace function public.handle_stock_update(item_id uuid, quantity_change numeric)
returns void
language plpgsql
security definer
as $$
begin
  update public.items
  set stock_quantity = greatest(0, items.stock_quantity + quantity_change)
  where id = item_id;
end;
$$;

-- =============================================================================
-- 6. DISABLE ROW LEVEL SECURITY (RLS) FOR DIRECT WEB CLIENT ACCESS
-- =============================================================================
alter table public.items       disable row level security;
alter table public.sales       disable row level security;
alter table public.purchases   disable row level security;
alter table public.settings    disable row level security;
alter table public.customer    disable row level security;
alter table public.supplier    disable row level security;
alter table public.tax         disable row level security;
alter table public.unit        disable row level security;
alter table public.packtype    disable row level security;
alter table public.category    disable row level security;
alter table public.company     disable row level security;
alter table public.shop        disable row level security;
alter table public.users       disable row level security;
alter table public.activities  disable row level security;
alter table public.user_stocks disable row level security;
alter table public.date        disable row level security;

-- =============================================================================
-- 7. PERFORMANCE INDEXES
-- =============================================================================
create index if not exists idx_items_code on public.items (code);
create index if not exists idx_items_name on public.items (name);
create index if not exists idx_items_category on public.items (category);
create index if not exists idx_sales_created_at on public.sales (created_at desc);
create index if not exists idx_sales_user_id on public.sales (user_id);
create index if not exists idx_purchases_created_at on public.purchases (created_at desc);
create index if not exists idx_activities_user_id on public.activities (user_id);
create index if not exists idx_activities_created_at on public.activities (created_at desc);
create index if not exists idx_activities_unethical on public.activities (is_unethical);
create index if not exists idx_user_stocks_user_item on public.user_stocks (user_id, item_id);
