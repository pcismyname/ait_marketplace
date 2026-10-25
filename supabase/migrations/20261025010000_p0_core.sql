-- ═══════════════════════════════════════════════════════════════════════════
-- Pass It On — P0 core schema
--
-- Source of truth for every rule implemented here: docs/BusinessRules.md.
-- Contract for app code: docs/Database.md.
--
-- What this migration adds on top of 20261025000000_remote_baseline.sql:
--   * users.is_admin + public.is_admin(), profile auto-creation, @ait.asia
--     enforcement on auth.users
--   * rentals: the full §4 state machine (+ declined / cancelled), owner_id,
--     fee columns, every timestamp the rules need, late / settlement columns
--   * transactions (sales, in person or protected), disputes (+ comments),
--     wallet_ledger (simulated money), notifications
--   * fee maths in SQL that matches lib/fees.ts exactly (JS rounding)
--   * SECURITY DEFINER RPCs for every money / state transition; clients can't
--     write money or state columns directly
--   * run_escrow_jobs(): payouts, auto-release, overdue / missing, reminders
--   * storage buckets, browse indexes + full-text search, realtime, RLS
--
-- All money is simulated (BusinessRules §7): no gateway, only state changes
-- and ledger rows.
-- ═══════════════════════════════════════════════════════════════════════════

-- Internal helpers live in `private`, which the API roles can't see.
create schema if not exists private;
revoke all on schema private from public;
alter default privileges in schema private revoke execute on functions from public;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Shared helpers
-- ───────────────────────────────────────────────────────────────────────────

-- JavaScript Math.round for double precision (ties go up, like JS). Postgres
-- round(float8) rounds ties to even, so it can't be used for parity.
create or replace function private.js_round(x double precision)
returns double precision
language sql immutable strict parallel safe
set search_path = ''
as $$
  select case when x - floor(x) >= 0.5 then floor(x) + 1 else floor(x) end
$$;

-- Rental period length in days (lib/fees.ts rentalPeriodDays; unknown = semester).
create or replace function private.period_days(p_rental_period text)
returns integer
language sql immutable parallel safe
set search_path = ''
as $$
  select case p_rental_period
    when 'per week' then 7
    when 'per month' then 30
    else 120
  end
$$;

-- The calling user's id (text, like every id in this schema) or an error.
create or replace function private.require_uid()
returns text
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid text := (select auth.uid())::text;
begin
  if v_uid is null then
    raise exception 'You need to be logged in to do that.' using errcode = '28000';
  end if;
  return v_uid;
end
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Users: admin flag, extra profile fields, auto-created profiles
-- ───────────────────────────────────────────────────────────────────────────

alter table public.users
  add column if not exists is_admin boolean not null default false,
  add column if not exists pickup_location text,
  add column if not exists role_intents text[] not null default '{}',
  add column if not exists arrival_date date,
  add column if not exists departure_date date,
  add column if not exists onboarded_at timestamptz;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select u.is_admin from public.users u where u.id = (select auth.uid())::text),
    false
  )
$$;
comment on function public.is_admin() is 'True when the calling user is a platform admin (users.is_admin).';

-- Clients may edit their own profile, but never is_admin, rating or
-- reviews_count, and the email always mirrors the auth email.
create or replace function private.guard_user_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.rating := 0;
      new.reviews_count := 0;
    else
      new.id := old.id;
      new.is_admin := old.is_admin;
      new.rating := old.rating;
      new.reviews_count := old.reviews_count;
    end if;
    new.email := coalesce((select auth.jwt()) ->> 'email', new.email);
  end if;
  return new;
end
$$;

drop trigger if exists users_guard_columns on public.users;
create trigger users_guard_columns
  before insert or update on public.users
  for each row execute function private.guard_user_columns();

-- A profile row for every auth user, so foreign keys to users never fail
-- before onboarding. Onboarding then fills in the details.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.users (id, name, email, program, batch)
  values (
    new.id::text,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1), 'AIT member'),
    new.email,
    nullif(new.raw_user_meta_data ->> 'program', ''),
    nullif(new.raw_user_meta_data ->> 'batch', '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function private.sync_auth_email()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.users set email = new.email where id = new.id::text;
  return new;
end
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (new.email is distinct from old.email)
  execute function private.sync_auth_email();

-- Backfill profiles for auth users that never finished onboarding.
insert into public.users (id, name, email)
select au.id::text, coalesce(nullif(au.raw_user_meta_data ->> 'name', ''), split_part(au.email, '@', 1), 'AIT member'), au.email
from auth.users au
where not exists (select 1 from public.users u where u.id = au.id::text)
on conflict (id) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. @ait.asia only, enforced server-side (BusinessRules §1: closed community)
-- ───────────────────────────────────────────────────────────────────────────

create or replace function private.is_ait_email(p_email text)
returns boolean
language sql immutable parallel safe
set search_path = ''
as $$
  select p_email is not null and lower(p_email) ~ '^[^@[:space:]]+@ait\.asia$'
$$;

-- Hard guarantee: no auth user can be created with, or changed to, another
-- domain. GoTrue reports trigger errors as "Database error saving new user",
-- so the hook below gives the friendly message where it's enabled.
create or replace function private.enforce_ait_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then
    return new;
  end if;
  if not private.is_ait_email(new.email) then
    raise exception 'Pass It On is only open to @ait.asia email addresses.'
      using errcode = 'check_violation',
            hint = 'Sign up with your AIT email (for example st123456@ait.asia).';
  end if;
  return new;
end
$$;

drop trigger if exists enforce_ait_email on auth.users;
create trigger enforce_ait_email
  before insert or update of email on auth.users
  for each row execute function private.enforce_ait_email();

-- Auth "before user created" hook: same rule, but GoTrue shows this message
-- to the client. Enabled locally in supabase/config.toml; on production
-- enable it under Authentication → Hooks (see docs/Database.md).
create or replace function private.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
begin
  if private.is_ait_email(event -> 'user' ->> 'email') then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Pass It On is only open to @ait.asia email addresses.'
  ));
end
$$;

grant usage on schema private to supabase_auth_admin;
grant execute on function private.hook_before_user_created(jsonb) to supabase_auth_admin;
grant execute on function private.is_ait_email(text) to supabase_auth_admin;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Listings: browse indexes, full-text search, extra columns, guards
-- ───────────────────────────────────────────────────────────────────────────

alter table public.listings
  add column if not exists replacement_value numeric,
  add column if not exists featured_until timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(category, '') || ' ' || coalesce(pickup_location, '')), 'C')
  ) stored;

alter table public.listings alter column id set default gen_random_uuid()::text;
alter table public.listings alter column created_at set default now();

create index if not exists listings_category_idx on public.listings (category);
create index if not exists listings_type_idx on public.listings (type);
create index if not exists listings_status_idx on public.listings (status);
create index if not exists listings_created_at_idx on public.listings (created_at desc);
create index if not exists listings_seller_id_idx on public.listings (seller_id);
create index if not exists listings_search_idx on public.listings using gin (search);

drop trigger if exists listings_touch_updated_at on public.listings;
create trigger listings_touch_updated_at
  before update on public.listings
  for each row execute function private.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Rentals: §4 state machine
-- ───────────────────────────────────────────────────────────────────────────

alter table public.rentals drop constraint if exists rentals_phase_check;
alter table public.rentals add constraint rentals_phase_check check (phase = any (array[
  'requested', 'approved', 'declined', 'cancelled', 'paid', 'active',
  'return-pending', 'released', 'disputed', 'resolved', 'overdue', 'missing'
]));

alter table public.rentals
  add column if not exists owner_id text references public.users(id) on delete cascade,
  add column if not exists rental_period text,
  add column if not exists period_days integer,
  add column if not exists rental_fee numeric,
  add column if not exists commission numeric,
  add column if not exists escrow_fee numeric,
  add column if not exists total_paid numeric,
  add column if not exists request_message text,
  add column if not exists decline_reason text,
  add column if not exists cancelled_by text references public.users(id) on delete set null,
  add column if not exists handover_confirmed_by text references public.users(id) on delete set null,
  add column if not exists requested_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists handover_at timestamptz,
  add column if not exists payout_at timestamptz,
  add column if not exists payout_released_at timestamptz,
  add column if not exists overdue_at timestamptz,
  add column if not exists returned_at timestamptz,
  add column if not exists dispute_window_ends_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists late_days integer not null default 0,
  add column if not exists late_fee numeric not null default 0,
  add column if not exists deposit_to_owner numeric,
  add column if not exists deposit_to_renter numeric,
  add column if not exists handover_photos text[] not null default '{}',
  add column if not exists return_photos text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

alter table public.rentals alter column id set default gen_random_uuid()::text;
alter table public.rentals alter column created_at set default now();

-- Backfill rows written before this migration (the old 4-phase model, where
-- a booking was paid and handed over at once).
update public.rentals r
set owner_id = l.seller_id,
    rental_period = coalesce(r.rental_period, l.rental_period),
    period_days = coalesce(r.period_days, private.period_days(l.rental_period)),
    rental_fee = coalesce(r.rental_fee, (r.quote ->> 'rentalFee')::numeric, l.price),
    commission = coalesce(r.commission, (r.quote ->> 'commission')::numeric),
    escrow_fee = coalesce(r.escrow_fee, (r.quote ->> 'handlingFee')::numeric),
    total_paid = coalesce(r.total_paid, (r.quote ->> 'totalDueNow')::numeric),
    requested_at = coalesce(r.requested_at, r.created_at, r.start_date),
    approved_at = coalesce(r.approved_at, r.created_at, r.start_date),
    paid_at = coalesce(r.paid_at, r.start_date),
    handover_at = coalesce(r.handover_at, r.start_date),
    payout_at = coalesce(r.payout_at, r.start_date + interval '48 hours'),
    -- Legacy payouts are treated as already settled (no ledger history exists).
    payout_released_at = coalesce(r.payout_released_at, r.start_date + interval '48 hours'),
    returned_at = case when r.phase in ('return-pending', 'released', 'disputed')
                       then coalesce(r.returned_at, now()) else r.returned_at end,
    dispute_window_ends_at = case when r.phase in ('return-pending', 'disputed')
                                  then coalesce(r.dispute_window_ends_at, now() + interval '48 hours')
                                  else r.dispute_window_ends_at end,
    released_at = case when r.phase = 'released' then coalesce(r.released_at, now()) else r.released_at end,
    deposit_to_owner = case when r.phase = 'released' then coalesce(r.deposit_to_owner, 0) else r.deposit_to_owner end,
    deposit_to_renter = case when r.phase = 'released' then coalesce(r.deposit_to_renter, r.deposit) else r.deposit_to_renter end
