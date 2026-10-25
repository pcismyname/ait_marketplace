-- Fixes from the final review (migration 20261025030000_review_fixes.sql):
-- wallet lock, payout timing after a quick dispute, whole-baht dispute
-- amounts, condition photos and renter-confirmed handover, mark_sold only to
-- a buyer who asked, release_sale closing in-person intents, no message
-- edits, server-kept listing counters, deposit vs replacement value, and
-- item history. Data-independent: creates its own rows, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

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
create function pg_temp.bal(p_user text, p_bucket text) returns numeric
language sql stable as $$ select coalesce(sum(amount), 0) from public.wallet_ledger where user_id = p_user and bucket = p_bucket $$;
-- A condition photo uploaded by the signed-in party (storage RLS applies).
create function pg_temp.photo(p_rental text) returns text[]
language plpgsql as $$
declare v text := 'rental/' || p_rental || '/' || auth.uid()::text || '/' || gen_random_uuid()::text || '.png';
begin
  insert into storage.objects (bucket_id, name, owner_id) values ('dispute-evidence', v, auth.uid()::text);
  return array[v];
end $$;
-- Does this backend hold the per-user wallet advisory lock?
create function pg_temp.holds_wallet_lock(p_user text) returns boolean
language sql stable as $$
  select exists (
    select 1 from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid() and objsubid = 1
      and objid = (hashtext('wallet:' || p_user)::bigint & 4294967295)::oid)
$$;
-- ───────────────────────────────────────────────────────────────────────────

select pg_temp.set_id('owner', pg_temp.new_user('rf-owner@ait.asia', 'Olga Owner'));
select pg_temp.set_id('renter', pg_temp.new_user('rf-renter@ait.asia', 'Rae Renter'));
select pg_temp.set_id('buyer', pg_temp.new_user('rf-buyer@ait.asia', 'Bea Buyer'));
select pg_temp.set_id('other', pg_temp.new_user('rf-other@ait.asia', 'Otto Other'));
select pg_temp.set_id('admin', pg_temp.new_user('rf-admin@ait.asia', 'Ada Admin'));
update public.users set is_admin = true where id = pg_temp.id('admin');

insert into public.listings (id, seller_id, title, description, category, type, price, deposit, rental_period, condition, pickup_location)
values
  ('rf-lamp',  pg_temp.id('owner'), 'Lamp', 'Bright', 'furniture', 'rent', 100, 300, 'per week', 'good', 'SET Building'),
  ('rf-mat',   pg_temp.id('owner'), 'Yoga mat', 'Soft', 'sports', 'rent', 50, 200, 'per week', 'good', 'Sports Complex'),
  ('rf-desk',  pg_temp.id('owner'), 'Desk', 'Wood', 'furniture', 'sale', 1000, null, null, 'good', 'Dorm A Lobby'),
  ('rf-chair', pg_temp.id('owner'), 'Chair', 'Comfy', 'furniture', 'sale', 300, null, null, 'good', 'Dorm A Lobby');

-- ═══ 1. Wallet payments take the per-user wallet lock (BusinessRules §8)
insert into public.wallet_ledger (user_id, kind, bucket, amount, memo)
values (pg_temp.id('renter'), 'refund', 'available', 1000, 'test credit');
select pg_temp.login(pg_temp.id('renter'));
select pg_temp.set_id('r1', r.id) from public.request_rental('rf-lamp') r;
select pg_temp.login(pg_temp.id('owner'));
select public.respond_rental(pg_temp.id('r1'), true);
select pg_temp.logout();
select is(pg_temp.holds_wallet_lock(pg_temp.id('renter')), false, 'no wallet lock before paying');
select pg_temp.login(pg_temp.id('renter'));
select is(r.payment_method, 'wallet', 'the renter pays from the wallet') from public.pay_rental(pg_temp.id('r1'), 'wallet') r;
select pg_temp.logout();
select is(pg_temp.holds_wallet_lock(pg_temp.id('renter')), true, 'a wallet payment holds the wallet lock, like wallet_withdraw');

-- ═══ 2. Condition photos and renter-confirmed handover (§4, §9)
select pg_temp.login(pg_temp.id('renter'));
select throws_ok(format($$ select public.confirm_handover(%L, array['rental/elsewhere/x.png']) $$, pg_temp.id('r1')), 'P0001',
  format('Condition photos must be uploaded under dispute-evidence/rental/%s/.', pg_temp.id('r1')), 'photos must be under the rental''s folder');
select throws_ok(format($$ select public.confirm_handover(%L, array[%L]) $$, pg_temp.id('r1'),
  'rental/' || pg_temp.id('r1') || '/' || pg_temp.id('renter') || '/never-uploaded.png'), 'P0001', null, 'a photo path must be an uploaded object');
