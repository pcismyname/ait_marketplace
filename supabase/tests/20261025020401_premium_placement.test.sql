-- Premium placement as a simulated ฿49 charge, the sale ↔ rent lock while
-- requests wait, and the notifications when a listing is deleted
-- (20261025020401_premium_placement.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

create function pg_temp.new_user(p_email text) returns text
language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
          jsonb_build_object('name', split_part(p_email, '@', 1)), now(), now());
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
create function pg_temp.id(p_k text) returns text
language sql stable as $$ select v from ids where k = p_k $$;
create function pg_temp.bal(p_user text, p_bucket text) returns numeric
language sql stable as $$ select coalesce(sum(amount), 0) from public.wallet_ledger where user_id = p_user and bucket = p_bucket $$;

insert into ids values
  ('s', pg_temp.new_user('premium.seller@ait.asia')),
  ('o', pg_temp.new_user('premium.other@ait.asia'));

-- A client insert can't start featured.
select pg_temp.login(pg_temp.id('s'));
insert into public.listings (id, seller_id, title, description, category, type, price, condition, pickup_location,
                             featured, featured_until)
values ('p-desk', pg_temp.id('s'), 'Premium desk', 'x', 'furniture', 'sale', 1500, 'good', 'AIT Library',
        true, null);
select pg_temp.logout();
select is((select featured from public.listings where id = 'p-desk'), false, 'client insert starts unfeatured');
select is((select featured_until from public.listings where id = 'p-desk'), null, 'client insert has no featured_until');

-- Only the lister can buy it, and only for an active listing.
select pg_temp.login(pg_temp.id('o'));
select throws_like($$ select public.enable_premium_placement('p-desk', 'promptpay') $$,
  'Only the lister%', 'someone else can''t promote the listing');
select pg_temp.login(pg_temp.id('s'));
select throws_like($$ select public.enable_premium_placement('p-desk', 'wallet') $$,
  'Your wallet has%', 'wallet payment needs enough balance');
select throws_like($$ select public.enable_premium_placement('p-desk', 'bitcoin') $$,
  'Choose a payment method%', 'unknown payment method refused');

-- Pay ฿49 by PromptPay: 7 days, ledger payment + platform fee.
select lives_ok($$ select public.enable_premium_placement('p-desk', 'promptpay') $$, 'lister buys premium placement');
select pg_temp.logout();
select is((select public.is_featured(l) from public.listings l where id = 'p-desk'), true, 'listing is featured');
select ok((select featured_until between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days' + interval '1 minute'
           from public.listings where id = 'p-desk'), 'featured for 7 days');
select is(pg_temp.bal(pg_temp.id('s'), 'external'), -49::numeric, 'lister paid ฿49 (simulated, external)');
select is((select sum(amount) from public.wallet_ledger where bucket = 'platform' and memo like 'Premium placement: Premium desk%'),
  49::numeric, 'platform revenue +฿49');
select is((select count(*)::int from public.notifications where user_id = pg_temp.id('s') and kind = 'premium_placement'), 1,
  'lister gets a receipt notification');

-- No double charge while active; the client can't extend it by hand.
select pg_temp.login(pg_temp.id('s'));
select throws_like($$ select public.enable_premium_placement('p-desk', 'promptpay') $$,
  'Premium placement is already active%', 'no second charge while active');
select throws_like($$ update public.listings set featured_until = now() + interval '1 year' where id = 'p-desk' $$,
  'Premium placement is turned on%', 'client can''t extend featured_until');
select lives_ok($$ update public.listings set title = 'Premium desk (oak)' where id = 'p-desk' $$,
  'other edits still work');

-- Ending early: no refund. Paused listings can't be promoted.
select lives_ok($$ select public.end_premium_placement('p-desk') $$, 'lister ends placement early');
select pg_temp.logout();
select is((select public.is_featured(l) from public.listings l where id = 'p-desk'), false, 'no longer featured');
select is(pg_temp.bal(pg_temp.id('s'), 'external'), -49::numeric, 'no refund when ended early');
select pg_temp.login(pg_temp.id('s'));
update public.listings set status = 'paused' where id = 'p-desk';
select throws_like($$ select public.enable_premium_placement('p-desk', 'promptpay') $$,
  'Only an active listing%', 'paused listing can''t be promoted');
update public.listings set status = 'available' where id = 'p-desk';

-- Sale ↔ rent is locked while an in-person purchase intent waits.
select pg_temp.login(pg_temp.id('o'));
select public.create_sale('p-desk', 'in-person');
select pg_temp.login(pg_temp.id('s'));
select throws_like($$ update public.listings set type = 'rent', deposit = 500 where id = 'p-desk' $$,
  '%can''t switch between sale and rent%', 'type locked while a purchase intent waits');

-- ...and while a rental request waits.
insert into public.listings (id, seller_id, title, description, category, type, price, deposit, condition, pickup_location)
values ('p-fridge', pg_temp.id('s'), 'Fridge', 'x', 'appliances', 'rent', 250, 800, 'good', 'AIT Library');
select pg_temp.login(pg_temp.id('o'));
select public.request_rental('p-fridge');
select public.start_thread('p-fridge', pg_temp.id('s'), 'Is it still available?');
select pg_temp.login(pg_temp.id('s'));
select throws_like($$ update public.listings set type = 'sale' where id = 'p-fridge' $$,
  '%can''t switch between sale and rent%', 'type locked while a rental request waits');

-- Deleting the listing notifies the requester (once, even with a chat too).
delete from public.listings where id = 'p-fridge';
select pg_temp.logout();
select is((select count(*)::int from public.listings where id = 'p-fridge'), 0, 'listing deleted');
select is((select count(*)::int from public.notifications where user_id = pg_temp.id('o') and kind = 'listing_removed'), 1,
  'requester told the listing was removed');
select is((select count(*)::int from public.notifications where user_id = pg_temp.id('s') and kind = 'listing_removed'), 0,
  'the lister isn''t notified about their own delete');

-- A listing with no pending requests switches type freely.
select pg_temp.login(pg_temp.id('s'));
insert into public.listings (id, seller_id, title, description, category, type, price, condition, pickup_location)
values ('p-lamp', pg_temp.id('s'), 'Lamp', 'x', 'other', 'sale', 100, 'good', 'AIT Library');
select lives_ok($$ update public.listings set type = 'rent', deposit = 300 where id = 'p-lamp' $$,
  'type change without requests is allowed');
select throws_like($$ update public.listings set price = 150.75 where id = 'p-lamp' $$,
  'The price must be a whole number%', 'fractional price refused');
select throws_like($$ update public.listings set deposit = 400.5 where id = 'p-lamp' $$,
  'The deposit must be a whole number%', 'fractional deposit refused');
select pg_temp.logout();

select * from finish();
rollback;
