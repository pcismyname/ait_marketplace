-- Rental state machine (BusinessRules §4): every transition, the forbidden
-- ones, the simulated ledger, owner payout, late fees, missing, auto-release
-- and window reminders. Time is moved by editing timestamps as postgres.
begin;
create extension if not exists pgtap with schema extensions;
select plan(66);

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
-- Balance of a user's bucket (run as postgres).
create function pg_temp.bal(p_user text, p_bucket text) returns numeric
language sql stable as $$ select coalesce(sum(amount), 0) from public.wallet_ledger where user_id = p_user and bucket = p_bucket $$;
create function pg_temp.phase(p_rental text) returns text
language sql stable as $$ select phase from public.rentals where id = p_rental $$;
-- ───────────────────────────────────────────────────────────────────────────

select pg_temp.set_id('owner', pg_temp.new_user('owner@ait.asia', 'Olivia Owner'));
select pg_temp.set_id('renter', pg_temp.new_user('renter@ait.asia', 'Ravi Renter'));
select pg_temp.set_id('other', pg_temp.new_user('other@ait.asia', 'Oscar Other'));

insert into public.listings (id, seller_id, title, description, category, type, price, deposit, rental_period, condition, pickup_location)
values
  ('l-fridge', pg_temp.id('owner'), 'Mini fridge', 'Quiet', 'electronics', 'rent', 250, 800, 'per semester', 'good', 'Dorm A Lobby'),
  ('l-bike',   pg_temp.id('owner'), 'Bike', 'Fast', 'bicycles', 'rent', 300, 800, 'per month', 'good', 'Dorm B Lobby'),
  ('l-lamp',   pg_temp.id('owner'), 'Lamp', 'Bright', 'furniture', 'rent', 100, 300, 'per week', 'good', 'SET Building'),
  ('l-mat',    pg_temp.id('owner'), 'Yoga mat', 'Soft', 'sports', 'rent', 50, 200, 'per week', 'good', 'Sports Complex'),
  ('l-desk',   pg_temp.id('owner'), 'Desk', 'Wood', 'furniture', 'sale', 1000, null, null, 'good', 'Dorm A Lobby'),
  ('l-old',    pg_temp.id('owner'), 'Legacy', 'No deposit', 'other', 'rent', 100, null, 'per week', 'good', 'SET Building');

-- ═══ Happy path: requested → approved → paid → active → return-pending → released
select pg_temp.login(pg_temp.id('renter'));
select pg_temp.set_id('r1', r.id) from public.request_rental('l-fridge', 'Friday pickup?') r;
select is(pg_temp.phase(pg_temp.id('r1')), 'requested', 'request_rental creates a requested booking');
select is((select owner_id from public.rentals where id = pg_temp.id('r1')), pg_temp.id('owner'), 'owner_id is denormalised from the listing');
select is((select (quote ->> 'totalDueNow')::numeric from public.rentals where id = pg_temp.id('r1')), 1105::numeric, 'the stored quote is ฿1,105');
select is((select array[rental_fee, commission, escrow_fee] from public.rentals where id = pg_temp.id('r1')), array[250, 25, 30]::numeric[], 'fee columns are filled');
select is((select period_days from public.rentals where id = pg_temp.id('r1')), 120, 'per semester = 120 days');

select throws_ok($$ select public.request_rental('l-fridge') $$, 'P0001', 'You already have an open request for this item.', 'no duplicate open requests');
select throws_ok($$ select public.request_rental('l-desk') $$, 'P0001', 'This listing is for sale, not for rent.', 'sale listings cannot be rented');
select throws_ok($$ select public.request_rental('l-old') $$, 'P0001', null, 'a listing without a valid deposit cannot be rented');
select throws_ok(format($$ select public.pay_rental(%L, 'promptpay') $$, pg_temp.id('r1')), 'P0001', null, 'cannot pay before approval');
select throws_ok(format($$ select public.respond_rental(%L, true) $$, pg_temp.id('r1')), 'P0001', 'Only the owner can respond to this request.', 'the renter cannot approve');
select throws_ok(format($$ select public.confirm_handover(%L) $$, pg_temp.id('r1')), 'P0001', null, 'no handover before payment');