select is(r.handover_confirmed_by, pg_temp.id('renter'), 'the renter confirms the handover with a photo')
  from public.confirm_handover(pg_temp.id('r1'), pg_temp.photo(pg_temp.id('r1'))) r;
select throws_ok(format($$ select public.mark_returned(%L) $$, pg_temp.id('r1')), 'P0001',
  'Add at least one photo of the item''s condition at return.', 'mark_returned needs a photo');
select pg_temp.login(pg_temp.id('owner'));
select throws_ok(format($$ select public.confirm_return(%L) $$, pg_temp.id('r1')), 'P0001',
  'Add at least one photo of the item''s condition at return.', 'confirm_return of an active rental needs a photo');

-- Early return, the owner disputes at once.
select pg_temp.login(pg_temp.id('renter'));
select is(r.phase, 'return-pending', 'returned with a photo') from public.mark_returned(pg_temp.id('r1'), pg_temp.photo(pg_temp.id('r1'))) r;

-- ═══ 3. Whole baht for dispute amounts (§2)
select pg_temp.login(pg_temp.id('owner'));
select throws_ok(format($$ select public.file_dispute('Scratch', '', %L, null, '{}', 100.5) $$, pg_temp.id('r1')), 'P0001',
  'The claim must be a whole number of baht, ฿0 or more.', 'a fractional claim is refused');
select throws_ok(format($$ select public.file_dispute('Scratch', '', %L, null, '{}', -5) $$, pg_temp.id('r1')), 'P0001',
  'The claim must be a whole number of baht, ฿0 or more.', 'a negative claim is refused');
select pg_temp.set_id('d1', d.id) from public.file_dispute('Scratch', 'Deep scratch on the base', pg_temp.id('r1'), null, '{}', 100) d;
select pg_temp.login(pg_temp.id('admin'));
select throws_ok(format($$ select public.resolve_dispute(%L, 'repairable-damage', 99.5) $$, pg_temp.id('d1')), 'P0001',
  'The amount must be a whole number of baht.', 'a fractional repair cost is refused');

-- ═══ 4. Quick resolution: the rental fee still waits for 48 h after handover (§4)
select is(array[d.deposit_to_owner, d.deposit_to_renter], array[100, 200]::numeric[], 'repair cost ฿100 to the owner, ฿200 back')
  from public.resolve_dispute(pg_temp.id('d1'), 'repairable-damage', 100) d;
select pg_temp.logout();
select is((select phase from public.rentals where id = pg_temp.id('r1')), 'resolved', 'the rental is resolved');
select is((select payout_released_at from public.rentals where id = pg_temp.id('r1')), null, 'the rental fee is not paid before payout_at');
select is(pg_temp.bal(pg_temp.id('owner'), 'held'), 100::numeric, 'the ฿100 rental fee stays held');
select is(pg_temp.bal(pg_temp.id('owner'), 'available'), 100::numeric, 'only the ฿100 claim is in the owner''s wallet');
update public.rentals set payout_at = now() - interval '1 minute' where id = pg_temp.id('r1');
select public.run_escrow_jobs();
select isnt((select payout_released_at from public.rentals where id = pg_temp.id('r1')), null, 'the job pays a resolved rental at payout_at');
select is(pg_temp.bal(pg_temp.id('owner'), 'available'), 200::numeric, 'claim + rental fee = ฿200');

-- The owner can't confirm a handover alone.
select pg_temp.login(pg_temp.id('renter'));
select pg_temp.set_id('r2', r.id) from public.request_rental('rf-mat') r;
select pg_temp.login(pg_temp.id('owner'));
select public.respond_rental(pg_temp.id('r2'), true);
select pg_temp.login(pg_temp.id('renter'));
select public.pay_rental(pg_temp.id('r2'), 'promptpay');
select pg_temp.login(pg_temp.id('owner'));
select throws_ok(format($$ select public.confirm_handover(%L, pg_temp.photo(%L)) $$, pg_temp.id('r2'), pg_temp.id('r2')), 'P0001',
  'The renter confirms the handover once they have the item, at the pickup point.', 'the owner cannot start the payout clock');
select pg_temp.logout();
select is((select phase from public.rentals where id = pg_temp.id('r2')), 'paid', 'still paid, waiting for the renter');

-- ═══ 5. mark_sold only to a buyer who asked to buy
select pg_temp.login(pg_temp.id('owner'));
select throws_ok(format($$ select public.mark_sold('rf-chair', %L) $$, pg_temp.id('buyer')), 'P0001', null,
  'a seller cannot record a sale to a student who never asked');