from public.listings l
where l.id = r.listing_id and r.owner_id is null;

alter table public.rentals alter column owner_id set not null;
alter table public.rentals alter column period_days set default 120;
update public.rentals set period_days = 120 where period_days is null;
alter table public.rentals alter column period_days set not null;
alter table public.rentals alter column requested_at set default now();
update public.rentals set requested_at = coalesce(created_at, now()) where requested_at is null;
alter table public.rentals alter column requested_at set not null;

create index if not exists rentals_listing_id_idx on public.rentals (listing_id);
create index if not exists rentals_renter_id_idx on public.rentals (renter_id);
create index if not exists rentals_owner_id_idx on public.rentals (owner_id);
create index if not exists rentals_phase_idx on public.rentals (phase);

drop trigger if exists rentals_touch_updated_at on public.rentals;
create trigger rentals_touch_updated_at
  before update on public.rentals
  for each row execute function private.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Transactions (sales). In person: no escrow, no dispute. Protected:
--    paid → handed-over → (48 h) released | disputed → resolved.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.transactions (
  id text primary key default gen_random_uuid()::text,
  listing_id text not null references public.listings(id) on delete cascade,
  buyer_id text references public.users(id) on delete cascade,
  seller_id text not null references public.users(id) on delete cascade,
  mode text not null check (mode in ('in-person', 'protected')),
  price numeric not null check (price >= 0),
  protection_fee numeric not null default 0 check (protection_fee >= 0),
  total numeric not null check (total >= 0),
  payment_method text check (payment_method in ('promptpay', 'card', 'wallet')),
  status text not null check (status in (
    'pending', 'paid', 'handed-over', 'disputed', 'released', 'resolved', 'completed', 'cancelled'
  )),
  note text,
  refund_to_buyer numeric not null default 0,
  seller_amount numeric,
  handover_photos text[] not null default '{}',
  cancelled_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  handover_at timestamptz,
  dispute_window_ends_at timestamptz,
  released_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint transactions_mode_states check (
    (mode = 'in-person' and protection_fee = 0 and status in ('pending', 'completed', 'cancelled'))
    or (mode = 'protected' and buyer_id is not null and payment_method is not null
        and status in ('paid', 'handed-over', 'disputed', 'released', 'resolved'))
  )
);

create index if not exists transactions_listing_id_idx on public.transactions (listing_id);
create index if not exists transactions_buyer_id_idx on public.transactions (buyer_id);
create index if not exists transactions_seller_id_idx on public.transactions (seller_id);
create index if not exists transactions_status_idx on public.transactions (status);

drop trigger if exists transactions_touch_updated_at on public.transactions;
create trigger transactions_touch_updated_at
  before update on public.transactions
  for each row execute function private.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Disputes + comments (BusinessRules §6)
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.disputes (
  id text primary key default gen_random_uuid()::text,
  rental_id text references public.rentals(id) on delete cascade,
  transaction_id text references public.transactions(id) on delete cascade,
  filed_by text not null references public.users(id) on delete cascade,
  against_id text not null references public.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 2 and 200),
  description text not null default '',
  evidence text[] not null default '{}',
  claim_amount numeric check (claim_amount is null or claim_amount >= 0),
  status text not null default 'open' check (status in ('open', 'resolved')),
  finding text check (finding in ('normal-wear', 'repairable-damage', 'lost-or-destroyed', 'not-as-described')),
  resolution_amount numeric,
  deposit_to_owner numeric,
  deposit_to_renter numeric,
  refund_to_buyer numeric,
  seller_amount numeric,
  resolution_note text,
  resolved_by text references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disputes_one_subject check (num_nonnulls(rental_id, transaction_id) = 1),
  constraint disputes_resolution check ((status = 'resolved') = (finding is not null and resolved_at is not null))
);

create unique index if not exists disputes_one_open_per_rental on public.disputes (rental_id) where status = 'open';
create unique index if not exists disputes_one_open_per_transaction on public.disputes (transaction_id) where status = 'open';
create index if not exists disputes_status_idx on public.disputes (status, created_at desc);

drop trigger if exists disputes_touch_updated_at on public.disputes;
create trigger disputes_touch_updated_at
  before update on public.disputes
  for each row execute function private.touch_updated_at();

