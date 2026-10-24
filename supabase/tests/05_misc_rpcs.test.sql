-- Chat, reviews, wallet withdrawal, notifications and the admin time-travel
-- demo helper.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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
select pg_temp.set_id('admin', pg_temp.new_user('admin@ait.asia', 'Ada Admin'));
update public.users set is_admin = true where id = pg_temp.id('admin');
insert into public.listings (id, seller_id, title, description, category, type, price, deposit, rental_period, condition, pickup_location)
values ('l-fridge', pg_temp.id('a'), 'Fridge', 'Cold', 'electronics', 'rent', 250, 800, 'per semester', 'good', 'Dorm A Lobby');

-- Chat: one thread per listing per pair, reused.
select pg_temp.login(pg_temp.id('b'));
select pg_temp.set_id('th', public.start_thread('l-fridge', pg_temp.id('a'), 'Hi!') ->> 'thread_id');
select is(public.start_thread('l-fridge', pg_temp.id('a'), 'Still there?') ->> 'thread_id', pg_temp.id('th'), 'the same pair reuses the thread');
select is((select count(*)::int from public.messages), 2, 'both messages are stored');
select throws_ok(format($$ select public.start_thread('l-fridge', %L, 'me') $$, pg_temp.id('b')), 'P0001', null, 'cannot message yourself');
select pg_temp.login(pg_temp.id('a'));
select is((select count(*)::int from public.notifications where kind = 'message' and read_at is null), 1, 'new messages collapse into one unread notification');
select public.mark_thread_read(pg_temp.id('th'));
select is((select count(*)::int from public.notifications where kind = 'message' and read_at is null), 0, 'reading the thread clears it');
select isnt((select last_read_at from public.thread_participants where thread_id = pg_temp.id('th') and user_id = pg_temp.id('a')), null, 'last_read_at is recorded');

-- A full rental, then reviews.
select pg_temp.login(pg_temp.id('b'));
select pg_temp.set_id('r', r.id) from public.request_rental('l-fridge') r;
select pg_temp.login(pg_temp.id('a'));
select public.respond_rental(pg_temp.id('r'), true);
select pg_temp.login(pg_temp.id('b'));
select public.pay_rental(pg_temp.id('r'), 'promptpay');
select public.confirm_handover(pg_temp.id('r'));

-- Admin time travel moves the deal 49 h back, so the payout is due.
select throws_ok(format($$ select public.admin_time_travel(%L, 49) $$, pg_temp.id('r')), 'P0001', null, 'only admins time-travel');
select pg_temp.login(pg_temp.id('admin'));
select is(public.admin_time_travel(pg_temp.id('r'), 49), 'rental', 'admin moves the rental back 49 hours');
select public.run_escrow_jobs();
select pg_temp.login(pg_temp.id('a'));
select is((select available from public.get_wallet_summary()), 250::numeric, 'owner payout arrived after the time travel');
select is((select held from public.get_wallet_summary()), 0::numeric, 'nothing held for the owner');
select is((select w.amount from public.wallet_withdraw(100) w), -100::numeric, 'withdrawal is recorded');
select is((select available from public.get_wallet_summary()), 150::numeric, '฿150 left');
select throws_ok($$ select public.wallet_withdraw(1000) $$, 'P0001', null, 'cannot withdraw more than the balance');
select public.confirm_return(pg_temp.id('r'));

select pg_temp.login(pg_temp.id('b'));
select is((select deposits_held from public.get_wallet_summary()), 0::numeric, 'renter has no deposit held after release');
select is(rv.role, 'renter', 'the renter reviews the owner') from public.submit_review(4, 'Cold and quiet', pg_temp.id('r')) rv;
select throws_ok(format($$ select public.submit_review(5, 'again', %L) $$, pg_temp.id('r')), 'P0001', 'You already reviewed this deal.', 'one review per deal');
select pg_temp.login(pg_temp.id('a'));
select public.submit_review(2, null, pg_temp.id('r'));
select pg_temp.logout();
select is((select array[rating, reviews_count::numeric] from public.users where id = pg_temp.id('a')), array[4, 1]::numeric[], 'the owner''s rating is updated');
select is((select role from public.reviews where author_id = pg_temp.id('a')), 'owner', 'the owner reviews the renter');

select pg_temp.login(pg_temp.id('b'));
select ok(public.mark_notifications_read() > 0, 'mark_notifications_read marks all');
select is((select count(*)::int from public.notifications where read_at is null), 0, 'none left unread');
select pg_temp.logout();

select * from finish();
rollback;
