-- Sales (BusinessRules §5) and disputes (§6): protected escrow, in-person
-- sales without escrow, the 48 h window, admin findings and the deposit cap.
begin;
create extension if not exists pgtap with schema extensions;
select plan(59);

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
create function pg_temp.status(p_tx text) returns text
language sql stable as $$ select status from public.transactions where id = p_tx $$;
-- A condition photo uploaded by the signed-in party (storage RLS applies).
create function pg_temp.photo(p_rental text) returns text[]
language plpgsql as $$
declare v text := 'rental/' || p_rental || '/' || auth.uid()::text || '/' || gen_random_uuid()::text || '.png';
begin
  insert into storage.objects (bucket_id, name, owner_id) values ('dispute-evidence', v, auth.uid()::text);
  return array[v];
end $$;
-- Run a rental up to return-pending (as each party), returning its id.
create function pg_temp.returned_rental(p_listing text, p_renter text, p_owner text, p_days_late integer default 0) returns text
language plpgsql as $$
declare v text;
begin
  perform pg_temp.login(p_renter);
  select id into v from public.request_rental(p_listing);
  perform pg_temp.login(p_owner);
  perform public.respond_rental(v, true);
  perform pg_temp.login(p_renter);
  perform public.pay_rental(v, 'promptpay');
  perform public.confirm_handover(v, pg_temp.photo(v));
  perform pg_temp.logout();
  update public.rentals set due_date = now() - make_interval(days => p_days_late) where id = v;
  perform pg_temp.login(p_renter);
  perform public.mark_returned(v, pg_temp.photo(v));
  perform pg_temp.logout();
  return v;
end $$;
-- ───────────────────────────────────────────────────────────────────────────

select pg_temp.set_id('seller', pg_temp.new_user('seller@ait.asia', 'Sam Seller'));
select pg_temp.set_id('buyer', pg_temp.new_user('buyer@ait.asia', 'Bo Buyer'));
select pg_temp.set_id('other', pg_temp.new_user('other@ait.asia', 'Oscar Other'));
select pg_temp.set_id('admin', pg_temp.new_user('admin@ait.asia', 'Ada Admin'));
update public.users set is_admin = true where id = pg_temp.id('admin');

insert into public.listings (id, seller_id, title, description, category, type, price, deposit, rental_period, condition, pickup_location)
values
  ('l-desk',    pg_temp.id('seller'), 'Desk', 'Wood', 'furniture', 'sale', 1000, null, null, 'good', 'Dorm A Lobby'),
  ('l-chair',   pg_temp.id('seller'), 'Chair', 'Comfy', 'furniture', 'sale', 500, null, null, 'good', 'Dorm A Lobby'),
  ('l-monitor', pg_temp.id('seller'), 'Monitor', '24 inch', 'electronics', 'sale', 2000, null, null, 'good', 'SET Building'),
  ('l-fridge',  pg_temp.id('seller'), 'Fridge', 'Cold', 'electronics', 'rent', 250, 800, 'per semester', 'good', 'Dorm A Lobby'),
  ('l-bike',    pg_temp.id('seller'), 'Bike', 'Fast', 'bicycles', 'rent', 300, 800, 'per month', 'good', 'Dorm B Lobby'),
  ('l-kettle',  pg_temp.id('seller'), 'Kettle', 'Hot', 'kitchen', 'rent', 100, 300, 'per week', 'good', 'Dorm B Lobby'),
  ('l-cooker',  pg_temp.id('seller'), 'Cooker', 'Rice', 'kitchen', 'rent', 100, 300, 'per week', 'good', 'Dorm B Lobby');