select pg_temp.login(pg_temp.id('owner'));
select throws_ok($$ select public.request_rental('l-fridge') $$, 'P0001', 'You can''t rent your own listing.', 'owners cannot rent their own items');
select is((select count(*)::int from public.notifications where kind = 'rental_requested'), 1, 'the owner is notified of the request');
select is(r.phase, 'approved', 'the owner approves') from public.respond_rental(pg_temp.id('r1'), true) r;
select is((select status from public.listings where id = 'l-fridge'), 'reserved', 'approval reserves the listing');
select throws_ok(format($$ select public.respond_rental(%L, false) $$, pg_temp.id('r1')), 'P0001', null, 'a request is answered once');

select pg_temp.login(pg_temp.id('other'));
select throws_ok($$ select public.request_rental('l-fridge') $$, 'P0001', null, 'a reserved item takes no new requests');
select throws_ok(format($$ select public.pay_rental(%L, 'promptpay') $$, pg_temp.id('r1')), 'P0001', 'Rental not found.', 'a stranger cannot pay someone else''s booking');

select pg_temp.login(pg_temp.id('renter'));
select throws_ok(format($$ select public.pay_rental(%L, 'wallet') $$, pg_temp.id('r1')), 'P0001', null, 'a wallet payment needs enough balance');
select throws_ok(format($$ select public.pay_rental(%L, 'bitcoin') $$, pg_temp.id('r1')), 'P0001', null, 'unknown payment methods are rejected');
select is(r.phase, 'paid', 'the renter pays') from public.pay_rental(pg_temp.id('r1'), 'promptpay') r;
select is((select total_paid from public.rentals where id = pg_temp.id('r1')), 1105::numeric, 'total_paid is ฿1,105');
select is((select status from public.listings where id = 'l-fridge'), 'rented', 'payment marks the listing rented');
select pg_temp.logout();

select is(pg_temp.bal(pg_temp.id('renter'), 'external'), -1105::numeric, 'renter paid ฿1,105 by PromptPay (simulated)');
select is(pg_temp.bal(pg_temp.id('renter'), 'held'), 800::numeric, 'the ฿800 deposit is held for the renter');
select is(pg_temp.bal(pg_temp.id('owner'), 'held'), 250::numeric, 'the ฿250 rental fee is held for the owner');
select is((select sum(amount) from public.wallet_ledger where bucket = 'platform' and rental_id = pg_temp.id('r1')), 55::numeric, 'platform keeps ฿25 + ฿30');

select pg_temp.login(pg_temp.id('owner'));
select is(r.phase, 'active', 'handover makes the rental active') from public.confirm_handover(pg_temp.id('r1')) r;
select is((select due_date - handover_at from public.rentals where id = pg_temp.id('r1')), interval '120 days', 'due date = handover + period');
select is((select payout_at - handover_at from public.rentals where id = pg_temp.id('r1')), interval '48 hours', 'payout = handover + 48 h');
select throws_ok(format($$ select public.confirm_handover(%L) $$, pg_temp.id('r1')), 'P0001', null, 'handover is confirmed once');
select throws_ok(format($$ select public.file_dispute('Damage', '', %L) $$, pg_temp.id('r1')), 'P0001', null, 'no rental dispute before the return');
select pg_temp.logout();

select public.run_escrow_jobs();
select is((select payout_released_at from public.rentals where id = pg_temp.id('r1')), null, 'no payout before 48 h');

-- 49 hours later
update public.rentals set handover_at = handover_at - interval '49 hours', payout_at = payout_at - interval '49 hours',
  due_date = due_date - interval '49 hours' where id = pg_temp.id('r1');