create table if not exists public.dispute_comments (
  id text primary key default gen_random_uuid()::text,
  dispute_id text not null references public.disputes(id) on delete cascade,
  author_id text not null default (auth.uid())::text references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  attachments text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists dispute_comments_dispute_idx on public.dispute_comments (dispute_id, created_at);

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Wallet ledger (simulated money, BusinessRules §7)
--
--   bucket  held      money the platform holds for this user (deposits, payouts not yet released)
--           available money in the user's in-app wallet
--           external  paid in from PromptPay / card (history only, not a balance)
--           platform  platform revenue (user_id is null)
--   amount  signed: + credits the bucket, − debits it
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.wallet_ledger (
  id text primary key default gen_random_uuid()::text,
  user_id text references public.users(id) on delete cascade,
  rental_id text references public.rentals(id) on delete set null,
  transaction_id text references public.transactions(id) on delete set null,
  dispute_id text references public.disputes(id) on delete set null,
  kind text not null check (kind in (
    'payment', 'hold', 'hold_release', 'payout', 'refund', 'claim', 'platform_fee', 'withdrawal'
  )),
  bucket text not null check (bucket in ('held', 'available', 'external', 'platform')),
  amount numeric not null,
  payment_method text check (payment_method in ('promptpay', 'card', 'wallet')),
  memo text not null default '',
  created_at timestamptz not null default now(),
  constraint wallet_ledger_platform_rows check ((bucket = 'platform') = (user_id is null))
);
create index if not exists wallet_ledger_user_idx on public.wallet_ledger (user_id, created_at desc);
create index if not exists wallet_ledger_rental_idx on public.wallet_ledger (rental_id);
create index if not exists wallet_ledger_transaction_idx on public.wallet_ledger (transaction_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 9. Notifications (in-app only)
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  -- Set for notifications that must not repeat (reminders) or that collapse
  -- (one unread "new message" per thread).
  dedupe_key text,
  created_at timestamptz not null default now(),
  constraint notifications_dedupe unique (user_id, dedupe_key)
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- 10. Chat: creator column, read markers
-- ───────────────────────────────────────────────────────────────────────────

alter table public.threads
  add column if not exists created_by text references public.users(id) on delete set null;
alter table public.threads alter column id set default gen_random_uuid()::text;
alter table public.threads alter column created_at set default now();
alter table public.thread_participants
  add column if not exists last_read_at timestamptz;
alter table public.messages alter column id set default gen_random_uuid()::text;
alter table public.messages alter column created_at set default now();

create index if not exists thread_participants_user_idx on public.thread_participants (user_id);
create index if not exists messages_thread_idx on public.messages (thread_id, created_at);
create index if not exists threads_listing_idx on public.threads (listing_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 11. Reviews: tie them to a finished deal
-- ───────────────────────────────────────────────────────────────────────────

alter table public.reviews
  add column if not exists subject_id text references public.users(id) on delete cascade,
  add column if not exists rental_id text references public.rentals(id) on delete set null,
  add column if not exists transaction_id text references public.transactions(id) on delete set null;
alter table public.reviews alter column id set default gen_random_uuid()::text;
alter table public.reviews drop constraint if exists reviews_role_check;
alter table public.reviews add constraint reviews_role_check
  check (role = any (array['buyer', 'seller', 'renter', 'owner']));

update public.reviews rv set subject_id = l.seller_id
from public.listings l
where l.id = rv.listing_id and rv.subject_id is null;

create unique index if not exists reviews_one_per_rental on public.reviews (author_id, rental_id) where rental_id is not null;
create unique index if not exists reviews_one_per_transaction on public.reviews (author_id, transaction_id) where transaction_id is not null;
create index if not exists reviews_subject_idx on public.reviews (subject_id);

alter table public.needs alter column id set default gen_random_uuid()::text;
alter table public.listing_history alter column id set default gen_random_uuid()::text;

-- ───────────────────────────────────────────────────────────────────────────
-- 12. RLS helper predicates (SECURITY DEFINER so policies don't recurse)
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.is_thread_participant(p_thread_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.thread_participants tp
    where tp.thread_id = p_thread_id and tp.user_id = (select auth.uid())::text
  )
$$;

create or replace function public.is_rental_party(p_rental_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rentals r
    where r.id = p_rental_id and (select auth.uid())::text in (r.renter_id, r.owner_id)
  )
$$;

create or replace function public.is_transaction_party(p_transaction_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.transactions t
    where t.id = p_transaction_id and (select auth.uid())::text in (t.buyer_id, t.seller_id)
  )
$$;

create or replace function public.is_dispute_party(p_dispute_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.disputes d
    where d.id = p_dispute_id
      and (
        (d.rental_id is not null and public.is_rental_party(d.rental_id))
        or (d.transaction_id is not null and public.is_transaction_party(d.transaction_id))
      )
  )
$$;

-- Evidence / condition photos live at
--   dispute-evidence/rental/<rental_id>/<uploader uid>/<file>
--   dispute-evidence/sale/<transaction_id>/<uploader uid>/<file>
create or replace function public.can_read_evidence(p_name text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_admin()
    or (split_part(p_name, '/', 1) = 'rental' and public.is_rental_party(split_part(p_name, '/', 2)))
    or (split_part(p_name, '/', 1) = 'sale' and public.is_transaction_party(split_part(p_name, '/', 2)))
$$;

create or replace function public.can_write_evidence(p_name text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select split_part(p_name, '/', 3) = (select auth.uid())::text
    and (
      (split_part(p_name, '/', 1) = 'rental' and public.is_rental_party(split_part(p_name, '/', 2)))
      or (split_part(p_name, '/', 1) = 'sale' and public.is_transaction_party(split_part(p_name, '/', 2)))
    )
$$;

-- True when a listing has a booking or protected sale in progress. Used by
-- the listing guard: such a listing's status is driven by the RPCs only.
create or replace function public.listing_has_open_deal(p_listing_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rentals r
    where r.listing_id = p_listing_id
      and r.phase in ('approved', 'paid', 'active', 'return-pending', 'disputed', 'overdue')
  ) or exists (
    select 1 from public.transactions t
    where t.listing_id = p_listing_id and t.status in ('paid', 'handed-over', 'disputed')
  )
$$;

create or replace function public.listing_has_history(p_listing_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rentals r
    where r.listing_id = p_listing_id and r.phase not in ('requested', 'declined', 'cancelled')
  ) or exists (
    select 1 from public.transactions t
    where t.listing_id = p_listing_id and t.status not in ('pending', 'cancelled')
  )
$$;

-- Listing guard (clients only; the RPCs run as the table owner):
--   * the seller can't be changed
--   * rentals need a deposit of ฿200–฿3,000 (BusinessRules §3), price > 0
--   * 'rented' is set by pay_rental only, and a listing with a deal in
--     progress can't change status by hand
--   * listings with money history can't be deleted (pause them instead)
create or replace function private.guard_listing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if public.listing_has_history(old.id) then
      raise exception 'This listing has rental or sale history, so it can''t be deleted. Pause it instead.';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and new.seller_id is distinct from old.seller_id then
    raise exception 'A listing''s seller can''t be changed.';
  end if;

  if tg_op = 'INSERT' or new.type is distinct from old.type or new.deposit is distinct from old.deposit
     or new.price is distinct from old.price then
    if new.price is null or new.price <= 0 then
      raise exception 'The price must be more than ฿0.';
    end if;
    if new.type = 'rent' and (new.deposit is null or new.deposit < 200 or new.deposit > 3000) then
      raise exception 'A rental needs a deposit between ฿200 and ฿3,000.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('available', 'paused') then
      raise exception 'A new listing starts as available or paused.';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if public.listing_has_open_deal(old.id) then
      raise exception 'This listing has a booking or protected sale in progress; its status changes automatically.';
    end if;
    if new.status = 'rented' then
      raise exception 'A listing becomes rented only when a booking is paid.';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists listings_guard on public.listings;
create trigger listings_guard
  before insert or update or delete on public.listings
  for each row execute function private.guard_listing();

-- ───────────────────────────────────────────────────────────────────────────
-- 13. Fee maths (BusinessRules §2) — must equal lib/fees.ts to the baht.
--     Computed in double precision with JS rounding, like the TypeScript.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.quote_rental(p_price numeric, p_deposit numeric default null)
returns jsonb
language plpgsql immutable
security definer
set search_path = public
as $$
declare
  v_fee double precision := p_price::double precision;
  v_deposit double precision := coalesce(p_deposit, 0)::double precision;
  v_commission double precision;
  v_handling double precision;
  v_platform double precision;
begin
  if p_price is null or p_price < 0 then
    raise exception 'The rental price must be zero or more.';
  end if;
  if v_deposit < 0 then
    raise exception 'The deposit must be zero or more.';
  end if;
  v_commission := private.js_round(v_fee * 0.1::double precision);
  v_handling := greatest(30::double precision, private.js_round(v_deposit * 0.03::double precision));
  v_platform := v_commission + v_handling;
  return jsonb_build_object(
    'rentalFee', v_fee,
    'commission', v_commission,
    'handlingFee', v_handling,
    'deposit', v_deposit,
    'platformFees', v_platform,
    'totalDueNow', v_fee + v_platform + v_deposit,
    'refundable', v_deposit
  );
end
$$;
comment on function public.quote_rental(numeric, numeric) is
  'Rental quote, same shape and numbers as computeRentalQuote in lib/fees.ts.';

create or replace function public.quote_sale(p_price numeric, p_mode text)
returns jsonb
language plpgsql immutable
security definer
set search_path = public
as $$
declare
  v_price double precision := p_price::double precision;
  v_fee double precision := 0;
begin
  if p_price is null or p_price < 0 then
    raise exception 'The price must be zero or more.';
  end if;
  if p_mode not in ('in-person', 'protected') then
    raise exception 'Unknown payment mode "%": use in-person or protected.', p_mode;
  end if;
  if p_mode = 'protected' then
    v_fee := 10 + private.js_round(v_price * 0.03::double precision);
  end if;
  return jsonb_build_object(
    'mode', p_mode,
    'price', v_price,
    'protectionFee', v_fee,
    'total', v_price + v_fee,
    'escrow', p_mode = 'protected'
  );
end
$$;
comment on function public.quote_sale(numeric, text) is
  'Sale quote, same shape and numbers as computeSaleQuote in lib/fees.ts.';

-- Days late (part days count as a day) and the capped late fee
-- (lib/fees.ts daysLate, dailyLateFee, lateReturnSettlement).
create or replace function private.late_settlement(
  p_due timestamptz, p_at timestamptz, p_rental_fee numeric, p_period_days integer, p_deposit numeric
)
returns table (days integer, daily_fee numeric, late_fee numeric, is_missing boolean)
language plpgsql immutable
set search_path = ''
as $$
declare
  v_ms double precision := extract(epoch from (p_at - p_due)) * 1000;
  v_days integer := case when v_ms > 0 then ceil(v_ms / 86400000)::integer else 0 end;
  v_daily double precision := ceil(p_rental_fee::double precision / greatest(p_period_days, 1));
begin
  days := v_days;
  daily_fee := v_daily::numeric;
  is_missing := v_days > 7;
  late_fee := case when is_missing then p_deposit
                   else least(p_deposit, greatest(0, (v_days * v_daily)::numeric)) end;
  return next;
end
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 14. Internal money + notification helpers
-- ───────────────────────────────────────────────────────────────────────────

create or replace function private.notify(
  p_user_id text, p_kind text, p_title text, p_body text, p_link text, p_dedupe_key text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (p_user_id, p_kind, p_title, coalesce(p_body, ''), p_link, p_dedupe_key)
  on conflict (user_id, dedupe_key) do nothing;
end
$$;

create or replace function private.notify_admins(p_kind text, p_title text, p_body text, p_link text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin record;
begin
  for v_admin in select id from public.users where is_admin loop
    perform private.notify(v_admin.id, p_kind, p_title, p_body, p_link);
  end loop;
end
$$;

create or replace function private.ledger(
  p_user_id text, p_kind text, p_bucket text, p_amount numeric, p_memo text,
  p_rental_id text default null, p_transaction_id text default null,
  p_dispute_id text default null, p_method text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_amount is null or p_amount = 0 then
    return;
  end if;
  insert into public.wallet_ledger (user_id, kind, bucket, amount, memo, rental_id, transaction_id, dispute_id, payment_method)
  values (case when p_bucket = 'platform' then null else p_user_id end,
          p_kind, p_bucket, p_amount, coalesce(p_memo, ''), p_rental_id, p_transaction_id, p_dispute_id, p_method);
end
$$;

create or replace function private.available_balance(p_user_id text)
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0) from public.wallet_ledger
  where user_id = p_user_id and bucket = 'available'
$$;

-- Record a simulated payment. Wallet payments must be covered by the balance.
create or replace function private.take_payment(
  p_user_id text, p_amount numeric, p_method text, p_memo text,
  p_rental_id text default null, p_transaction_id text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_balance numeric;
begin
  if p_method is null or p_method not in ('promptpay', 'card', 'wallet') then
    raise exception 'Choose a payment method: promptpay, card or wallet.';
  end if;
  if p_method = 'wallet' then
    v_balance := private.available_balance(p_user_id);
    if v_balance < p_amount then
      raise exception 'Your wallet has ฿% available, which doesn''t cover ฿%. Pay with PromptPay or card instead.',
        v_balance, p_amount;
    end if;
  end if;
  perform private.ledger(p_user_id, 'payment', case when p_method = 'wallet' then 'available' else 'external' end,
                         -p_amount, p_memo, p_rental_id, p_transaction_id, null, p_method);
end
$$;

create or replace function private.user_name(p_user_id text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select name from public.users where id = p_user_id), 'Someone')
$$;

create or replace function private.deal_link(p_id text)
returns text
language sql immutable
set search_path = ''
as $$
  select '/transaction/' || p_id
$$;

-- Owner payout of the rental fee (48 h after handover, BusinessRules §4).
create or replace function private.release_rental_payout(p_rental_id text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.rentals;
  v_title text;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  if not found or r.payout_released_at is not null or r.rental_fee is null then
    return;
  end if;
  select title into v_title from public.listings where id = r.listing_id;
  perform private.ledger(r.owner_id, 'hold_release', 'held', -r.rental_fee, 'Rental fee released from escrow', r.id);
  perform private.ledger(r.owner_id, 'payout', 'available', r.rental_fee, 'Rental fee payout', r.id);
  update public.rentals set payout_released_at = now() where id = r.id;
  perform private.notify(r.owner_id, 'rental_payout', 'Rental fee paid out',
    format('฿%s for "%s" is now in your wallet (simulated).', r.rental_fee, v_title), private.deal_link(r.id));
end
$$;

-- Settle the deposit and close the rental. p_to_owner is already capped.
create or replace function private.settle_rental(
  p_rental_id text, p_phase text, p_to_owner numeric, p_reason text, p_dispute_id text default null
)
returns public.rentals
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.rentals;
  v_to_owner numeric;
  v_to_renter numeric;
  v_title text;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  v_to_owner := least(r.deposit, greatest(0, coalesce(p_to_owner, 0)));
  v_to_renter := r.deposit - v_to_owner;
  select title into v_title from public.listings where id = r.listing_id;

  perform private.ledger(r.renter_id, 'hold_release', 'held', -r.deposit, 'Deposit released from escrow', r.id, null, p_dispute_id);
  perform private.ledger(r.renter_id, 'refund', 'available', v_to_renter, 'Deposit refund', r.id, null, p_dispute_id);
  perform private.ledger(r.owner_id, 'claim', 'available', v_to_owner,
    case when p_phase = 'missing' then 'Deposit for an item not returned'
         when p_dispute_id is not null then 'Deposit share from dispute'
         else 'Late fee from deposit' end, r.id, null, p_dispute_id);

  update public.rentals
  set phase = p_phase, released_at = now(), deposit_to_owner = v_to_owner, deposit_to_renter = v_to_renter
  where id = r.id
  returning * into r;

  update public.listings
  set status = case when p_phase = 'missing' then 'paused' else 'available' end
  where id = r.listing_id and status = 'rented';

  -- The rental fee is paid out once the payout time has passed; a dispute
  -- only holds it until the dispute is resolved.
  if r.payout_released_at is null and (r.payout_at <= now() or p_phase = 'resolved') then
    perform private.release_rental_payout(r.id);
    select * into r from public.rentals where id = r.id;
  end if;

  perform private.notify(r.renter_id, 'rental_' || replace(p_phase, '-', '_'),
    case p_phase when 'missing' then 'Rental marked missing' when 'resolved' then 'Dispute resolved' else 'Deposit released' end,
    format('"%s": ฿%s refunded to your wallet, ฿%s to the owner. %s', v_title, v_to_renter, v_to_owner, p_reason),
    private.deal_link(r.id));
  perform private.notify(r.owner_id, 'rental_' || replace(p_phase, '-', '_'),
    case p_phase when 'missing' then 'Rental marked missing' when 'resolved' then 'Dispute resolved' else 'Rental closed' end,
    format('"%s": ฿%s of the deposit goes to you, ฿%s back to the renter. %s', v_title, v_to_owner, v_to_renter, p_reason),
    private.deal_link(r.id));
  return r;
end
$$;

-- Missing: more than 7 days late, full deposit to the owner (§4).
create or replace function private.settle_missing(p_rental_id text)
returns public.rentals
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.rentals;
  s record;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  select * into s from private.late_settlement(r.due_date, now(), r.rental_fee, r.period_days, r.deposit);
  update public.rentals set late_days = s.days, late_fee = s.late_fee where id = r.id;
  return private.settle_rental(r.id, 'missing', r.deposit, 'More than 7 days late counts as missing; the full deposit goes to the owner.');
end
$$;

-- Return recorded: late fee computed now, 48 h window opens (§4, §6).
create or replace function private.record_return(p_rental_id text, p_photos text[])
returns public.rentals
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.rentals;
  s record;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  select * into s from private.late_settlement(r.due_date, now(), r.rental_fee, r.period_days, r.deposit);
  if s.is_missing then
    return private.settle_missing(r.id);
  end if;
  update public.rentals
  set phase = 'return-pending',
      returned_at = now(),
      dispute_window_ends_at = now() + interval '48 hours',
      late_days = s.days,
      late_fee = s.late_fee,
      return_photos = return_photos || coalesce(p_photos, '{}')
  where id = r.id
  returning * into r;
  return r;
end
$$;

-- Protected sale: release the price to the seller.
create or replace function private.release_sale(p_transaction_id text, p_refund numeric, p_status text, p_dispute_id text default null)
returns public.transactions
language plpgsql security definer
set search_path = ''
as $$
declare
  t public.transactions;
  v_refund numeric;
  v_title text;
begin
  select * into t from public.transactions where id = p_transaction_id for update;
  v_refund := least(t.price, greatest(0, coalesce(p_refund, 0)));
  select title into v_title from public.listings where id = t.listing_id;

  perform private.ledger(t.seller_id, 'hold_release', 'held', -t.price, 'Sale payment released from escrow', null, t.id, p_dispute_id);
  perform private.ledger(t.seller_id, 'payout', 'available', t.price - v_refund, 'Sale payout', null, t.id, p_dispute_id);
  perform private.ledger(t.buyer_id, 'refund', 'available', v_refund, 'Refund from dispute', null, t.id, p_dispute_id);

  update public.transactions
  set status = p_status, released_at = now(), completed_at = now(),
      refund_to_buyer = v_refund, seller_amount = t.price - v_refund,
      handover_at = coalesce(handover_at, now())
  where id = t.id
  returning * into t;

  update public.listings
  set status = case when v_refund >= t.price and v_refund > 0 then 'paused' else 'sold' end,
      times_changed_hands = times_changed_hands + case when v_refund >= t.price and v_refund > 0 then 0 else 1 end
  where id = t.listing_id;

  if not (v_refund >= t.price and v_refund > 0) then
    insert into public.listing_history (listing_id, owner_name, action, date)
    values (t.listing_id, private.user_name(t.buyer_id), 'Bought with buyer protection', to_char(now(), 'Mon YYYY'));
  end if;

  perform private.notify(t.seller_id, 'sale_' || p_status, 'Sale payment released',
    format('฿%s for "%s" is now in your wallet (simulated).', t.price - v_refund, v_title), private.deal_link(t.id));
  if v_refund > 0 then
    perform private.notify(t.buyer_id, 'sale_' || p_status, 'Refund issued',
      format('฿%s for "%s" was refunded to your wallet.', v_refund, v_title), private.deal_link(t.id));
  end if;
  return t;
end
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 15. Rental RPCs
-- ───────────────────────────────────────────────────────────────────────────

-- Renter asks to rent a listing. requested. Quote is computed and stored.
create or replace function public.request_rental(p_listing_id text, p_message text default null)
returns public.rentals
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  l public.listings;
  q jsonb;
  v_days integer;
  r public.rentals;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found.';
  end if;
  if l.type <> 'rent' then
    raise exception 'This listing is for sale, not for rent.';
  end if;
  if l.seller_id = v_uid then
    raise exception 'You can''t rent your own listing.';
  end if;
  if l.status <> 'available' then
    raise exception 'This item isn''t available to rent right now.';
  end if;
  if l.deposit is null or l.deposit < 200 or l.deposit > 3000 then
    raise exception 'This listing has no valid deposit (฿200–฿3,000), so it can''t be rented.';
  end if;
  if exists (select 1 from public.rentals
             where listing_id = l.id and renter_id = v_uid and phase in ('requested', 'approved')) then
    raise exception 'You already have an open request for this item.';
  end if;

  q := public.quote_rental(l.price, l.deposit);
  v_days := private.period_days(l.rental_period);

  insert into public.rentals (
    listing_id, renter_id, owner_id, deposit, start_date, due_date, phase, quote,
    rental_period, period_days, rental_fee, commission, escrow_fee, request_message, requested_at
  ) values (
    l.id, v_uid, l.seller_id, l.deposit, now(), now() + v_days * interval '1 day', 'requested', q,
    l.rental_period, v_days, (q ->> 'rentalFee')::numeric, (q ->> 'commission')::numeric,
    (q ->> 'handlingFee')::numeric, nullif(trim(p_message), ''), now()
  )
  returning * into r;

  perform private.notify(l.seller_id, 'rental_requested', 'New rental request',
    format('%s wants to rent "%s".', private.user_name(v_uid), l.title),
    '/dashboard/listings/' || l.id || '/requests');
  return r;
end
$$;

-- Owner approves (→ approved, listing reserved) or declines (→ declined).
create or replace function public.respond_rental(p_rental_id text, p_approve boolean, p_reason text default null)
returns public.rentals
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  r public.rentals;
  l public.listings;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  if not found then
    raise exception 'Rental not found.';
  end if;
  if r.owner_id <> v_uid then
    raise exception 'Only the owner can respond to this request.';
  end if;
  if r.phase <> 'requested' then
    raise exception 'This request was already handled (it is %).', r.phase;
  end if;
  select * into l from public.listings where id = r.listing_id for update;

  if p_approve then
    if exists (select 1 from public.rentals
               where listing_id = r.listing_id and id <> r.id
                 and phase in ('approved', 'paid', 'active', 'return-pending', 'disputed', 'overdue')) then
      raise exception 'Another booking for this item is already in progress.';
    end if;
    if l.status <> 'available' then
      raise exception 'The listing isn''t available (it is %). Make it available before approving.', l.status;
    end if;
    update public.rentals set phase = 'approved', approved_at = now() where id = r.id returning * into r;
    update public.listings set status = 'reserved' where id = l.id;
    perform private.notify(r.renter_id, 'rental_approved', 'Rental request approved',
      format('Pay ฿%s to confirm "%s".', (r.quote ->> 'totalDueNow'), l.title), private.deal_link(r.id));
  else
    update public.rentals set phase = 'declined', declined_at = now(), decline_reason = nullif(trim(p_reason), '')
    where id = r.id returning * into r;
    perform private.notify(r.renter_id, 'rental_declined', 'Rental request declined',
      format('The owner declined your request for "%s".%s', l.title,
             coalesce(' Reason: ' || nullif(trim(p_reason), ''), '')), private.deal_link(r.id));
  end if;
  return r;
end
$$;

-- Either party cancels before payment (requested / approved → cancelled).
create or replace function public.cancel_rental(p_rental_id text, p_reason text default null)
returns public.rentals
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  r public.rentals;
  v_title text;
  v_was text;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  if not found or v_uid not in (r.renter_id, r.owner_id) then
    raise exception 'Rental not found.';
  end if;
  if r.phase not in ('requested', 'approved') then
    raise exception 'Only a booking that isn''t paid yet can be cancelled (this one is %).', r.phase;
  end if;
  v_was := r.phase;
  update public.rentals
  set phase = 'cancelled', cancelled_at = now(), cancelled_by = v_uid,
      decline_reason = coalesce(nullif(trim(p_reason), ''), decline_reason)
  where id = r.id returning * into r;
  if v_was = 'approved' then
    update public.listings set status = 'available' where id = r.listing_id and status = 'reserved';
  end if;
  select title into v_title from public.listings where id = r.listing_id;
  perform private.notify(case when v_uid = r.renter_id then r.owner_id else r.renter_id end,
    'rental_cancelled', 'Booking cancelled',
    format('%s cancelled the booking for "%s".', private.user_name(v_uid), v_title), private.deal_link(r.id));
  return r;
end
$$;

-- Renter pays totalDueNow (simulated). approved → paid. Deposit and rental
-- fee are held; platform fees recorded; listing becomes rented.
create or replace function public.pay_rental(p_rental_id text, p_method text)
returns public.rentals
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  r public.rentals;
  l public.listings;
  q jsonb;
  v_total numeric;
  v_other record;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  if not found or r.renter_id <> v_uid then
    raise exception 'Rental not found.';
  end if;
  if r.phase <> 'approved' then
    raise exception 'You can pay once the owner approves the request (this booking is %).', r.phase;
  end if;
  select * into l from public.listings where id = r.listing_id for update;

  q := public.quote_rental(r.rental_fee, r.deposit);
  v_total := (q ->> 'totalDueNow')::numeric;

  perform private.take_payment(v_uid, v_total, p_method, format('Rental booking: %s', l.title), r.id);
  perform private.ledger(v_uid, 'hold', 'held', r.deposit, 'Deposit held in escrow', r.id);
  perform private.ledger(r.owner_id, 'hold', 'held', r.rental_fee, 'Rental fee, paid out 48 h after handover', r.id);
  perform private.ledger(null, 'platform_fee', 'platform', (q ->> 'commission')::numeric, 'Rental commission (10%)', r.id);
  perform private.ledger(null, 'platform_fee', 'platform', (q ->> 'handlingFee')::numeric, 'Escrow handling fee', r.id);

  update public.rentals
  set phase = 'paid', paid_at = now(), payment_method = p_method, total_paid = v_total, quote = q,
      commission = (q ->> 'commission')::numeric, escrow_fee = (q ->> 'handlingFee')::numeric
  where id = r.id returning * into r;

  update public.listings set status = 'rented' where id = l.id;

  -- Anyone else still waiting for this item is declined.
  for v_other in
    update public.rentals set phase = 'declined', declined_at = now(), decline_reason = 'The item was booked by someone else.'
    where listing_id = l.id and id <> r.id and phase = 'requested'
    returning id, renter_id
  loop
    perform private.notify(v_other.renter_id, 'rental_declined', 'Rental request declined',
      format('"%s" was booked by someone else.', l.title), private.deal_link(v_other.id));
  end loop;

  perform private.notify(r.owner_id, 'rental_paid', 'Booking paid',
    format('%s paid for "%s". The deposit is held by Pass It On. Arrange the handover at %s.',
           private.user_name(v_uid), l.title, l.pickup_location), private.deal_link(r.id));
  return r;
end
$$;

-- Handover at the pickup point. paid → active. Either party confirms.
-- Due date and payout time start now.
create or replace function public.confirm_handover(p_rental_id text, p_photos text[] default '{}')
returns public.rentals
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  r public.rentals;
  v_title text;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  if not found or v_uid not in (r.renter_id, r.owner_id) then
    raise exception 'Rental not found.';
  end if;
  if r.phase <> 'paid' then
    raise exception 'Handover can be confirmed only after payment (this booking is %).', r.phase;
  end if;
  update public.rentals
  set phase = 'active', handover_at = now(), start_date = now(),
      due_date = now() + period_days * interval '1 day',
      payout_at = now() + interval '48 hours',
      handover_photos = handover_photos || coalesce(p_photos, '{}'),
      handover_confirmed_by = v_uid
  where id = r.id returning * into r;
  select title into v_title from public.listings where id = r.listing_id;
  perform private.notify(case when v_uid = r.renter_id then r.owner_id else r.renter_id end,
    'rental_handover', 'Handover confirmed',
    format('"%s" was handed over. Return it by %s.', v_title, to_char(r.due_date, 'DD Mon YYYY')),
    private.deal_link(r.id));
  return r;
end
$$;

-- Item handed back. active / overdue → return-pending (or missing when more
-- than 7 days late). Late fee is fixed now; the 48 h window opens.
create or replace function public.mark_returned(p_rental_id text, p_photos text[] default '{}')
returns public.rentals
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  r public.rentals;
  v_title text;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  if not found or v_uid not in (r.renter_id, r.owner_id) then
    raise exception 'Rental not found.';
  end if;
  if r.phase not in ('active', 'overdue') then
    raise exception 'Only an active or overdue rental can be marked returned (this one is %).', r.phase;
  end if;
  r := private.record_return(r.id, p_photos);
  if r.phase = 'return-pending' then
    select title into v_title from public.listings where id = r.listing_id;
    perform private.notify(case when v_uid = r.renter_id then r.owner_id else r.renter_id end,
      'rental_returned', 'Item returned',
      format('"%s" is back. The owner has 48 hours to confirm the condition or report a problem; then the deposit releases automatically.%s',
             v_title, case when r.late_fee > 0 then format(' Late fee: ฿%s from the deposit.', r.late_fee) else '' end),
      private.deal_link(r.id));
  end if;
  return r;
end
$$;

-- Owner confirms good condition → released now (early release, §6).
-- Also accepts an active / overdue rental (records the return first).
create or replace function public.confirm_return(p_rental_id text, p_photos text[] default '{}')
returns public.rentals
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  r public.rentals;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  if not found or v_uid not in (r.renter_id, r.owner_id) then
    raise exception 'Rental not found.';
  end if;
  if r.owner_id <> v_uid then
    raise exception 'Only the owner can confirm the item came back in good condition.';
  end if;
  if r.phase in ('active', 'overdue') then
    r := private.record_return(r.id, p_photos);
    if r.phase = 'missing' then
      return r;
    end if;
  elsif r.phase = 'return-pending' then
    update public.rentals set return_photos = return_photos || coalesce(p_photos, '{}') where id = r.id;
  else
    raise exception 'Only a returned rental can be confirmed (this one is %).', r.phase;
  end if;
  return private.settle_rental(r.id, 'released', r.late_fee, 'The owner confirmed the item came back in good condition.');
end
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 16. Sale RPCs
-- ───────────────────────────────────────────────────────────────────────────

-- Buyer starts a purchase. in-person → pending (no money through the
-- platform, listing unchanged). protected → paid (held), listing reserved.
create or replace function public.create_sale(p_listing_id text, p_mode text, p_method text default null)
returns public.transactions
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  l public.listings;
  q jsonb;
  t public.transactions;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found.';
  end if;
  if l.type <> 'sale' then
    raise exception 'This listing is for rent; request a rental instead.';
  end if;
  if l.seller_id = v_uid then
    raise exception 'You can''t buy your own listing.';
  end if;
  if l.status <> 'available' then
    raise exception 'This item isn''t available right now.';
  end if;
  q := public.quote_sale(l.price, p_mode);

  if p_mode = 'in-person' then
    select * into t from public.transactions
    where listing_id = l.id and buyer_id = v_uid and status = 'pending';
    if found then
      return t;
    end if;
    insert into public.transactions (listing_id, buyer_id, seller_id, mode, price, protection_fee, total, status)
    values (l.id, v_uid, l.seller_id, 'in-person', l.price, 0, l.price, 'pending')
    returning * into t;
    perform private.notify(l.seller_id, 'sale_requested', 'Buyer wants to pay in person',
      format('%s wants to buy "%s" and pay you ฿%s at handover. Mark it sold once paid.',
             private.user_name(v_uid), l.title, l.price), private.deal_link(t.id));
    return t;
  end if;

  if p_method is null or p_method not in ('promptpay', 'card', 'wallet') then
    raise exception 'Choose a payment method: promptpay, card or wallet.';
  end if;
  insert into public.transactions (listing_id, buyer_id, seller_id, mode, price, protection_fee, total,
                                   payment_method, status, paid_at)
  values (l.id, v_uid, l.seller_id, 'protected', l.price, (q ->> 'protectionFee')::numeric,
          (q ->> 'total')::numeric, p_method, 'paid', now())
  returning * into t;

  perform private.take_payment(v_uid, t.total, p_method, format('Protected purchase: %s', l.title), null, t.id);
  perform private.ledger(l.seller_id, 'hold', 'held', t.price, 'Sale payment, released 48 h after handover', null, t.id);
  perform private.ledger(null, 'platform_fee', 'platform', t.protection_fee, 'Buyer protection fee', null, t.id);

  update public.listings set status = 'reserved' where id = l.id;

  perform private.notify(l.seller_id, 'sale_paid', 'Item paid with protection',
    format('%s paid ฿%s for "%s". Pass It On holds it until handover plus 48 hours. Meet at %s.',
           private.user_name(v_uid), t.price, l.title, l.pickup_location), private.deal_link(t.id));
  return t;
end
$$;

-- Protected sale handed over. paid → handed-over, 48 h window opens.
create or replace function public.confirm_sale_handover(p_transaction_id text, p_photos text[] default '{}')
returns public.transactions
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  t public.transactions;
  v_title text;
begin
  select * into t from public.transactions where id = p_transaction_id for update;
  if not found or v_uid not in (t.buyer_id, t.seller_id) then
    raise exception 'Purchase not found.';
  end if;
  if t.mode <> 'protected' then
    raise exception 'In-person sales have no escrow; the seller marks the listing sold.';
  end if;
  if t.status <> 'paid' then
    raise exception 'Handover can be confirmed only for a paid purchase (this one is %).', t.status;
  end if;
  update public.transactions
  set status = 'handed-over', handover_at = now(), dispute_window_ends_at = now() + interval '48 hours',
      handover_photos = handover_photos || coalesce(p_photos, '{}')
  where id = t.id returning * into t;
  select title into v_title from public.listings where id = t.listing_id;
  perform private.notify(t.buyer_id, 'sale_handover', 'Handover confirmed',
    format('You have 48 hours to check "%s" and open a dispute if it isn''t as described. Otherwise the seller is paid automatically.', v_title),
    private.deal_link(t.id));
  if v_uid = t.buyer_id then
    perform private.notify(t.seller_id, 'sale_handover', 'Handover confirmed',
      format('The buyer confirmed the handover of "%s". You are paid when the 48-hour window closes.', v_title),
      private.deal_link(t.id));
  end if;
  return t;
end
$$;

-- Buyer confirms the item is as described → released to the seller now.
create or replace function public.confirm_sale_receipt(p_transaction_id text)
returns public.transactions
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  t public.transactions;
begin
  select * into t from public.transactions where id = p_transaction_id for update;
  if not found or v_uid not in (t.buyer_id, t.seller_id) then
    raise exception 'Purchase not found.';
  end if;
  if t.buyer_id <> v_uid then
    raise exception 'Only the buyer can confirm receipt.';
  end if;
  if t.mode <> 'protected' or t.status not in ('paid', 'handed-over') then
    raise exception 'Receipt can be confirmed only for a protected purchase awaiting release (this one is %).', t.status;
  end if;
  return private.release_sale(t.id, 0, 'released');
end
$$;

-- Seller marks a sale listing sold (in person). Completes that buyer's
-- pending in-person purchase (or records one), cancels the other pending ones.
create or replace function public.mark_sold(p_listing_id text, p_buyer_id text default null)
returns public.transactions
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  l public.listings;
  t public.transactions;
  v_other record;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found.';
  end if;
  if l.seller_id <> v_uid then
    raise exception 'Only the seller can mark this listing sold.';
  end if;
  if l.type <> 'sale' then
    raise exception 'Rental listings can''t be marked sold.';
  end if;
  if l.status = 'sold' then
    raise exception 'This listing is already sold.';
  end if;
  if exists (select 1 from public.transactions where listing_id = l.id and status in ('paid', 'handed-over', 'disputed')) then
    raise exception 'This item has a protected purchase in progress; it is marked sold when that completes.';
  end if;
  if p_buyer_id = v_uid then
    raise exception 'You can''t sell to yourself.';
  end if;

  if p_buyer_id is not null then
    select * into t from public.transactions
    where listing_id = l.id and buyer_id = p_buyer_id and status = 'pending' for update;
  end if;
  if t.id is not null then
    update public.transactions set status = 'completed', completed_at = now(), seller_amount = price
    where id = t.id returning * into t;
  else
    insert into public.transactions (listing_id, buyer_id, seller_id, mode, price, protection_fee, total,
                                     status, completed_at, seller_amount)
    values (l.id, p_buyer_id, v_uid, 'in-person', l.price, 0, l.price, 'completed', now(), l.price)
    returning * into t;
  end if;

  for v_other in
    update public.transactions set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid
    where listing_id = l.id and status = 'pending' and id <> t.id
    returning id, buyer_id
  loop
    perform private.notify(v_other.buyer_id, 'sale_cancelled', 'Item sold to someone else',
      format('"%s" was sold to another buyer.', l.title), private.deal_link(v_other.id));
  end loop;

  update public.listings
  set status = 'sold', times_changed_hands = times_changed_hands + case when p_buyer_id is null then 0 else 1 end
  where id = l.id;
  if p_buyer_id is not null then
    insert into public.listing_history (listing_id, owner_name, action, date)
    values (l.id, private.user_name(p_buyer_id), 'Bought in person', to_char(now(), 'Mon YYYY'));
    perform private.notify(p_buyer_id, 'sale_completed', 'Purchase complete',
      format('%s marked "%s" as sold to you.', private.user_name(v_uid), l.title), private.deal_link(t.id));
  end if;
  return t;
end
$$;

-- Buyer or seller drops a pending in-person purchase.
create or replace function public.cancel_sale(p_transaction_id text)
returns public.transactions
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  t public.transactions;
  v_title text;
begin
  select * into t from public.transactions where id = p_transaction_id for update;
  if not found or v_uid not in (t.buyer_id, t.seller_id) then
    raise exception 'Purchase not found.';
  end if;
  if t.status <> 'pending' then
    raise exception 'Only a pending in-person purchase can be cancelled (this one is %). Protected payments are settled through handover or a dispute.', t.status;
  end if;
  update public.transactions set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid
  where id = t.id returning * into t;
  select title into v_title from public.listings where id = t.listing_id;
  perform private.notify(case when v_uid = t.buyer_id then t.seller_id else t.buyer_id end,
    'sale_cancelled', 'Purchase cancelled',
    format('%s cancelled the in-person purchase of "%s".', private.user_name(v_uid), v_title), private.deal_link(t.id));
  return t;
end
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 17. Dispute RPCs (BusinessRules §6)
-- ───────────────────────────────────────────────────────────────────────────

-- File within the 48 h window: rentals after the return (either party),
-- protected sales after handover (buyer). In-person sales have no disputes.
create or replace function public.file_dispute(
  p_reason text,
  p_description text default '',
  p_rental_id text default null,
  p_transaction_id text default null,
  p_evidence text[] default '{}',
  p_claim_amount numeric default null
)
returns public.disputes
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  r public.rentals;
  t public.transactions;
  d public.disputes;
  v_against text;
  v_prefix text;
  v_title text;
  v_path text;
begin
  if num_nonnulls(p_rental_id, p_transaction_id) <> 1 then
    raise exception 'A dispute is about exactly one rental or one purchase.';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 2 then
    raise exception 'Give a short reason for the dispute.';
  end if;

  if p_rental_id is not null then
    select * into r from public.rentals where id = p_rental_id for update;
    if not found or v_uid not in (r.renter_id, r.owner_id) then
      raise exception 'Rental not found.';
    end if;
    if r.phase <> 'return-pending' then
      raise exception 'A rental dispute can be filed only after the return, within 48 hours (this rental is %).', r.phase;
    end if;
    if now() >= r.dispute_window_ends_at then
      raise exception 'The 48-hour dispute window for this rental has closed.';
    end if;
    if p_claim_amount is not null and p_claim_amount > r.deposit then
      raise exception 'A claim can''t exceed the ฿% deposit.', r.deposit;
    end if;
    v_against := case when v_uid = r.renter_id then r.owner_id else r.renter_id end;
    v_prefix := 'rental/' || r.id || '/';
    select title into v_title from public.listings where id = r.listing_id;
  else
    select * into t from public.transactions where id = p_transaction_id for update;
    if not found or v_uid not in (t.buyer_id, t.seller_id) then
      raise exception 'Purchase not found.';
    end if;
    if t.mode <> 'protected' then
      raise exception 'Sales paid in person have no dispute support.';
    end if;
    if t.buyer_id <> v_uid then
      raise exception 'Only the buyer can open a dispute on a purchase.';
    end if;
    if t.status <> 'handed-over' then
      raise exception 'A purchase dispute can be filed only after handover, within 48 hours (this purchase is %).', t.status;
    end if;
    if now() >= t.dispute_window_ends_at then
      raise exception 'The 48-hour dispute window for this purchase has closed.';
    end if;
    if p_claim_amount is not null and p_claim_amount > t.price then
      raise exception 'A refund claim can''t exceed the ฿% price.', t.price;
    end if;
    v_against := t.seller_id;
    v_prefix := 'sale/' || t.id || '/';
    select title into v_title from public.listings where id = t.listing_id;
  end if;

  foreach v_path in array coalesce(p_evidence, '{}') loop
    if left(v_path, length(v_prefix)) <> v_prefix then
      raise exception 'Evidence must be uploaded under dispute-evidence/%.', v_prefix;
    end if;
  end loop;

  insert into public.disputes (rental_id, transaction_id, filed_by, against_id, reason, description, evidence, claim_amount)
  values (p_rental_id, p_transaction_id, v_uid, v_against, trim(p_reason), coalesce(p_description, ''),
          coalesce(p_evidence, '{}'), p_claim_amount)
  returning * into d;

  if p_rental_id is not null then
    update public.rentals set phase = 'disputed' where id = p_rental_id;
  else
    update public.transactions set status = 'disputed' where id = p_transaction_id;
  end if;

  perform private.notify(v_against, 'dispute_opened', 'Dispute opened',
    format('%s opened a dispute about "%s": %s. The money stays held until an admin decides.',
           private.user_name(v_uid), v_title, trim(p_reason)), '/dispute/' || d.id);
  perform private.notify_admins('dispute_opened', 'New dispute to review',
    format('"%s": %s', v_title, trim(p_reason)), '/admin/disputes');
  return d;
end
$$;

-- Admin decides. Rentals: normal-wear (฿0 to owner), repairable-damage
-- (p_amount = repair cost), lost-or-destroyed (full deposit). The owner's
-- share includes any late fee and never exceeds the deposit.
-- Sales: not-as-described (p_amount = refund, default the full price) or
-- normal-wear (claim rejected, seller paid in full).
create or replace function public.resolve_dispute(
  p_dispute_id text, p_finding text, p_amount numeric default null, p_note text default null
)
returns public.disputes
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  d public.disputes;
  r public.rentals;
  t public.transactions;
  v_claim numeric;
  v_to_owner numeric;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can resolve disputes.';
  end if;
  select * into d from public.disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'Dispute not found.';
  end if;
  if d.status <> 'open' then
    raise exception 'This dispute is already resolved.';
  end if;
  if p_amount is not null and p_amount < 0 then
    raise exception 'The amount can''t be negative.';
  end if;

  if d.rental_id is not null then
    select * into r from public.rentals where id = d.rental_id for update;
    if p_finding = 'normal-wear' then
      v_claim := 0;
    elsif p_finding = 'repairable-damage' then
      if p_amount is null then
        raise exception 'Enter the repair cost for repairable damage.';
      end if;
      if p_amount > r.deposit then
        raise exception 'The repair cost (฿%) can''t exceed the ฿% deposit: the owner never receives more than the deposit.', p_amount, r.deposit;
      end if;
      v_claim := p_amount;
    elsif p_finding = 'lost-or-destroyed' then
      v_claim := r.deposit;
    elsif p_finding = 'not-as-described' then
      raise exception '"Not as described" applies to sales; for a rental choose normal-wear, repairable-damage or lost-or-destroyed.';
    else
      raise exception 'Unknown finding "%".', p_finding;
    end if;
    v_to_owner := least(r.deposit, r.late_fee + v_claim);
    update public.disputes
    set status = 'resolved', finding = p_finding, resolution_amount = v_claim,
        deposit_to_owner = v_to_owner, deposit_to_renter = r.deposit - v_to_owner,
        resolution_note = nullif(trim(p_note), ''), resolved_by = v_uid, resolved_at = now()
    where id = d.id returning * into d;
    perform private.settle_rental(r.id, 'resolved', v_to_owner,
      format('Admin finding: %s.', replace(p_finding, '-', ' ')), d.id);
  else
    select * into t from public.transactions where id = d.transaction_id for update;
    if p_finding = 'not-as-described' then
      v_claim := coalesce(p_amount, t.price);
      if v_claim > t.price then
        raise exception 'The refund (฿%) can''t exceed the ฿% price.', v_claim, t.price;
      end if;
    elsif p_finding = 'normal-wear' then
      v_claim := 0;
    else
      raise exception 'For a purchase choose not-as-described (with a refund amount) or normal-wear (no refund).';
    end if;
    update public.disputes
    set status = 'resolved', finding = p_finding, resolution_amount = v_claim,
        refund_to_buyer = v_claim, seller_amount = t.price - v_claim,
        resolution_note = nullif(trim(p_note), ''), resolved_by = v_uid, resolved_at = now()
    where id = d.id returning * into d;
    perform private.release_sale(t.id, v_claim, 'resolved', d.id);
  end if;
  return d;
end
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 18. Scheduled work: payouts, overdue / missing, auto-release, reminders.
--     Idempotent; safe to call often (pg_cron every 10 min + lazily from
--     the app). Returns what it did.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.run_escrow_jobs()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_row record;
  v_payouts integer := 0;
  v_overdue integer := 0;
  v_missing integer := 0;
  v_rentals_released integer := 0;
  v_sales_released integer := 0;
  v_reminders integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('pass_it_on.run_escrow_jobs')) then
    return jsonb_build_object('skipped', true);
  end if;

  -- Overdue: past the due date and not returned.
  for v_row in
    update public.rentals set phase = 'overdue', overdue_at = now()
    where phase = 'active' and due_date < now()
    returning id, renter_id, owner_id, listing_id
  loop
    v_overdue := v_overdue + 1;
    perform private.notify(v_row.renter_id, 'rental_overdue', 'Rental overdue',
      'Your rental is past its due date. A daily late fee comes out of the deposit; after 7 days it counts as missing.',
      private.deal_link(v_row.id), 'overdue:' || v_row.id);
    perform private.notify(v_row.owner_id, 'rental_overdue', 'Rental overdue',
      'Your item is past its due date. A daily late fee comes out of the deposit; after 7 days the full deposit goes to you.',
      private.deal_link(v_row.id), 'overdue:' || v_row.id);
  end loop;

  -- Missing: more than 7 days late.
  for v_row in
    select id from public.rentals
    where phase = 'overdue' and now() > due_date + interval '7 days'
    for update skip locked
  loop
    perform private.settle_missing(v_row.id);
    v_missing := v_missing + 1;
  end loop;

  -- Rental auto-release: return window closed without a dispute.
  for v_row in
    select id, late_fee from public.rentals
    where phase = 'return-pending' and dispute_window_ends_at <= now()
    for update skip locked
  loop
    perform private.settle_rental(v_row.id, 'released', v_row.late_fee,
      'The 48-hour window closed with no dispute.');
    v_rentals_released := v_rentals_released + 1;
  end loop;

  -- Owner payout: 48 h after handover, unless a dispute is open.
  for v_row in
    select id from public.rentals
    where payout_released_at is null and payout_at <= now()
      and phase in ('active', 'overdue', 'return-pending', 'released', 'missing')
    for update skip locked
  loop
    perform private.release_rental_payout(v_row.id);
    v_payouts := v_payouts + 1;
  end loop;

  -- Protected sale auto-release: 48 h after handover without a dispute.
  for v_row in
    select id from public.transactions
    where status = 'handed-over' and dispute_window_ends_at <= now()
    for update skip locked
  loop
    perform private.release_sale(v_row.id, 0, 'released');
    v_sales_released := v_sales_released + 1;
  end loop;

  -- Reminders 24 h and 2 h before a window closes (once each).
  for v_row in
    select r.id, r.renter_id, r.owner_id, r.dispute_window_ends_at as ends_at,
           case when now() >= r.dispute_window_ends_at - interval '2 hours' then '2' else '24' end as hours
    from public.rentals r
    where r.phase = 'return-pending'
      and now() >= r.dispute_window_ends_at - interval '24 hours'
      and now() < r.dispute_window_ends_at
  loop
    perform private.notify(v_row.owner_id, 'window_reminder',
      format('%s hours left to report a problem', v_row.hours),
      'After that the deposit releases to the renter automatically.',
      private.deal_link(v_row.id), format('reminder%s:%s:owner', v_row.hours, v_row.id));
    perform private.notify(v_row.renter_id, 'window_reminder',
      format('Deposit releases in %s hours', v_row.hours),
      'If the owner reports no problem, your deposit comes back automatically.',
      private.deal_link(v_row.id), format('reminder%s:%s:renter', v_row.hours, v_row.id));
    v_reminders := v_reminders + 1;
  end loop;

  for v_row in
    select t.id, t.buyer_id, t.dispute_window_ends_at as ends_at,
           case when now() >= t.dispute_window_ends_at - interval '2 hours' then '2' else '24' end as hours
    from public.transactions t
    where t.status = 'handed-over'
      and now() >= t.dispute_window_ends_at - interval '24 hours'
      and now() < t.dispute_window_ends_at
  loop
    perform private.notify(v_row.buyer_id, 'window_reminder',
      format('%s hours left to open a dispute', v_row.hours),
      'After that the seller is paid automatically.',
      private.deal_link(v_row.id), format('reminder%s:%s:buyer', v_row.hours, v_row.id));
    v_reminders := v_reminders + 1;
  end loop;

  return jsonb_build_object(
    'overdue', v_overdue,
    'missing', v_missing,
    'rentalsReleased', v_rentals_released,
    'payouts', v_payouts,
    'salesReleased', v_sales_released,
    'reminderChecks', v_reminders
  );
end
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 19. Wallet, notifications, chat, reviews, admin RPCs
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.get_wallet_summary()
returns table (held numeric, available numeric, pending_payouts numeric, deposits_held numeric)
language sql stable security definer
set search_path = public
as $$
  select
    coalesce(sum(amount) filter (where bucket = 'held'), 0) as held,
    coalesce(sum(amount) filter (where bucket = 'available'), 0) as available,
    coalesce(sum(amount) filter (where bucket = 'held' and (
      (rental_id is not null and memo like 'Rental fee%') or transaction_id is not null)), 0) as pending_payouts,
    coalesce(sum(amount) filter (where bucket = 'held' and rental_id is not null and memo like 'Deposit%'), 0) as deposits_held
  from public.wallet_ledger
  where user_id = private.require_uid()
$$;

-- Simulated withdrawal of the available balance to the user's bank.
create or replace function public.wallet_withdraw(p_amount numeric)
returns public.wallet_ledger
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  v_balance numeric;
  e public.wallet_ledger;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount above ฿0.';
  end if;
  perform pg_advisory_xact_lock(hashtext('wallet:' || v_uid));
  v_balance := private.available_balance(v_uid);
  if p_amount > v_balance then
    raise exception 'You have ฿% available.', v_balance;
  end if;
  insert into public.wallet_ledger (user_id, kind, bucket, amount, memo)
  values (v_uid, 'withdrawal', 'available', -p_amount, 'Withdrawal to bank (simulated)')
  returning * into e;
  return e;
end
$$;

create or replace function public.mark_notifications_read(p_ids text[] default null)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  v_count integer;
begin
  update public.notifications set read_at = now()
  where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- One thread per listing per pair of users. Creates the thread, both
-- participants and the first message atomically, or appends to the
-- existing thread. Client ids are optional (for optimistic UI).
create or replace function public.start_thread(
  p_listing_id text, p_other_user_id text, p_text text,
  p_thread_id text default null, p_message_id text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  v_thread text;
  v_message text;
  v_created boolean := false;
begin
  if p_other_user_id is null or p_other_user_id = v_uid then
    raise exception 'Choose someone else to message.';
  end if;
  if not exists (select 1 from public.listings where id = p_listing_id) then
    raise exception 'Listing not found.';
  end if;
  if not exists (select 1 from public.users where id = p_other_user_id) then
    raise exception 'That user doesn''t exist.';
  end if;
  if p_text is null or char_length(trim(p_text)) = 0 then
    raise exception 'Write a message first.';
  end if;

  select t.id into v_thread
  from public.threads t
  where t.listing_id = p_listing_id
    and exists (select 1 from public.thread_participants a where a.thread_id = t.id and a.user_id = v_uid)
    and exists (select 1 from public.thread_participants b where b.thread_id = t.id and b.user_id = p_other_user_id)
  order by t.created_at
  limit 1;

  if v_thread is null then
    insert into public.threads (id, listing_id, created_by)
    values (coalesce(p_thread_id, gen_random_uuid()::text), p_listing_id, v_uid)
    returning id into v_thread;
    insert into public.thread_participants (thread_id, user_id)
    values (v_thread, v_uid), (v_thread, p_other_user_id);
    v_created := true;
  end if;

  insert into public.messages (id, thread_id, sender_id, text)
  values (coalesce(p_message_id, gen_random_uuid()::text), v_thread, v_uid, p_text)
  returning id into v_message;

  return jsonb_build_object('thread_id', v_thread, 'message_id', v_message, 'created', v_created);
end
$$;

create or replace function public.mark_thread_read(p_thread_id text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
begin
  update public.thread_participants set last_read_at = now()
  where thread_id = p_thread_id and user_id = v_uid;
  update public.notifications set read_at = now()
  where user_id = v_uid and dedupe_key = 'message:' || p_thread_id and read_at is null;
end
$$;

-- New message → one collapsing "new message" notification per thread.
create or replace function private.notify_new_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_participant record;
begin
  for v_participant in
    select user_id from public.thread_participants where thread_id = new.thread_id and user_id <> new.sender_id
  loop
    insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
    values (v_participant.user_id, 'message', 'New message from ' || private.user_name(new.sender_id),
            left(new.text, 140), '/chat?thread=' || new.thread_id, 'message:' || new.thread_id)
    on conflict (user_id, dedupe_key) do update
      set title = excluded.title, body = excluded.body, read_at = null, created_at = now();
  end loop;
  return new;
end
$$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
  after insert on public.messages
  for each row execute function private.notify_new_message();

-- New dispute comment → notify the other parties (and the admins).
create or replace function private.notify_dispute_comment()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  d public.disputes;
  v_user text;
begin
  select * into d from public.disputes where id = new.dispute_id;
  foreach v_user in array array[d.filed_by, d.against_id] loop
    if v_user <> new.author_id then
      perform private.notify(v_user, 'dispute_comment', 'New comment on a dispute',
        left(new.body, 140), '/dispute/' || d.id);
    end if;
  end loop;
  return new;
end
$$;

drop trigger if exists dispute_comments_notify on public.dispute_comments;
create trigger dispute_comments_notify
  after insert on public.dispute_comments
  for each row execute function private.notify_dispute_comment();

-- Review the other party of a finished rental or purchase; keeps the
-- subject's rating and review count up to date.
create or replace function public.submit_review(
  p_rating numeric, p_comment text default null,
  p_rental_id text default null, p_transaction_id text default null
)
returns public.reviews
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  r public.rentals;
  t public.transactions;
  v_subject text;
  v_listing text;
  v_role text;
  rv public.reviews;
  me public.users;
begin
  if num_nonnulls(p_rental_id, p_transaction_id) <> 1 then
    raise exception 'A review is about exactly one rental or one purchase.';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'The rating must be between 1 and 5.';
  end if;
  if p_rental_id is not null then
    select * into r from public.rentals where id = p_rental_id;
    if not found or v_uid not in (r.renter_id, r.owner_id) then
      raise exception 'Rental not found.';
    end if;
    if r.phase not in ('released', 'resolved', 'missing') then
      raise exception 'You can review once the rental is closed.';
    end if;
    v_subject := case when v_uid = r.renter_id then r.owner_id else r.renter_id end;
    v_role := case when v_uid = r.renter_id then 'renter' else 'owner' end;
    v_listing := r.listing_id;
  else
    select * into t from public.transactions where id = p_transaction_id;
    if not found or v_uid not in (t.buyer_id, t.seller_id) then
      raise exception 'Purchase not found.';
    end if;
    if t.status not in ('released', 'resolved', 'completed') or t.buyer_id is null then
      raise exception 'You can review once the purchase is complete.';
    end if;
    v_subject := case when v_uid = t.buyer_id then t.seller_id else t.buyer_id end;
    v_role := case when v_uid = t.buyer_id then 'buyer' else 'seller' end;
    v_listing := t.listing_id;
  end if;
  select * into me from public.users where id = v_uid;

  insert into public.reviews (listing_id, author_id, author_name, author_avatar, role, rating, comment, date,
                              subject_id, rental_id, transaction_id)
  values (v_listing, v_uid, me.name, me.avatar, v_role, p_rating, nullif(trim(p_comment), ''),
          to_char(now(), 'Mon YYYY'), v_subject, p_rental_id, p_transaction_id)
  returning * into rv;

  update public.users u
  set rating = s.avg_rating, reviews_count = s.n
  from (select round(avg(rating), 2) as avg_rating, count(*)::integer as n
        from public.reviews where subject_id = v_subject) s
  where u.id = v_subject;

  perform private.notify(v_subject, 'review', 'New review',
    format('%s left you %s stars.', me.name, p_rating), '/profile/' || v_subject);
  return rv;
exception when unique_violation then
  raise exception 'You already reviewed this deal.';
end
$$;

-- Admin demo helper: move one rental or sale back in time by p_hours so the
-- 48 h windows, payouts and late fees can be shown without waiting.
create or replace function public.admin_time_travel(p_id text, p_hours numeric)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_shift interval := make_interval(secs => p_hours * 3600);
begin
  if not public.is_admin() then
    raise exception 'Only an admin can move deals in time.';
  end if;
  if p_hours is null or p_hours <= 0 then
    raise exception 'Give a positive number of hours.';
  end if;
  update public.rentals set
    start_date = start_date - v_shift, due_date = due_date - v_shift,
    requested_at = requested_at - v_shift, approved_at = approved_at - v_shift,
    declined_at = declined_at - v_shift, cancelled_at = cancelled_at - v_shift,
    paid_at = paid_at - v_shift, handover_at = handover_at - v_shift,
    payout_at = payout_at - v_shift, overdue_at = overdue_at - v_shift,
    returned_at = returned_at - v_shift, dispute_window_ends_at = dispute_window_ends_at - v_shift
  where id = p_id;
  if found then
    return 'rental';
  end if;
  update public.transactions set
    paid_at = paid_at - v_shift, handover_at = handover_at - v_shift,
    dispute_window_ends_at = dispute_window_ends_at - v_shift
  where id = p_id;
  if found then
    return 'sale';
  end if;
  raise exception 'No rental or purchase with id %.', p_id;
end
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 20. Row Level Security
-- ───────────────────────────────────────────────────────────────────────────

alter table public.transactions enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_comments enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.notifications enable row level security;

-- users: profiles readable by signed-in users; own profile editable (guarded).
-- (baseline policies kept)

-- listings: public read (kept). Owners write their own (kept); admins moderate.
drop policy if exists "Admins can update any listing" on public.listings;
create policy "Admins can update any listing" on public.listings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins can delete any listing" on public.listings;
create policy "Admins can delete any listing" on public.listings
  for delete to authenticated using (public.is_admin());

-- listing_history: public read, written by the listing's seller.
drop policy if exists "Authenticated users can read listing history" on public.listing_history;
drop policy if exists "Authenticated users can create listing history" on public.listing_history;
drop policy if exists "Authenticated users can update listing history" on public.listing_history;
drop policy if exists "Listing history is publicly readable" on public.listing_history;
create policy "Listing history is publicly readable" on public.listing_history
  for select using (true);
drop policy if exists "Sellers add history to their listings" on public.listing_history;
create policy "Sellers add history to their listings" on public.listing_history
  for insert to authenticated
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())::text));
drop policy if exists "Sellers edit history of their listings" on public.listing_history;
create policy "Sellers edit history of their listings" on public.listing_history
  for update to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())::text))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())::text));

-- reviews: public read; written only through submit_review.
drop policy if exists "Authenticated users can read reviews" on public.reviews;
drop policy if exists "Authenticated users can create reviews" on public.reviews;
drop policy if exists "Authenticated users can update reviews" on public.reviews;
drop policy if exists "Reviews are publicly readable" on public.reviews;
create policy "Reviews are publicly readable" on public.reviews for select using (true);

-- needs: add delete-own.
drop policy if exists "Users can delete their own needs" on public.needs;
create policy "Users can delete their own needs" on public.needs
  for delete to authenticated using ((select auth.uid())::text = user_id);

-- threads / participants / messages: participants (and admins, for disputes).
drop policy if exists "Authenticated users can read threads" on public.threads;
drop policy if exists "Authenticated users can create threads" on public.threads;
drop policy if exists "Authenticated users can update threads" on public.threads;
drop policy if exists "Participants read their threads" on public.threads;
create policy "Participants read their threads" on public.threads
  for select to authenticated using (public.is_thread_participant(id) or public.is_admin());

drop policy if exists "Authenticated users can read participants" on public.thread_participants;
drop policy if exists "Authenticated users can add participants" on public.thread_participants;
drop policy if exists "Authenticated users can update participants" on public.thread_participants;
drop policy if exists "Participants read their thread members" on public.thread_participants;
create policy "Participants read their thread members" on public.thread_participants
  for select to authenticated using (public.is_thread_participant(thread_id) or public.is_admin());

drop policy if exists "Authenticated users can read messages" on public.messages;
drop policy if exists "Users can send messages" on public.messages;
drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages" on public.messages
  for select to authenticated using (public.is_thread_participant(thread_id) or public.is_admin());
drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages" on public.messages
  for insert to authenticated
  with check ((select auth.uid())::text = sender_id and public.is_thread_participant(thread_id));
-- "Users can update their messages" (sender only) kept.

-- rentals: renter, owner, admin read. No direct writes (RPCs only).
drop policy if exists "Authenticated users can read rentals" on public.rentals;
drop policy if exists "Users can create their own rentals" on public.rentals;
drop policy if exists "Users can update their own rentals" on public.rentals;
drop policy if exists "Parties read their rentals" on public.rentals;
create policy "Parties read their rentals" on public.rentals
  for select to authenticated
  using ((select auth.uid())::text in (renter_id, owner_id) or public.is_admin());

drop policy if exists "Parties read their purchases" on public.transactions;
create policy "Parties read their purchases" on public.transactions
  for select to authenticated
  using ((select auth.uid())::text in (buyer_id, seller_id) or public.is_admin());

drop policy if exists "Parties read their disputes" on public.disputes;
create policy "Parties read their disputes" on public.disputes
  for select to authenticated
  using (public.is_admin()
         or (rental_id is not null and public.is_rental_party(rental_id))
         or (transaction_id is not null and public.is_transaction_party(transaction_id)));

drop policy if exists "Parties read dispute comments" on public.dispute_comments;
create policy "Parties read dispute comments" on public.dispute_comments
  for select to authenticated using (public.is_admin() or public.is_dispute_party(dispute_id));
drop policy if exists "Parties comment on open disputes" on public.dispute_comments;
create policy "Parties comment on open disputes" on public.dispute_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())::text
    and (public.is_admin() or public.is_dispute_party(dispute_id))
    and exists (select 1 from public.disputes d where d.id = dispute_id and d.status = 'open')
  );