-- ═══ Protected sale: paid → handed-over → disputed → resolved (partial refund)
select pg_temp.login(pg_temp.id('buyer'));
select throws_ok($$ select public.create_sale('l-desk', 'protected') $$, 'P0001', null, 'a protected sale needs a payment method');
select pg_temp.set_id('t1', t.id) from public.create_sale('l-desk', 'protected', 'promptpay') t;
select is(pg_temp.status(pg_temp.id('t1')), 'paid', 'protected sale starts paid (held)');
select is((select array[price, protection_fee, total] from public.transactions where id = pg_temp.id('t1')), array[1000, 40, 1040]::numeric[], '฿1,000 + ฿40 = ฿1,040');
select is((select status from public.listings where id = 'l-desk'), 'reserved', 'the listing is reserved');
select is((select seller_commission from public.transactions where id = pg_temp.id('t1')), 100::numeric, 'the 10% sale commission is quoted at checkout');
select throws_ok($$ select public.create_sale('l-fridge', 'protected', 'card') $$, 'P0001', null, 'rental listings cannot be bought');
select throws_ok(format($$ select public.file_dispute('Broken', '', null, %L) $$, pg_temp.id('t1')), 'P0001', null, 'no dispute before handover');
select pg_temp.logout();
select is(pg_temp.bal(pg_temp.id('seller'), 'held'), 1000::numeric, 'the price is held for the seller');
select is((select sum(amount) from public.wallet_ledger where bucket = 'platform' and transaction_id = pg_temp.id('t1')), 40::numeric, 'platform keeps the protection fee');

select pg_temp.login(pg_temp.id('other'));
select throws_ok($$ select public.create_sale('l-desk', 'in-person') $$, 'P0001', null, 'a reserved item cannot be bought');
select throws_ok(format($$ select public.confirm_sale_handover(%L) $$, pg_temp.id('t1')), 'P0001', 'Purchase not found.', 'strangers cannot touch the purchase');

select pg_temp.login(pg_temp.id('seller'));
select throws_ok(format($$ select public.confirm_sale_receipt(%L) $$, pg_temp.id('t1')), 'P0001', 'Only the buyer can confirm receipt.', 'only the buyer confirms receipt');
select throws_ok(format($$ select public.cancel_sale(%L) $$, pg_temp.id('t1')), 'P0001', null, 'a protected payment cannot be cancelled');
select throws_ok($$ select public.mark_sold('l-desk') $$, 'P0001', null, 'mark_sold refuses while a protected sale is open');
select is(t.status, 'handed-over', 'seller confirms the handover') from public.confirm_sale_handover(pg_temp.id('t1')) t;
select is((select dispute_window_ends_at - handover_at from public.transactions where id = pg_temp.id('t1')), interval '48 hours', '48 h window from handover');
select throws_ok(format($$ select public.file_dispute('Not as shown', '', null, %L) $$, pg_temp.id('t1')), 'P0001', 'Only the buyer can open a dispute on a purchase.', 'the seller cannot dispute a purchase');

select pg_temp.login(pg_temp.id('buyer'));
select throws_ok(format($$ select public.file_dispute('Scratched', '', null, %L, array['rental/x/y.jpg']) $$, pg_temp.id('t1')), 'P0001', null, 'evidence must sit under the purchase''s folder');
select throws_ok(format($$ select public.file_dispute('Scratched', '', null, %L, '{}', 5000) $$, pg_temp.id('t1')), 'P0001', null, 'a refund claim cannot exceed the price');
select pg_temp.set_id('d1', d.id) from public.file_dispute('Scratched top', 'Deep scratch not in photos', null, pg_temp.id('t1'),
  array['sale/' || pg_temp.id('t1') || '/' || pg_temp.id('buyer') || '/scratch.jpg'], 400) d;
select is(pg_temp.status(pg_temp.id('t1')), 'disputed', 'filing a dispute moves the sale to disputed');
select throws_ok(format($$ select public.file_dispute('Again', '', null, %L) $$, pg_temp.id('t1')), 'P0001', null, 'one dispute at a time');
select throws_ok(format($$ select public.resolve_dispute(%L, 'not-as-described', 400) $$, pg_temp.id('d1')), 'P0001', 'Only an admin can resolve disputes.', 'parties cannot resolve');
select lives_ok(format($$ insert into public.dispute_comments (dispute_id, body) values (%L, 'Photos attached') $$, pg_temp.id('d1')), 'a party can comment');
select pg_temp.login(pg_temp.id('other'));
select throws_ok(format($$ insert into public.dispute_comments (dispute_id, body) values (%L, 'Hi') $$, pg_temp.id('d1')), '42501', null, 'strangers cannot comment');
select is((select count(*)::int from public.disputes), 0, 'strangers cannot see the dispute');
select pg_temp.logout();
select is((select count(*)::int from public.notifications where kind = 'dispute_opened' and user_id = pg_temp.id('admin')), 1, 'admins are notified of new disputes');
select is((select count(*)::int from public.notifications where kind = 'dispute_comment' and user_id = pg_temp.id('seller')), 1, 'the other party is notified of comments');

