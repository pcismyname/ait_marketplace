-- Admin moderation (hide / restore / remove) and the dashboard counters
-- (20261025020300_admin_moderation.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- ── helpers (same block in every test file) ────────────────────────────────
create function pg_temp.new_user(p_email text, p_name text default null) returns text
language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
          jsonb_build_object('name', coalesce(p_name, split_part(p_email, '@', 1))), now(), now());
  return v::text;
end $$;
create function pg_temp.login(p_uid text) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_uid, 'role', 'authenticated', 'email', (select email from public.users where id = p_uid))::text, true);
end $$;
create function pg_temp.logout() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create temp table ids (k text primary key, v text);
grant all on ids to public;
create function pg_temp.set_id(p_k text, p_v text) returns text
language sql as $$ insert into ids values (p_k, p_v) on conflict (k) do update set v = excluded.v returning v $$;
create function pg_temp.id(p_k text) returns text
language sql stable as $$ select v from ids where k = p_k $$;
-- ───────────────────────────────────────────────────────────────────────────

select pg_temp.set_id('s', pg_temp.new_user('seller@ait.asia', 'Sam Seller'));
select pg_temp.set_id('b', pg_temp.new_user('buyer@ait.asia', 'Bea Buyer'));
select pg_temp.set_id('admin', pg_temp.new_user('admin@ait.asia', 'Ada Admin'));
update public.users set is_admin = true where id = pg_temp.id('admin');

-- A client can't create a pre-hidden listing.
select pg_temp.login(pg_temp.id('s'));
insert into public.listings (id, seller_id, title, description, category, type, price, condition, pickup_location, hidden_at, hidden_reason)
values ('l-lamp', pg_temp.id('s'), 'Lamp', 'Bright', 'other', 'sale', 200, 'good', 'Dorm A', now(), 'sneaky');
insert into public.listings (id, seller_id, title, description, category, type, price, condition, pickup_location)
values ('l-desk', pg_temp.id('s'), 'Desk', 'Solid', 'furniture', 'sale', 900, 'good', 'Dorm B'),
       ('l-chair', pg_temp.id('s'), 'Chair', 'Comfy', 'furniture', 'sale', 300, 'good', 'Dorm B'),
       ('l-bike', pg_temp.id('s'), 'Bike', 'Fast', 'bicycles', 'sale', 1500, 'good', 'Dorm C');
select is((select hidden_at from public.listings where id = 'l-lamp'), null, 'clients cannot set hidden_at on insert');

-- Only admins moderate.
select throws_ok($$ select public.admin_moderate_listing('l-lamp', 'hide') $$, 'P0001', 'Only an admin can moderate listings.', 'a seller cannot call the moderation RPC');
select throws_ok($$ select public.admin_stats() $$, 'P0001', 'Only an admin can see platform stats.', 'a non-admin cannot read the stats');

-- Hide: paused + flagged, seller notified, seller can't relist or unflag.
select pg_temp.login(pg_temp.id('admin'));
select is(public.admin_moderate_listing('l-lamp', 'hide', 'Duplicate listing'), 'hidden', 'admin hides a listing');
select pg_temp.logout();
select is((select status from public.listings where id = 'l-lamp'), 'paused', 'a hidden listing is paused');
select isnt((select hidden_at from public.listings where id = 'l-lamp'), null, 'hidden_at is set');
select is((select count(*)::int from public.notifications where user_id = pg_temp.id('s') and kind = 'listing_hidden'), 1, 'the seller is notified');
select pg_temp.login(pg_temp.id('s'));
select throws_ok($$ update public.listings set status = 'available' where id = 'l-lamp' $$, 'P0001', null, 'the seller cannot relist a hidden listing');
select throws_ok($$ update public.listings set hidden_at = null where id = 'l-lamp' $$, 'P0001', 'Only an admin can hide or restore a listing.', 'the seller cannot clear the flag');
select lives_ok($$ update public.listings set title = 'Lamp (warm light)' where id = 'l-lamp' $$, 'the seller can still edit other fields');

-- Restore: flag cleared, stays paused, the seller can relist.
select pg_temp.login(pg_temp.id('admin'));
select is(public.admin_moderate_listing('l-lamp', 'restore'), 'restored', 'admin restores the listing');
select pg_temp.login(pg_temp.id('s'));
select lives_ok($$ update public.listings set status = 'available' where id = 'l-lamp' $$, 'the seller can relist after a restore');

-- Hide refuses while a protected sale is in progress.
select pg_temp.login(pg_temp.id('b'));
select pg_temp.set_id('t', t.id) from public.create_sale('l-bike', 'protected', 'promptpay') t;
select pg_temp.login(pg_temp.id('admin'));
select throws_ok($$ select public.admin_moderate_listing('l-bike', 'hide') $$, 'P0001', null, 'cannot hide a listing with a protected sale in progress');

-- Remove: deletes a listing without history, refuses one with history.
select is(public.admin_moderate_listing('l-chair', 'remove', 'Spam'), 'removed', 'admin removes a listing');
select is((select count(*)::int from public.listings where id = 'l-chair'), 0, 'the listing is gone');
select pg_temp.login(pg_temp.id('s'));
select public.mark_sold('l-desk');
select pg_temp.login(pg_temp.id('admin'));
select throws_ok($$ select public.admin_moderate_listing('l-desk', 'remove') $$, 'P0001', null, 'a listing with sale history cannot be removed');
select throws_ok($$ select public.admin_moderate_listing('l-desk', 'archive') $$, 'P0001', null, 'unknown actions are refused');

-- Stats match the tables and the ledger.
select ok(
  (select s ->> 'users' = (select count(*) from public.users)::text
      and (s ->> 'platformRevenue')::numeric = (select coalesce(sum(amount), 0) from public.wallet_ledger where bucket = 'platform')
      and (s ->> 'heldEscrow')::numeric = (select coalesce(sum(amount), 0) from public.wallet_ledger where bucket = 'held')
      and (s ->> 'heldEscrow')::numeric > 0
      and (s ->> 'salesInEscrow')::int = (select count(*) from public.transactions where status in ('paid', 'handed-over', 'disputed'))
      and (s ->> 'openDisputes')::int = (select count(*) from public.disputes where status = 'open')
   from (select public.admin_stats() as s) x),
  'admin_stats counts users, held escrow and platform revenue');

select * from finish();
rollback;
