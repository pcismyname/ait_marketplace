-- Sale commission (BusinessRules §2, 2026-10-26): 10% of what the seller keeps
-- on protected sales; none on in-person sales or on purchases quoted before
-- the rule. Migration 20261026000000_sale_commission.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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
-- ───────────────────────────────────────────────────────────────────────────

select pg_temp.set_id('seller', pg_temp.new_user('seller@ait.asia', 'Sam Seller'));
select pg_temp.set_id('buyer', pg_temp.new_user('buyer@ait.asia', 'Bo Buyer'));
select pg_temp.set_id('admin', pg_temp.new_user('admin@ait.asia', 'Ada Admin'));
update public.users set is_admin = true where id = pg_temp.id('admin');

insert into public.listings (id, seller_id, title, description, category, type, price, deposit, rental_period, condition, pickup_location)
values
  ('sc-lamp',  pg_temp.id('seller'), 'Lamp', 'Bright', 'furniture', 'sale', 400, null, null, 'good', 'Dorm A Lobby'),
  ('sc-desk',  pg_temp.id('seller'), 'Desk', 'Wood', 'furniture', 'sale', 1000, null, null, 'good', 'Dorm A Lobby'),
  ('sc-table', pg_temp.id('seller'), 'Table', 'Round', 'furniture', 'sale', 800, null, null, 'good', 'Dorm A Lobby'),
  ('sc-old',   pg_temp.id('seller'), 'Shelf', 'Tall', 'furniture', 'sale', 300, null, null, 'good', 'Dorm A Lobby'),
  ('sc-pen',   pg_temp.id('seller'), 'Pen', 'Blue', 'other', 'sale', 50, null, null, 'good', 'Dorm A Lobby');

-- ═══ Buyer confirms receipt: the worked example (฿400 lamp)
select pg_temp.login(pg_temp.id('buyer'));
select pg_temp.set_id('t-lamp', t.id) from public.create_sale('sc-lamp', 'protected', 'promptpay') t;
select public.confirm_sale_receipt(pg_temp.id('t-lamp'));
select pg_temp.logout();
select is((select total from public.transactions where id = pg_temp.id('t-lamp')), 422::numeric, 'the buyer pays ฿422');
select is(pg_temp.bal(pg_temp.id('seller'), 'available'), 360::numeric, 'the seller receives ฿360');
select is((select sum(amount) from public.wallet_ledger where bucket = 'platform' and transaction_id = pg_temp.id('t-lamp')), 62::numeric, 'the platform keeps ฿22 + ฿40');
select is((select count(*)::int from public.wallet_ledger where kind = 'platform_fee' and memo = 'Sale commission' and transaction_id = pg_temp.id('t-lamp')), 1, 'the commission is its own ledger row');

-- ═══ Claim rejected: seller paid the price minus commission
select pg_temp.login(pg_temp.id('buyer'));
select pg_temp.set_id('t-desk', t.id) from public.create_sale('sc-desk', 'protected', 'card') t;
select public.confirm_sale_handover(pg_temp.id('t-desk'));
select pg_temp.set_id('d-desk', d.id) from public.file_dispute('Wobbly', '', null, pg_temp.id('t-desk')) d;
select pg_temp.login(pg_temp.id('admin'));
select is(d.seller_amount, 900::numeric, 'resolve_dispute returns the net seller amount') from public.resolve_dispute(pg_temp.id('d-desk'), 'normal-wear') d;
select pg_temp.logout();
select is((select array[seller_amount, seller_commission, refund_to_buyer] from public.transactions where id = pg_temp.id('t-desk')),
  array[900, 100, 0]::numeric[], 'claim rejected: ฿900 to the seller, ฿100 commission');
select is((select seller_amount from public.disputes where id = pg_temp.id('d-desk')), 900::numeric, 'the dispute shows the net payout');

-- ═══ Full refund: no commission
select pg_temp.login(pg_temp.id('buyer'));
select pg_temp.set_id('t-table', t.id) from public.create_sale('sc-table', 'protected', 'promptpay') t;
select public.confirm_sale_handover(pg_temp.id('t-table'));
select pg_temp.set_id('d-table', d.id) from public.file_dispute('Broken leg', '', null, pg_temp.id('t-table')) d;
select pg_temp.login(pg_temp.id('admin'));
select public.resolve_dispute(pg_temp.id('d-table'), 'not-as-described', 800);
select pg_temp.logout();
select is((select array[seller_amount, seller_commission, refund_to_buyer] from public.transactions where id = pg_temp.id('t-table')),
  array[0, 0, 800]::numeric[], 'full refund: no payout and no commission');
select is((select count(*)::int from public.wallet_ledger where memo = 'Sale commission' and transaction_id = pg_temp.id('t-table')), 0, 'no commission row');

-- ═══ Purchase quoted before the rule (stored commission 0) stays commission-free
select pg_temp.login(pg_temp.id('buyer'));
select pg_temp.set_id('t-old', t.id) from public.create_sale('sc-old', 'protected', 'promptpay') t;
select pg_temp.logout();
update public.transactions set seller_commission = 0 where id = pg_temp.id('t-old');
select pg_temp.login(pg_temp.id('buyer'));
select public.confirm_sale_receipt(pg_temp.id('t-old'));
select pg_temp.logout();
select is((select array[seller_amount, seller_commission] from public.transactions where id = pg_temp.id('t-old')),
  array[300, 0]::numeric[], 'a legacy purchase pays the seller the full price');

-- ═══ In person: free for both sides
select pg_temp.login(pg_temp.id('buyer'));
select pg_temp.set_id('t-pen', t.id) from public.create_sale('sc-pen', 'in-person') t;
select pg_temp.login(pg_temp.id('seller'));
select public.mark_sold('sc-pen', pg_temp.id('buyer'));
select pg_temp.logout();
select is((select array[seller_amount, seller_commission] from public.transactions where id = pg_temp.id('t-pen')),
  array[50, 0]::numeric[], 'in person: seller keeps the full price');
select throws_ok(format($$ update public.transactions set seller_commission = 5 where id = %L $$, pg_temp.id('t-pen')),
  '23514', null, 'an in-person sale cannot carry a commission');
select throws_ok(format($$ update public.transactions set seller_commission = -1 where id = %L $$, pg_temp.id('t-lamp')),
  '23514', null, 'a commission cannot be negative');

-- ═══ Clients cannot change the commission
select ok(not has_table_privilege('authenticated', 'public.transactions', 'UPDATE'), 'signed-in users cannot update purchases directly');

select * from finish();
rollback;