select pg_temp.login(pg_temp.id('admin'));
select throws_ok(format($$ select public.resolve_dispute(%L, 'not-as-described', 1500) $$, pg_temp.id('d1')), 'P0001', null, 'a refund cannot exceed the price');
select throws_ok(format($$ select public.resolve_dispute(%L, 'lost-or-destroyed') $$, pg_temp.id('d1')), 'P0001', null, 'rental findings do not apply to sales');
select is(d.status, 'resolved', 'the admin resolves: not as described, ฿400 back')
  from public.resolve_dispute(pg_temp.id('d1'), 'not-as-described', 400, 'Scratch confirmed from photos') d;
select throws_ok(format($$ select public.resolve_dispute(%L, 'normal-wear') $$, pg_temp.id('d1')), 'P0001', null, 'a dispute is resolved once');
select pg_temp.logout();
select is(pg_temp.status(pg_temp.id('t1')), 'resolved', 'the sale is resolved');
select is(pg_temp.bal(pg_temp.id('seller'), 'available'), 540::numeric, 'seller gets ฿600 minus 10% commission on it = ฿540');
select is((select array[seller_amount, seller_commission] from public.transactions where id = pg_temp.id('t1')), array[540, 60]::numeric[], 'commission is charged on what the seller keeps');
select is((select seller_amount from public.disputes where id = pg_temp.id('d1')), 540::numeric, 'the dispute records the net payout');
select is((select sum(amount) from public.wallet_ledger where bucket = 'platform' and transaction_id = pg_temp.id('t1')), 100::numeric, 'platform keeps ฿40 protection + ฿60 commission');
select is(pg_temp.bal(pg_temp.id('buyer'), 'available'), 400::numeric, 'buyer gets ฿400 back in the wallet');
select is(pg_temp.bal(pg_temp.id('seller'), 'held'), 0::numeric, 'nothing stays held');
select is((select status from public.listings where id = 'l-desk'), 'sold', 'a partly refunded item is sold');

-- ═══ Protected sale auto-release after 48 h; late disputes are refused
select pg_temp.login(pg_temp.id('buyer'));
select pg_temp.set_id('t2', t.id) from public.create_sale('l-chair', 'protected', 'card') t;
select public.confirm_sale_handover(pg_temp.id('t2'));
select pg_temp.logout();
update public.transactions set handover_at = now() - interval '49 hours', dispute_window_ends_at = now() - interval '1 hour' where id = pg_temp.id('t2');
select pg_temp.login(pg_temp.id('buyer'));
select throws_ok(format($$ select public.file_dispute('Late', '', null, %L) $$, pg_temp.id('t2')), 'P0001', 'The 48-hour dispute window for this purchase has closed.', 'disputes close after 48 h');
select pg_temp.logout();
select public.run_escrow_jobs();
select is(pg_temp.status(pg_temp.id('t2')), 'released', 'auto-released when the window closes');
select is(pg_temp.bal(pg_temp.id('seller'), 'available'), 990::numeric, 'seller now has ฿540 + ฿450 (฿500 minus commission)');
select is((select times_changed_hands from public.listings where id = 'l-chair'), 2, 'the item changed hands once more');

-- ═══ In person: no escrow, no dispute, seller marks it sold
select pg_temp.login(pg_temp.id('buyer'));
select pg_temp.set_id('t3', t.id) from public.create_sale('l-monitor', 'in-person') t;
select is((select array[protection_fee, total] from public.transactions where id = pg_temp.id('t3')), array[0, 2000]::numeric[], 'in person: no fee, total = price');
select is((select status from public.listings where id = 'l-monitor'), 'available', 'an in-person intent does not reserve the listing');
select throws_ok(format($$ select public.file_dispute('Broken', '', null, %L) $$, pg_temp.id('t3')), 'P0001', 'Sales paid in person have no dispute support.', 'in-person sales have no disputes');
select throws_ok($$ select public.mark_sold('l-monitor') $$, 'P0001', 'Only the seller can mark this listing sold.', 'only the seller marks it sold');
select pg_temp.login(pg_temp.id('other'));
select pg_temp.set_id('t4', t.id) from public.create_sale('l-monitor', 'in-person') t;
select pg_temp.login(pg_temp.id('seller'));
select is(t.status, 'completed', 'the seller marks it sold to the buyer') from public.mark_sold('l-monitor', pg_temp.id('buyer')) t;
select pg_temp.logout();
select is(pg_temp.status(pg_temp.id('t3')), 'completed', 'that buyer''s pending purchase is completed');
select is(pg_temp.status(pg_temp.id('t4')), 'cancelled', 'the other pending purchase is cancelled');
select is((select count(*)::int from public.wallet_ledger where transaction_id in (pg_temp.id('t3'), pg_temp.id('t4'))), 0, 'no money moves through the platform');

