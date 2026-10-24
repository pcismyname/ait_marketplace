-- Featured-first browse ordering (20261025020400_listing_featured_rank.sql):
-- public.is_featured(listings); the seller writes replacement_value from the
-- client, and premium placement only through the RPCs.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create function pg_temp.new_user(p_email text) returns text
language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
          jsonb_build_object('name', split_part(p_email, '@', 1)), now(), now());
  return v::text;
end $$;
create temp table ids (k text primary key, v text);
grant all on ids to public;
insert into ids values ('s', pg_temp.new_user('featured.seller@ait.asia'));

insert into public.listings (id, seller_id, title, description, category, type, price, condition, pickup_location,
                             featured, featured_until, created_at)
select v.id, (select v from ids where k = 's'), v.title, 'x', 'other', 'sale', v.price, 'good', 'AIT Library',
       v.featured, v.until, now() - v.age
from (values
  ('f-legacy',  'Legacy featured', 100, true,  null::timestamptz,            interval '3 days'),
  ('f-active',  'Active featured', 200, true,  now() + interval '2 days',    interval '2 days'),
  ('f-expired', 'Expired',         300, true,  now() - interval '1 hour',    interval '1 day'),
  ('f-plain',   'Plain',           400, false, null::timestamptz,            interval '0 days')
) as v(id, title, price, featured, until, age);

select is((select public.is_featured(l) from public.listings l where id = 'f-legacy'), true,
  'featured with no end date counts as featured');
select is((select public.is_featured(l) from public.listings l where id = 'f-active'), true,
  'featured until a future date counts as featured');
select is((select public.is_featured(l) from public.listings l where id = 'f-expired'), false,
  'featured_until in the past: no longer featured');
select is((select public.is_featured(l) from public.listings l where id = 'f-plain'), false,
  'not featured');

select results_eq(
  $$ select id from public.listings l where id like 'f-%' order by public.is_featured(l) desc, created_at desc $$,
  $$ values ('f-active'), ('f-legacy'), ('f-plain'), ('f-expired') $$,
  'featured first, then newest; expired placement sorts with the rest');

-- Logged out (anon) can call it: browse works without an account.
set local role anon;
select is((select count(*)::int from public.listings l where id like 'f-%' and public.is_featured(l)), 2,
  'anon can use is_featured');
reset role;

-- The seller saves the replacement value from the client, but can't write
-- premium placement directly any more (20261025020401_premium_placement.sql).
select set_config('request.jwt.claims', json_build_object('sub', (select v from ids where k = 's'), 'role', 'authenticated')::text, true);
set local role authenticated;
update public.listings set replacement_value = 2500 where id = 'f-plain';
select throws_like(
  $$ update public.listings set featured = true, featured_until = now() + interval '7 days' where id = 'f-plain' $$,
  'Premium placement is turned on%',
  'a client can''t set featured / featured_until directly');
reset role;
select is((select replacement_value from public.listings where id = 'f-plain'), 2500::numeric,
  'seller saved the replacement value');

set local role authenticated;
select lives_ok($$ select public.end_premium_placement('f-active') $$, 'seller ends premium placement early');
reset role;
select is((select public.is_featured(l) from public.listings l where id = 'f-active'), false,
  'seller turned premium placement off');

select * from finish();
rollback;
