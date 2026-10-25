-- Row Level Security and privileges: a second account can't read or change
-- other people's rentals, purchases, money, notifications or chats; nobody
-- writes money / state columns directly; storage evidence paths are scoped.
-- Data-independent: every count is scoped to rows this file creates, or is
-- taken as a fresh user who owns nothing else, so it passes with demo data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

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

select pg_temp.set_id('a', pg_temp.new_user('owner@ait.asia', 'Ann Owner'));
select pg_temp.set_id('b', pg_temp.new_user('renter@ait.asia', 'Ben Renter'));
select pg_temp.set_id('c', pg_temp.new_user('stranger@ait.asia', 'Cat Stranger'));
select pg_temp.set_id('admin', pg_temp.new_user('admin@ait.asia', 'Ada Admin'));
update public.users set is_admin = true where id = pg_temp.id('admin');

insert into public.listings (id, seller_id, title, description, category, type, price, deposit, rental_period, condition, pickup_location)
values
  ('l-fridge', pg_temp.id('a'), 'Fridge', 'Cold', 'electronics', 'rent', 250, 800, 'per semester', 'good', 'Dorm A Lobby'),
  ('l-desk',   pg_temp.id('a'), 'Desk', 'Wood', 'furniture', 'sale', 1000, null, null, 'good', 'Dorm A Lobby');

-- B rents A's fridge and buys A's desk with protection; B messages A.
select pg_temp.login(pg_temp.id('b'));
select pg_temp.set_id('r', r.id) from public.request_rental('l-fridge') r;
select pg_temp.set_id('t', t.id) from public.create_sale('l-desk', 'protected', 'promptpay') t;
select pg_temp.set_id('thread', (public.start_thread('l-desk', pg_temp.id('a'), 'Is it still available?') ->> 'thread_id'));
select pg_temp.login(pg_temp.id('a'));
select public.respond_rental(pg_temp.id('r'), true);
select pg_temp.login(pg_temp.id('b'));
select public.pay_rental(pg_temp.id('r'), 'promptpay');

-- ═══ The stranger sees nothing private
select pg_temp.login(pg_temp.id('c'));
select is((select count(*)::int from public.rentals), 0, 'stranger: no rentals');
select is((select count(*)::int from public.transactions), 0, 'stranger: no purchases');
select is((select count(*)::int from public.wallet_ledger), 0, 'stranger: no ledger rows');
select is((select count(*)::int from public.notifications), 0, 'stranger: no notifications');
select is((select count(*)::int from public.threads), 0, 'stranger: no threads');
select is((select count(*)::int from public.thread_participants), 0, 'stranger: no participants');
select is((select count(*)::int from public.messages), 0, 'stranger: no messages');
select is((select count(*)::int from public.listings where id in ('l-fridge', 'l-desk')), 2, 'stranger: listings are public');
select throws_ok(format($$ update public.rentals set phase = 'released' where id = %L $$, pg_temp.id('r')), '42501', null, 'stranger cannot update a rental');
select throws_ok(format($$ delete from public.transactions where id = %L $$, pg_temp.id('t')), '42501', null, 'stranger cannot delete a purchase');
select throws_ok(format($$ insert into public.thread_participants (thread_id, user_id) values (%L, %L) $$, pg_temp.id('thread'), pg_temp.id('c')),
  '42501', null, 'stranger cannot join a thread');
select throws_ok(format($$ insert into public.messages (thread_id, sender_id, text) values (%L, %L, 'hi') $$, pg_temp.id('thread'), pg_temp.id('c')),
  '42501', null, 'stranger cannot post into a thread');
select throws_ok($$ insert into public.listing_history (listing_id, owner_name, action, date) values ('l-desk', 'Cat', 'Stole it', 'now') $$,
  '42501', null, 'stranger cannot write another seller''s item history');
select is(public.can_read_evidence('rental/' || pg_temp.id('r') || '/' || pg_temp.id('b') || '/x.jpg'), false, 'stranger cannot read evidence');
update public.listings set title = 'Mine now' where id = 'l-desk';
select is((select title from public.listings where id = 'l-desk'), 'Desk', 'stranger cannot edit someone else''s listing');