-- ═══ Rental disputes: findings and the deposit cap
select pg_temp.set_id('r1', pg_temp.returned_rental('l-fridge', pg_temp.id('buyer'), pg_temp.id('seller')));
select pg_temp.login(pg_temp.id('seller'));
select throws_ok(format($$ select public.file_dispute('Broken door', '', %L, null, '{}', 900) $$, pg_temp.id('r1')), 'P0001', null, 'a claim cannot exceed the deposit');
select pg_temp.set_id('d2', d.id) from public.file_dispute('Broken door', 'Hinge snapped', pg_temp.id('r1'), null, '{}', 500) d;
select pg_temp.login(pg_temp.id('admin'));
select throws_ok(format($$ select public.resolve_dispute(%L, 'repairable-damage', 900) $$, pg_temp.id('d2')), 'P0001', null, 'repair cost above the deposit is refused');
select throws_ok(format($$ select public.resolve_dispute(%L, 'not-as-described') $$, pg_temp.id('d2')), 'P0001', null, 'not-as-described is for sales');
select is(array[d.deposit_to_owner, d.deposit_to_renter], array[800, 0]::numeric[], 'lost or destroyed: full deposit to the owner, never more')
  from public.resolve_dispute(pg_temp.id('d2'), 'lost-or-destroyed') d;
select pg_temp.logout();
select is((select phase from public.rentals where id = pg_temp.id('r1')), 'resolved', 'the rental is resolved');

-- Repairable damage on a late return: ฿30 late fee + ฿200 repair.
select pg_temp.set_id('r2', pg_temp.returned_rental('l-bike', pg_temp.id('buyer'), pg_temp.id('seller'), 3));
select pg_temp.login(pg_temp.id('buyer'));
select pg_temp.set_id('d3', d.id) from public.file_dispute('Late fee unfair', '', pg_temp.id('r2')) d;
select pg_temp.login(pg_temp.id('admin'));
select is(array[d.deposit_to_owner, d.deposit_to_renter], array[230, 570]::numeric[], 'repairable damage: late fee + repair to the owner, the rest back')
  from public.resolve_dispute(pg_temp.id('d3'), 'repairable-damage', 200) d;

-- Normal wear: only the (zero) late fee goes to the owner.
select pg_temp.set_id('r3', pg_temp.returned_rental('l-kettle', pg_temp.id('buyer'), pg_temp.id('seller')));
select pg_temp.login(pg_temp.id('seller'));
select pg_temp.set_id('d4', d.id) from public.file_dispute('Stains', '', pg_temp.id('r3')) d;
select pg_temp.login(pg_temp.id('admin'));
select is(array[d.deposit_to_owner, d.deposit_to_renter], array[0, 300]::numeric[], 'normal wear: ฿0 to the owner, full deposit back')
  from public.resolve_dispute(pg_temp.id('d4'), 'normal-wear') d;
select pg_temp.logout();

-- Rental window closed.
select pg_temp.set_id('r4', pg_temp.returned_rental('l-cooker', pg_temp.id('buyer'), pg_temp.id('seller')));
update public.rentals set dispute_window_ends_at = now() - interval '1 minute' where id = pg_temp.id('r4');
select pg_temp.login(pg_temp.id('seller'));
select throws_ok(format($$ select public.file_dispute('Too late', '', %L) $$, pg_temp.id('r4')), 'P0001', 'The 48-hour dispute window for this rental has closed.', 'rental disputes close 48 h after the return');
select pg_temp.logout();

select * from finish();
rollback;