drop policy if exists "Users read their ledger" on public.wallet_ledger;
create policy "Users read their ledger" on public.wallet_ledger
  for select to authenticated
  using (user_id = (select auth.uid())::text or public.is_admin());

drop policy if exists "Users read their notifications" on public.notifications;
create policy "Users read their notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid())::text);
drop policy if exists "Users mark their notifications read" on public.notifications;
create policy "Users mark their notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())::text) with check (user_id = (select auth.uid())::text);
drop policy if exists "Users delete their notifications" on public.notifications;
create policy "Users delete their notifications" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid())::text);

-- ───────────────────────────────────────────────────────────────────────────
-- 21. Table and function privileges
-- ───────────────────────────────────────────────────────────────────────────

-- The baseline granted ALL to anon and authenticated; RLS stays the gate, but
-- remove what no client needs.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke insert, update, delete on all tables in schema public from anon;

-- Money and state tables: read through RLS, written only by the RPCs.
revoke insert, update, delete on public.rentals, public.transactions, public.disputes,
  public.wallet_ledger, public.threads, public.thread_participants, public.reviews
  from authenticated;
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;
revoke update, delete on public.dispute_comments from authenticated;
revoke all on public.dispute_comments from anon;

-- Functions: nothing in private is callable from the API; public RPCs only
-- for signed-in users, except the pure quotes and the RLS predicates.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.hook_before_user_created(jsonb) to supabase_auth_admin;
grant execute on function private.is_ait_email(text) to supabase_auth_admin;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'request_rental', 'respond_rental', 'cancel_rental', 'pay_rental', 'confirm_handover',
        'mark_returned', 'confirm_return', 'create_sale', 'confirm_sale_handover',
        'confirm_sale_receipt', 'mark_sold', 'cancel_sale', 'file_dispute', 'resolve_dispute',
        'run_escrow_jobs', 'get_wallet_summary', 'wallet_withdraw', 'mark_notifications_read',
        'start_thread', 'mark_thread_read', 'submit_review', 'admin_time_travel'
      )
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end
$$;

