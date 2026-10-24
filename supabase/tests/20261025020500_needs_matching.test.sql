-- Pre-arrival matching and match notifications
-- (20261025020500_needs_matching.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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

select pg_temp.set_id('in', pg_temp.new_user('incoming@ait.asia', 'Ivy Incoming'));
select pg_temp.set_id('out', pg_temp.new_user('outgoing@ait.asia', 'Oscar Outgoing'));

-- The local database may hold demo data, so every check is scoped to this
-- file's users and 'l-*' listings.

-- Needs written by the incoming student through the normal table API.
select pg_temp.login(pg_temp.id('in'));
insert into public.needs (id, user_id, title, category, note, arrival_date, needed_by, listing_type) values
  ('n-desk', pg_temp.id('in'), 'Desk', 'furniture', '', 'soon', current_date + 60, 'any'),
  ('n-fridge', pg_temp.id('in'), 'Fridge to rent', 'electronics', '', 'soon', current_date + 60, 'rent'),
  ('n-old', pg_temp.id('in'), 'Old desk need', 'furniture', '', 'long ago', current_date - 31, 'any');
insert into public.needs (id, user_id, title, category, arrival_date) values
  ('n-text', pg_temp.id('in'), 'Bike', 'bicycles', 'August 2027');
select is((select needed_by from public.needs where id = 'n-text'), '2027-08-01'::date, 'a free-text month becomes needed_by');
select throws_ok($$ insert into public.needs (id, user_id, title, category, arrival_date, listing_type)
                    values ('n-bad', (select auth.uid())::text, 'x', 'other', 'x', 'swap') $$,
                 '23514', null, 'listing_type must be any, sale or rent');

-- The outgoing student lists items.
select pg_temp.login(pg_temp.id('out'));
insert into public.listings (id, seller_id, title, description, category, type, price, deposit, rental_period, condition, pickup_location)
values ('l-desk', pg_temp.id('out'), 'Oak desk', 'Solid', 'furniture', 'sale', 900, null, null, 'good', 'Dorm B'),
       ('l-fridge-sale', pg_temp.id('out'), 'Fridge to buy', 'Cold', 'electronics', 'sale', 1500, null, null, 'good', 'Dorm B'),
       ('l-fridge-rent', pg_temp.id('out'), 'Fridge to rent', 'Cold', 'electronics', 'rent', 250, 800, 'per semester', 'good', 'Dorm B'),
       ('l-bike', pg_temp.id('out'), 'Bike', 'Fast', 'bicycles', 'sale', 1500, null, null, 'good', 'Dorm C');
-- The incoming student's own listing never matches their need.
select pg_temp.login(pg_temp.id('in'));
insert into public.listings (id, seller_id, title, description, category, type, price, condition, pickup_location)
values ('l-own-desk', pg_temp.id('in'), 'My desk', 'Mine', 'furniture', 'sale', 100, 'good', 'Dorm A');

select is((select array_agg(listing_id order by listing_id) from public.match_needs() where listing_id like 'l-%' and need_id = 'n-desk'),
          array['l-desk'], 'same category, not my own listing');
select is((select array_agg(listing_id) from public.match_needs() where listing_id like 'l-%' and need_id = 'n-fridge'),
          array['l-fridge-rent'], 'a rent-only need matches rentals only');
select is((select count(*)::int from public.match_needs() where listing_id like 'l-%' and need_id = 'n-old'), 0,
          'a need more than 30 days past its date is closed');
select is((select count(*)::int from public.match_needs() where listing_id like 'l-%' and need_id = 'n-text'), 1, 'far-future needs still match');

-- Notifications: one per open need and listing, none for closed needs.
select is((select count(*)::int from public.notifications where user_id = pg_temp.id('in') and kind = 'need_match'), 3,
          'desk, rental fridge and bike each notify once');
select is((select count(*)::int from public.notifications where user_id = pg_temp.id('in') and kind = 'need_match' and link = '/listing/l-fridge-sale'), 0,
          'a sale does not notify a rent-only need');
select ok((select bool_and(body like '%Matches your need%') from public.notifications where user_id = pg_temp.id('in') and kind = 'need_match'),
          'the body names the need');

-- Unavailable listings drop out; coming back doesn't notify twice.
select pg_temp.login(pg_temp.id('out'));
update public.listings set status = 'paused' where id = 'l-desk';
select pg_temp.login(pg_temp.id('in'));
select is((select count(*)::int from public.match_needs() where listing_id like 'l-%' and need_id = 'n-desk'), 0, 'paused listings do not match');
select pg_temp.login(pg_temp.id('out'));
update public.listings set status = 'available' where id = 'l-desk';
select pg_temp.login(pg_temp.id('in'));
select is((select count(*)::int from public.match_needs() where listing_id like 'l-%' and need_id = 'n-desk'), 1, 'back on sale, it matches again');
select is((select count(*)::int from public.notifications where user_id = pg_temp.id('in') and kind = 'need_match' and link = '/listing/l-desk'), 1,
          'the same listing never notifies the same need twice');

-- Featured listings come first.
select pg_temp.login(pg_temp.id('out'));
insert into public.listings (id, seller_id, title, description, category, type, price, condition, pickup_location, featured, featured_until)
values ('l-desk-2', pg_temp.id('out'), 'Standing desk', 'Tall', 'furniture', 'sale', 2000, 'good', 'Dorm B', true, now() + interval '7 days');
-- Clients can't write premium placement (enable_premium_placement charges it,
-- 20261025020401_premium_placement.sql): set it as the table owner here.
select pg_temp.logout();
update public.listings set featured = true, featured_until = now() + interval '7 days' where id = 'l-desk-2';
select pg_temp.login(pg_temp.id('in'));
select is((select listing_id from public.match_needs() where listing_id like 'l-%' and need_id = 'n-desk' limit 1), 'l-desk-2', 'featured first');

-- One need by id (any signed-in user); logged-out callers are refused.
select pg_temp.login(pg_temp.id('out'));
select is((select count(*)::int from public.match_needs('n-desk') where listing_id like 'l-%'), 2, 'match one need by id');
select is((select count(*)::int from public.match_needs() where listing_id like 'l-%'), 0, 'no needs of my own, no matches');
select pg_temp.logout();
set local role anon;
select throws_ok($$ select * from public.match_needs() $$, '42501', null, 'anon cannot call match_needs');

select * from finish();
rollback;
