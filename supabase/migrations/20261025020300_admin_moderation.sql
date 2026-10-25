-- Admin area: listing moderation and dashboard counters.
--
--   * listings.hidden_at / hidden_by / hidden_reason: an admin hid the listing.
--     A hidden listing is paused, and its seller can't relist it (or clear the
--     flag) until an admin restores it.
--   * admin_moderate_listing(listing, 'hide' | 'restore' | 'remove', reason?)
--   * admin_stats(): the counters on /admin/dashboard, from the tables and the
--     simulated wallet ledger (BusinessRules §7).
--
-- Idempotent. No money moves here.

alter table public.listings add column if not exists hidden_at timestamptz;
alter table public.listings add column if not exists hidden_by text references public.users(id) on delete set null;
alter table public.listings add column if not exists hidden_reason text;

comment on column public.listings.hidden_at is 'Set when an admin hid the listing (moderation). Only admins can set or clear it.';

-- Clients only (RPCs run as the table owner and skip this). Admins pass.
create or replace function private.guard_listing_moderation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.hidden_at := null;
    new.hidden_by := null;
    new.hidden_reason := null;
    return new;
  end if;
  if new.hidden_at is distinct from old.hidden_at
     or new.hidden_by is distinct from old.hidden_by
     or new.hidden_reason is distinct from old.hidden_reason then
    raise exception 'Only an admin can hide or restore a listing.';
  end if;
  if old.hidden_at is not null and new.status is distinct from old.status then
    raise exception 'An admin hid this listing, so it can''t be relisted. Contact the Pass It On team.';
  end if;
  return new;
end
$$;

drop trigger if exists listings_moderation_guard on public.listings;
create trigger listings_moderation_guard
  before insert or update on public.listings
  for each row execute function private.guard_listing_moderation();

-- Hide (pause + flag), restore (clear the flag; stays paused until the seller
-- relists) or remove (delete; only without rental or sale history).
create or replace function public.admin_moderate_listing(
  p_listing_id text, p_action text, p_reason text default null
)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  l public.listings;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only an admin can moderate listings.';
  end if;
  select * into l from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found.';
  end if;

  if p_action = 'hide' then
    if public.listing_has_open_deal(l.id) then
      raise exception 'This listing has a booking or protected sale in progress. Resolve that first, then hide it.';
    end if;
    update public.listings
    set status = 'paused', hidden_at = now(), hidden_by = v_uid, hidden_reason = v_reason
    where id = l.id;
    perform private.notify(l.seller_id, 'listing_hidden', 'Listing hidden by an admin',
      format('"%s" was hidden from the marketplace%s.', l.title,
             coalesce(': ' || v_reason, '')), '/my-listings');
    return 'hidden';
  elsif p_action = 'restore' then
    if l.hidden_at is null then
      raise exception 'This listing isn''t hidden.';
    end if;
    update public.listings set hidden_at = null, hidden_by = null, hidden_reason = null where id = l.id;
    perform private.notify(l.seller_id, 'listing_restored', 'Listing restored',
      format('An admin restored "%s". It stays paused until you relist it.', l.title), '/my-listings');
    return 'restored';
  elsif p_action = 'remove' then
    if public.listing_has_history(l.id) then
      raise exception 'This listing has rental or sale history, so it can''t be removed. Hide it instead.';
    end if;
    if public.listing_has_open_deal(l.id) then
      raise exception 'This listing has a booking or protected sale in progress.';
    end if;
    delete from public.listings where id = l.id;
    perform private.notify(l.seller_id, 'listing_removed', 'Listing removed by an admin',
      format('"%s" was removed from the marketplace%s.', l.title,
             coalesce(': ' || v_reason, '')), '/my-listings');
    return 'removed';
  end if;
  raise exception 'Unknown action "%": use hide, restore or remove.', p_action;
end
$$;

-- Dashboard counters. Money comes from the simulated ledger: held = Σ held
-- bucket (deposits and payouts not yet released), revenue = Σ platform bucket.
create or replace function public.admin_stats()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can see platform stats.';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from public.users),
    'admins', (select count(*) from public.users where is_admin),
    'listings', (select count(*) from public.listings),
    'activeListings', (select count(*) from public.listings where status = 'available'),
    'hiddenListings', (select count(*) from public.listings where hidden_at is not null),
    'openDisputes', (select count(*) from public.disputes where status = 'open'),
    'resolvedDisputes', (select count(*) from public.disputes where status = 'resolved'),
    'rentalsInProgress', (select count(*) from public.rentals
                          where phase in ('paid', 'active', 'return-pending', 'disputed', 'overdue')),
    'salesInEscrow', (select count(*) from public.transactions where status in ('paid', 'handed-over', 'disputed')),
    'heldEscrow', (select coalesce(sum(amount), 0) from public.wallet_ledger where bucket = 'held'),
    'platformRevenue', (select coalesce(sum(amount), 0) from public.wallet_ledger where bucket = 'platform')
  );
end
$$;

revoke execute on function public.admin_moderate_listing(text, text, text) from public, anon;
grant execute on function public.admin_moderate_listing(text, text, text) to authenticated, service_role;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated, service_role;