-- ═══ The parties see their own records, but can't write state directly
select pg_temp.login(pg_temp.id('b'));
select is((select count(*)::int from public.rentals), 1, 'renter sees the rental');
select is((select count(*)::int from public.transactions), 1, 'buyer sees the purchase');
select is((select count(*)::int from public.messages), 1, 'participant sees the message');
select ok((select count(*) from public.wallet_ledger) > 0, 'renter sees their ledger');
select is((select count(*)::int from public.wallet_ledger where user_id <> pg_temp.id('b') or user_id is null), 0, 'only their own ledger rows');
select throws_ok(format($$ update public.rentals set deposit_to_renter = 99999 where id = %L $$, pg_temp.id('r')), '42501', null, 'renter cannot edit money columns');
select throws_ok(format($$ update public.transactions set status = 'released' where id = %L $$, pg_temp.id('t')), '42501', null, 'buyer cannot release escrow directly');
select throws_ok($$ insert into public.wallet_ledger (user_id, kind, bucket, amount) values (auth.uid()::text, 'refund', 'available', 1000000) $$,
  '42501', null, 'nobody can mint wallet money');
select throws_ok($$ insert into public.notifications (user_id, kind, title) values (auth.uid()::text, 'x', 'y') $$, '42501', null, 'notifications are written by the server');
select throws_ok($$ update public.notifications set title = 'changed' $$, '42501', null, 'only read_at is client-writable');
select lives_ok($$ update public.notifications set read_at = now() $$, 'users can mark their notifications read');
select throws_ok($$ insert into public.reviews (listing_id, author_id, author_name, role, rating, date) values ('l-desk', auth.uid()::text, 'Ben', 'buyer', 5, 'now') $$,
  '42501', null, 'reviews go through submit_review');
select throws_ok(format($$ select public.submit_review(5, 'Great', %L) $$, pg_temp.id('r')), 'P0001', null, 'no review before the rental is closed');
select is(public.can_write_evidence('rental/' || pg_temp.id('r') || '/' || pg_temp.id('b') || '/x.jpg'), true, 'renter uploads into their own evidence folder');
select is(public.can_write_evidence('rental/' || pg_temp.id('r') || '/' || pg_temp.id('a') || '/x.jpg'), false, 'not into the owner''s folder');
select is(public.can_read_evidence('rental/' || pg_temp.id('r') || '/' || pg_temp.id('a') || '/x.jpg'), true, 'but can read the owner''s photos');
select is(public.can_read_evidence('sale/' || pg_temp.id('t') || '/' || pg_temp.id('a') || '/x.jpg'), true, 'buyer reads sale evidence');

select pg_temp.login(pg_temp.id('a'));
select is((select count(*)::int from public.rentals), 1, 'owner sees the rental');
select is((select count(*)::int from public.notifications where kind = 'message'), 1, 'owner got a message notification');
select throws_ok($$ update public.listings set status = 'available' where id = 'l-fridge' $$, 'P0001', null, 'status of a listing with a deal in progress is locked');
select throws_ok($$ delete from public.listings where id = 'l-fridge' $$, 'P0001', null, 'a listing with money history cannot be deleted');
select throws_ok(format($$ update public.listings set seller_id = %L where id = 'l-desk' $$, pg_temp.id('c')), 'P0001', null, 'the seller of a listing cannot change');
select throws_ok($$ insert into public.listings (id, seller_id, title, description, category, type, price, deposit, condition, pickup_location)
  values ('l-x', auth.uid()::text, 'X', 'X', 'other', 'rent', 100, 0, 'good', 'Lobby') $$, 'P0001', null, 'a rental listing needs a deposit of at least ฿200');

-- ═══ Admins see everything (for disputes), anon sees only public data
select pg_temp.login(pg_temp.id('admin'));
select is((select count(*)::int from public.rentals where id = pg_temp.id('r')), 1, 'admin sees other people''s rentals');
select is((select count(*)::int from public.messages where thread_id = pg_temp.id('thread')), 1, 'admin can read chat history for disputes');
select is((select count(*)::int from public.wallet_ledger where user_id is null
  and (rental_id = pg_temp.id('r') or transaction_id = pg_temp.id('t'))), 3, 'admin sees platform revenue rows');
select pg_temp.logout();

select set_config('role', 'anon', true);
select is((select count(*)::int from public.rentals), 0, 'anon: no rentals');
select is((select count(*)::int from public.listings where id in ('l-fridge', 'l-desk')), 2, 'anon: listings are public');
select throws_ok($$ insert into public.listings (id, seller_id, title, description, category, type, price, condition, pickup_location)
  values ('l-y', 'x', 'X', 'X', 'other', 'sale', 100, 'good', 'Lobby') $$, '42501', null, 'anon cannot write');
select throws_ok($$ select public.run_escrow_jobs() $$, '42501', null, 'anon cannot run the escrow jobs');
select pg_temp.logout();

select * from finish();
rollback;
