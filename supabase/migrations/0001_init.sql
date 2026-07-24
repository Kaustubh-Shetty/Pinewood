-- Pinewood schema. Mirrors the same data model as before (Household, Bill,
-- BillShare) — only the storage engine changed, not the shape of the data.

create extension if not exists pgcrypto; -- gen_random_uuid()

-- Pre-approved allow-list. This table is what actually caps how many
-- accounts can ever exist — it's edited once by whoever runs the seed
-- script, never by the app itself. A login is only accepted if the phone
-- number AND email typed in match the same row here.
create table phone_to_flat (
  phone_number text primary key,
  email text not null,
  flat_id text not null unique,
  display_name text not null
);

-- One row per flat, pre-created by the seed script with user_id = null.
-- Claiming a flat is a single atomic UPDATE ... WHERE user_id IS NULL —
-- see supabase/functions/register-household — so there's no race between
-- two people claiming the same flat at once.
create table households (
  flat_id text primary key,
  user_id uuid unique references auth.users(id),
  phone_number text,
  email text,
  display_name text not null,
  upi_vpa text not null default '',
  push_subscription jsonb,
  created_at timestamptz not null default now()
);

create table bills (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('electricity', 'water', 'cleaning', 'other')),
  total_amount_paise bigint not null check (total_amount_paise > 0),
  receipt_url text not null,
  paid_by_flat_id text not null references households(flat_id),
  flat_ids text[] not null,
  bill_date timestamptz not null,
  closed_manually boolean not null default false,
  created_at timestamptz not null default now()
);

create table bill_shares (
  id text primary key, -- `${bill_id}_${flat_id}`
  bill_id uuid not null references bills(id),
  flat_id text not null references households(flat_id),
  share_amount_paise bigint not null check (share_amount_paise > 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'claimed', 'confirmed')),
  proof_url text,
  paid_at timestamptz,
  confirmed_at timestamptz
);

create index bill_shares_bill_id_idx on bill_shares(bill_id);
create index bill_shares_flat_id_idx on bill_shares(flat_id);

-- Row Level Security: same "boring on purpose" call as the Firestore rules —
-- any signed-in registered flat can READ everything (shared dashboard), and
-- nothing can be written directly by a client. All writes go through Edge
-- Functions using the service-role key, which bypasses RLS entirely. This
-- keeps business logic (who can confirm what) living in exactly one place.
alter table households enable row level security;
alter table bills enable row level security;
alter table bill_shares enable row level security;
alter table phone_to_flat enable row level security; -- no policies at all: fully locked to service role

create policy "registered flats can read households" on households
  for select using (auth.jwt() -> 'app_metadata' ->> 'flat_id' is not null);

create policy "registered flats can read bills" on bills
  for select using (auth.jwt() -> 'app_metadata' ->> 'flat_id' is not null);

create policy "registered flats can read bill_shares" on bill_shares
  for select using (auth.jwt() -> 'app_metadata' ->> 'flat_id' is not null);

-- Note: the new-bill push notification trigger is NOT created here.
-- Supabase's Database Webhooks (Dashboard -> Database -> Webhooks) creates
-- its own trigger automatically when you point it at the on-bill-created
-- function — see SETUP.md step 8. That's simpler and less error-prone than
-- hand-writing a pg_net call with a config value that has to be set
-- separately, so this migration deliberately doesn't duplicate it.