grant execute on function public.quote_rental(numeric, numeric) to anon, authenticated, service_role;
grant execute on function public.quote_sale(numeric, text) to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 22. Storage buckets
-- ───────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-photos', 'listing-photos', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']),
  ('dispute-evidence', 'dispute-evidence', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- listing-photos/<uid>/<file>: anyone reads, owners write their own folder.
drop policy if exists "Listing photos are publicly readable" on storage.objects;
create policy "Listing photos are publicly readable" on storage.objects
  for select using (bucket_id = 'listing-photos');
drop policy if exists "Users upload listing photos to their folder" on storage.objects;
create policy "Users upload listing photos to their folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users update their listing photos" on storage.objects;
create policy "Users update their listing photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users delete their listing photos" on storage.objects;
create policy "Users delete their listing photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- dispute-evidence/{rental|sale}/<id>/<uid>/<file>: parties + admins read,
-- parties upload into their own sub-folder. Evidence is never edited.
drop policy if exists "Parties and admins read evidence" on storage.objects;
create policy "Parties and admins read evidence" on storage.objects
  for select to authenticated
  using (bucket_id = 'dispute-evidence' and public.can_read_evidence(name));
drop policy if exists "Parties upload evidence" on storage.objects;
create policy "Parties upload evidence" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dispute-evidence' and public.can_write_evidence(name));

-- ───────────────────────────────────────────────────────────────────────────
-- 23. Realtime
-- ───────────────────────────────────────────────────────────────────────────

do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach v_table in array array['messages', 'notifications', 'rentals', 'transactions', 'dispute_comments', 'disputes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 24. Schedule run_escrow_jobs every 10 minutes when pg_cron is available.
--     The app also calls it lazily, so nothing breaks without pg_cron.
-- ───────────────────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'pass-it-on-escrow-jobs') then
      perform cron.unschedule('pass-it-on-escrow-jobs');
    end if;
    perform cron.schedule('pass-it-on-escrow-jobs', '*/10 * * * *', 'select public.run_escrow_jobs()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled (%); the app calls run_escrow_jobs() lazily instead.', sqlerrm;
end
$$;
