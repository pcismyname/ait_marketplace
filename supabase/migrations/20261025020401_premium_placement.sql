-- Premium placement as a simulated charge, plus two listing guards.
--
--   1. Premium placement (BusinessRules §2): the lister pays ฿49 for 7 days,
--      simulated like every other charge (§7, no gateway). Clients can no
--      longer write listings.featured / featured_until; they go through
--        enable_premium_placement(listing, method)  → ledger: payment −49,
--                                                     platform +49; 7 days
--        end_premium_placement(listing)             → ends early, no refund
--      A client insert always starts unfeatured. Rows with featured = true
--      and no featured_until are legacy seed data (service role only) and
--      keep counting as featured (public.is_featured, 20261025020400).
--   2. The listing type (sale ↔ rent) can't change while rental requests or
--      in-person purchase intents wait, or a deal is in progress
--      (respond_rental / mark_sold don't re-check the type).
--      Prices and deposits written by clients must be whole baht.
--   3. Deleting a listing cascades to its pending requests, purchase intents
--      and chat threads; the other students involved get a notification.
--
-- Idempotent.

create or replace function private.premium_placement_fee()
returns numeric
language sql immutable
set search_path = ''
as $$ select 49::numeric $$;  -- lib/fees.ts PREMIUM_PLACEMENT_FEE

create or replace function private.premium_placement_days()
returns integer
language sql immutable
set search_path = ''
as $$ select 7 $$;  -- lib/fees.ts PREMIUM_PLACEMENT_DAYS

-- ─── Guard (clients only; RPCs run as the table owner and skip it) ──────────
create or replace function private.guard_listing_premium_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  -- Whole baht only (BusinessRules §2 rounds every amount to the baht).
  if (tg_op = 'INSERT' or new.price is distinct from old.price) and new.price <> trunc(new.price) then
    raise exception 'The price must be a whole number of baht.';
  end if;
  if (tg_op = 'INSERT' or new.deposit is distinct from old.deposit) and new.deposit <> trunc(new.deposit) then
    raise exception 'The deposit must be a whole number of baht.';
  end if;

  if tg_op = 'INSERT' then
    new.featured := false;
    new.featured_until := null;
    return new;
  end if;

  if new.featured is distinct from old.featured or new.featured_until is distinct from old.featured_until then
    raise exception 'Premium placement is turned on (฿49 for 7 days) or off from the listing''s Premium placement option.';
  end if;

  if new.type is distinct from old.type and (
       public.listing_has_open_deal(old.id)
       or exists (select 1 from public.rentals r where r.listing_id = old.id and r.phase = 'requested')
       or exists (select 1 from public.transactions t where t.listing_id = old.id and t.status = 'pending')
     ) then
    raise exception 'This listing has requests or a deal in progress, so it can''t switch between sale and rent. Decline or finish them first.';
  end if;
  return new;
end
$$;

drop trigger if exists listings_premium_type_guard on public.listings;
create trigger listings_premium_type_guard
  before insert or update on public.listings
  for each row execute function private.guard_listing_premium_type();

-- ─── Premium placement RPCs ─────────────────────────────────────────────────
create or replace function public.enable_premium_placement(p_listing_id text, p_method text default 'promptpay')
returns public.listings
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  v_fee numeric := private.premium_placement_fee();
  v_days integer := private.premium_placement_days();
  v_memo text;
  l public.listings;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found.';
  end if;
  if l.seller_id is distinct from v_uid then
    raise exception 'Only the lister can buy premium placement for this listing.';
  end if;
  if l.hidden_at is not null then
    raise exception 'An admin hid this listing, so it can''t be promoted.';
  end if;
  if l.status <> 'available' then
    raise exception 'Only an active listing can be promoted. Make it active first.';
  end if;
  if public.is_featured(l) then
    if l.featured_until is null then
      raise exception 'Premium placement is already active for this listing.';
    end if;
    raise exception 'Premium placement is already active until %.',
      to_char(l.featured_until at time zone 'Asia/Bangkok', 'FMDD Mon');
  end if;

  perform pg_advisory_xact_lock(hashtext('wallet:' || v_uid));
  v_memo := format('Premium placement: %s (%s days)', l.title, v_days);
  perform private.take_payment(v_uid, v_fee, p_method, v_memo);
  perform private.ledger(null, 'platform_fee', 'platform', v_fee, v_memo);

  update public.listings
     set featured = true, featured_until = now() + make_interval(days => v_days)
   where id = l.id
  returning * into l;

  perform private.notify(
    v_uid, 'premium_placement', 'Premium placement is on',
    format('“%s” appears first in search until %s. Paid ฿%s (simulated).',
           l.title, to_char(l.featured_until at time zone 'Asia/Bangkok', 'FMDD Mon'), v_fee),
    '/listing/' || l.id);
  return l;
end
$$;

comment on function public.enable_premium_placement(text, text) is
  'Lister pays ฿49 (simulated; promptpay | card | wallet) for 7 days of premium placement. BusinessRules §2.';

create or replace function public.end_premium_placement(p_listing_id text)
returns public.listings
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  l public.listings;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found.';
  end if;
  if l.seller_id is distinct from v_uid then
    raise exception 'Only the lister can change premium placement.';
  end if;
  update public.listings set featured = false, featured_until = null where id = l.id returning * into l;
  return l;
end
$$;

comment on function public.end_premium_placement(text) is
  'Lister ends premium placement early. No refund (BusinessRules §2).';

revoke all on function public.enable_premium_placement(text, text) from public, anon;
revoke all on function public.end_premium_placement(text) from public, anon;
grant execute on function public.enable_premium_placement(text, text) to authenticated, service_role;
grant execute on function public.end_premium_placement(text) to authenticated, service_role;

-- ─── Tell the other students when a listing is deleted ──────────────────────
-- BEFORE DELETE: the cascaded rows still exist. If the delete is refused
-- (listings_guard: money history) the whole statement rolls back, so do these.
create or replace function private.notify_listing_deleted()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user record;
begin
  for v_user in
    select r.renter_id as user_id, 'request' as what
      from public.rentals r where r.listing_id = old.id and r.phase = 'requested'
    union
    select t.buyer_id, 'request'
      from public.transactions t where t.listing_id = old.id and t.status = 'pending'
    union
    select p.user_id, 'chat'
      from public.thread_participants p join public.threads th on th.id = p.thread_id
     where th.listing_id = old.id
  loop
    if v_user.user_id is null or v_user.user_id = old.seller_id then
      continue;
    end if;
    perform private.notify(
      v_user.user_id, 'listing_removed', 'A listing you were following was removed',
      case when v_user.what = 'request'
        then format('“%s” was deleted by its lister, so your request for it was closed. Nothing was charged.', old.title)
        else format('“%s” was deleted by its lister, and your conversation about it was removed with it.', old.title)
      end,
      '/browse',
      'listing_removed:' || old.id);
  end loop;
  return old;
end
$$;

drop trigger if exists listings_notify_deleted on public.listings;
create trigger listings_notify_deleted
  before delete on public.listings
  for each row execute function private.notify_listing_deleted();