select public.run_escrow_jobs();
select public.run_escrow_jobs();
select is(pg_temp.bal(pg_temp.id('owner'), 'available'), 250::numeric, 'owner gets the rental fee 48 h after handover');
select is(pg_temp.bal(pg_temp.id('owner'), 'held'), 0::numeric, 'nothing is held for the owner after payout');
select is((select count(*)::int from public.wallet_ledger where rental_id = pg_temp.id('r1') and kind = 'payout'), 1, 'the payout job is idempotent');
select is(pg_temp.bal(pg_temp.id('renter'), 'held'), 800::numeric, 'the deposit stays held until the return');

select pg_temp.login(pg_temp.id('renter'));
select is(r.phase, 'return-pending', 'renter marks it returned') from public.mark_returned(pg_temp.id('r1')) r;
select is((select late_fee from public.rentals where id = pg_temp.id('r1')), 0::numeric, 'on time: no late fee');
select is((select dispute_window_ends_at - returned_at from public.rentals where id = pg_temp.id('r1')), interval '48 hours', 'a 48 h window opens at the return');
select throws_ok(format($$ select public.confirm_return(%L) $$, pg_temp.id('r1')), 'P0001', null, 'only the owner confirms the condition');

select pg_temp.login(pg_temp.id('owner'));
select is(r.phase, 'released', 'owner confirms good condition: released early') from public.confirm_return(pg_temp.id('r1')) r;
select throws_ok(format($$ select public.confirm_return(%L) $$, pg_temp.id('r1')), 'P0001', null, 'a released rental cannot be confirmed again');
select pg_temp.logout();
select is((select array[deposit_to_owner, deposit_to_renter] from public.rentals where id = pg_temp.id('r1')), array[0, 800]::numeric[], 'full deposit back to the renter');
select is(pg_temp.bal(pg_temp.id('renter'), 'available'), 800::numeric, 'the refund lands in the renter''s wallet');
select is(pg_temp.bal(pg_temp.id('renter'), 'held'), 0::numeric, 'nothing is held for the renter any more');
select is((select status from public.listings where id = 'l-fridge'), 'available', 'the listing is available again');

-- Wallet payment works with the refunded deposit (lamp: 100 + 10 + 30 + 300 = ฿440)
select pg_temp.login(pg_temp.id('renter'));
select pg_temp.set_id('r3', r.id) from public.request_rental('l-lamp') r;
select pg_temp.login(pg_temp.id('owner'));
select public.respond_rental(pg_temp.id('r3'), true);
select pg_temp.login(pg_temp.id('renter'));
select is(r.payment_method, 'wallet', 'a wallet payment works when the balance covers it') from public.pay_rental(pg_temp.id('r3'), 'wallet') r;
select pg_temp.logout();
select is(pg_temp.bal(pg_temp.id('renter'), 'available'), 360::numeric, '฿800 − ฿440 = ฿360 left in the wallet');

-- ═══ Missing: more than 7 days late → full deposit to the owner
select pg_temp.login(pg_temp.id('renter'));
select public.confirm_handover(pg_temp.id('r3'));
select pg_temp.logout();
update public.rentals set due_date = now() - interval '8 days', handover_at = now() - interval '15 days',
  payout_at = now() - interval '13 days' where id = pg_temp.id('r3');
select public.run_escrow_jobs();
select is(pg_temp.phase(pg_temp.id('r3')), 'missing', 'active → overdue → missing in one job run');
select is((select array[deposit_to_owner, deposit_to_renter] from public.rentals where id = pg_temp.id('r3')), array[300, 0]::numeric[], 'missing: the full ฿300 deposit goes to the owner');
select is((select status from public.listings where id = 'l-lamp'), 'paused', 'a missing item''s listing is paused');
select is((select count(*)::int from public.notifications where kind = 'rental_overdue' and user_id = pg_temp.id('owner')), 1, 'overdue is notified once');