select pg_temp.logout();
select is((select status from public.listings where id = 'rf-chair'), 'available', 'nothing was recorded');
select pg_temp.login(pg_temp.id('buyer'));
select public.create_sale('rf-chair', 'in-person');
select pg_temp.login(pg_temp.id('owner'));
select is(t.buyer_id, pg_temp.id('buyer'), 'with a pending purchase, the seller marks it sold to that buyer')
  from public.mark_sold('rf-chair', pg_temp.id('buyer')) t;

-- ═══ 6. A completed protected sale closes the other in-person requests
select pg_temp.login(pg_temp.id('other'));
select pg_temp.set_id('t-intent', t.id) from public.create_sale('rf-desk', 'in-person') t;
select pg_temp.login(pg_temp.id('buyer'));
select pg_temp.set_id('t-prot', t.id) from public.create_sale('rf-desk', 'protected', 'card') t;
select public.confirm_sale_receipt(pg_temp.id('t-prot'));
select pg_temp.logout();
select is((select status from public.listings where id = 'rf-desk'), 'sold', 'the desk is sold');
select is((select status from public.transactions where id = pg_temp.id('t-intent')), 'cancelled', 'the other buyer''s in-person request is cancelled');
select is((select count(*)::int from public.notifications where user_id = pg_temp.id('other') and kind = 'sale_cancelled'), 1, 'and that buyer is told');

-- ═══ 7. Chat messages can't be edited (they are dispute evidence)
select pg_temp.login(pg_temp.id('buyer'));
select pg_temp.set_id('msg', public.start_thread('rf-desk', pg_temp.id('owner'), 'It wobbles a bit') ->> 'message_id');
select throws_ok(format($$ update public.messages set text = 'All fine' where id = %L $$, pg_temp.id('msg')), '42501', null,
  'a sender cannot rewrite a message');

-- ═══ 8. Listing counters, deposit vs replacement value, item history
select pg_temp.login(pg_temp.id('owner'));
insert into public.listings (id, seller_id, title, description, category, type, price, deposit, rental_period, condition,
                             pickup_location, replacement_value, times_changed_hands, view_count)
values ('rf-new', pg_temp.id('owner'), 'Rice cooker', 'Works', 'kitchen', 'rent', 100, 800, 'per week', 'good',
        'Dorm A Lobby', 2000, 42, 99999);
select is((select array[times_changed_hands, view_count] from public.listings where id = 'rf-new'), array[1, 0],
  'client inserts start with the server''s counters');
select throws_ok($$ update public.listings set view_count = 99999 where id = 'rf-new' $$, 'P0001', null, 'views can''t be edited');
select throws_ok($$ update public.listings set times_changed_hands = 42 where id = 'rf-new' $$, 'P0001', null, 'hand-over counts can''t be edited');
select throws_ok($$ update public.listings set deposit = 1500 where id = 'rf-new' $$, 'P0001',
  'For an item worth ฿2,000, the deposit must be between ฿600 and ฿1,000.', 'deposit above 50% of the value is refused');
select throws_ok(format($$ insert into public.listings (seller_id, title, description, category, type, price, deposit, rental_period, condition, pickup_location, replacement_value)
  values (%L, 'Kettle', 'x', 'kitchen', 'rent', 50, 3000, 'per week', 'good', 'Dorm A Lobby', 2000) $$, pg_temp.id('owner')), 'P0001', null,
  'a new rental with a deposit outside 30–50% of its value is refused');
select lives_ok($$ update public.listings set deposit = 1000 where id = 'rf-new' $$, 'a deposit of 50% is accepted');

select lives_ok($$ insert into public.listing_history (listing_id, owner_name, action, date) values ('rf-new', 'Olga Owner', 'Listed on PassItOn', 'Oct 2026') $$,
  'the seller adds the "Listed on" entry to a new listing');
select throws_ok($$ insert into public.listing_history (listing_id, owner_name, action, date) values ('rf-new', 'Olga Owner', 'Listed on PassItOn', 'Oct 2026') $$,
  '42501', null, 'only once');
select throws_ok($$ insert into public.listing_history (listing_id, owner_name, action, date) values ('rf-chair', 'AIT President', 'Bought with buyer protection', 'Oct 2026') $$,
  '42501', null, 'a seller cannot fake a purchase in the item history');
select throws_ok($$ update public.listing_history set owner_name = 'AIT President' where listing_id = 'rf-chair' $$,
  '42501', null, 'item history rows cannot be edited');
select pg_temp.logout();

select * from finish();
rollback;