-- ═══ Late return: 3 days late on ฿300 / month → ฿30 from the deposit, auto-release
select pg_temp.login(pg_temp.id('renter'));
select pg_temp.set_id('r2', r.id) from public.request_rental('l-bike') r;
select pg_temp.login(pg_temp.id('owner'));
select public.respond_rental(pg_temp.id('r2'), true);
select pg_temp.login(pg_temp.id('renter'));
select public.pay_rental(pg_temp.id('r2'), 'card');
select public.confirm_handover(pg_temp.id('r2'));
select pg_temp.logout();
update public.rentals set due_date = now() - interval '3 days' where id = pg_temp.id('r2');
select public.run_escrow_jobs();
select public.run_escrow_jobs();
select is(pg_temp.phase(pg_temp.id('r2')), 'overdue', 'past the due date: overdue');
select is((select count(*)::int from public.notifications where kind = 'rental_overdue' and dedupe_key = 'overdue:' || pg_temp.id('r2')), 2, 'both parties are told once');

select pg_temp.login(pg_temp.id('renter'));
select is(r.late_fee, 30::numeric, 'late fee = 3 days × ceil(300 / 30)') from public.mark_returned(pg_temp.id('r2')) r;
select pg_temp.logout();

-- Reminders 24 h and 2 h before the window closes, never twice.
update public.rentals set dispute_window_ends_at = now() + interval '20 hours' where id = pg_temp.id('r2');
select public.run_escrow_jobs();
select public.run_escrow_jobs();
select is((select count(*)::int from public.notifications where dedupe_key like 'reminder24:' || pg_temp.id('r2') || ':%'), 2, '24 h reminder to owner and renter, once');
update public.rentals set dispute_window_ends_at = now() + interval '1 hour' where id = pg_temp.id('r2');
select public.run_escrow_jobs();
select public.run_escrow_jobs();
select is((select count(*)::int from public.notifications where dedupe_key like 'reminder2:' || pg_temp.id('r2') || ':%'), 2, '2 h reminder to owner and renter, once');

update public.rentals set dispute_window_ends_at = now() - interval '1 minute' where id = pg_temp.id('r2');
select public.run_escrow_jobs();
select is(pg_temp.phase(pg_temp.id('r2')), 'released', 'the window closed with no dispute: auto-released');
select is((select array[deposit_to_owner, deposit_to_renter] from public.rentals where id = pg_temp.id('r2')), array[30, 770]::numeric[], '฿30 late fee to the owner, ฿770 back');

-- ═══ Decline, cancel, and auto-decline of competing requests
select pg_temp.login(pg_temp.id('renter'));
select pg_temp.set_id('m1', r.id) from public.request_rental('l-mat') r;
select pg_temp.login(pg_temp.id('other'));
select pg_temp.set_id('m2', r.id) from public.request_rental('l-mat') r;
select pg_temp.login(pg_temp.id('owner'));
select is(r.phase, 'declined', 'the owner can decline') from public.respond_rental(pg_temp.id('m2'), false, 'Already promised') r;
select pg_temp.login(pg_temp.id('other'));
select pg_temp.set_id('m3', r.id) from public.request_rental('l-mat') r;
select pg_temp.login(pg_temp.id('owner'));
select public.respond_rental(pg_temp.id('m1'), true);
select throws_ok(format($$ select public.respond_rental(%L, true) $$, pg_temp.id('m3')), 'P0001', 'Another booking for this item is already in progress.', 'only one approved booking per item');
select pg_temp.login(pg_temp.id('renter'));
select is(r.phase, 'cancelled', 'the renter can cancel before paying') from public.cancel_rental(pg_temp.id('m1')) r;
select is((select status from public.listings where id = 'l-mat'), 'available', 'cancelling an approved booking frees the listing');
select pg_temp.set_id('m4', r.id) from public.request_rental('l-mat') r;
select pg_temp.login(pg_temp.id('owner'));
select public.respond_rental(pg_temp.id('m3'), true);
select pg_temp.login(pg_temp.id('other'));
select public.pay_rental(pg_temp.id('m3'), 'promptpay');
select throws_ok(format($$ select public.cancel_rental(%L) $$, pg_temp.id('m3')), 'P0001', null, 'a paid booking cannot be cancelled');
select pg_temp.logout();
select is(pg_temp.phase(pg_temp.id('m4')), 'declined', 'paying declines the other waiting requests');

select * from finish();
rollback;
