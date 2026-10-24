-- @ait.asia enforcement on auth.users, auto-created profiles, admin flag.
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

select throws_ok($$ select pg_temp.new_user('someone@gmail.com') $$, '23514', null,
  'a non-AIT email cannot create an account');
select throws_ok($$ select pg_temp.new_user('st1@ait.asia.evil.com') $$, '23514', null,
  'look-alike domains are rejected');
select throws_ok($$ select pg_temp.new_user('st1@student.ait.asia') $$, '23514', null,
  'subdomains are rejected (only @ait.asia)');
select throws_ok($$ insert into auth.users (id, aud, role) values (gen_random_uuid(), 'authenticated', 'authenticated') $$,
  '23514', null, 'an account without an email is rejected');
select lives_ok($$ select pg_temp.set_id('a', pg_temp.new_user('ST123@AIT.ASIA', 'Alex')) $$,
  'upper-case AIT emails are accepted');
select pg_temp.set_id('b', pg_temp.new_user('st456@ait.asia', 'Bea'));

select throws_ok(format($$ update auth.users set email = 'bea@gmail.com' where id = %L $$, pg_temp.id('b')),
  '23514', null, 'an email cannot be changed to another domain');
select lives_ok(format($$ update auth.users set last_sign_in_at = now() where id = %L $$, pg_temp.id('b')),
  'other auth updates are unaffected');

select is((select name from public.users where id = pg_temp.id('a')), 'Alex', 'a profile row is created from the signup metadata');
select is((select email from public.users where id = pg_temp.id('b')), 'st456@ait.asia', 'the profile mirrors the auth email');

select is(private.hook_before_user_created('{"user":{"email":"x@gmail.com"}}'::jsonb) -> 'error' ->> 'http_code', '403',
  'the auth hook refuses other domains with a 403');
select is(private.hook_before_user_created('{"user":{"email":"x@ait.asia"}}'::jsonb), '{}'::jsonb,
  'the auth hook lets @ait.asia through');

-- Users can't make themselves admin or change their rating.
select pg_temp.login(pg_temp.id('b'));
update public.users set is_admin = true, rating = 5, reviews_count = 99, name = 'Bea B.' where id = pg_temp.id('b');
select is((select is_admin from public.users where id = pg_temp.id('b')), false, 'is_admin is not client-writable');
select is((select rating from public.users where id = pg_temp.id('b')), 0::numeric, 'rating is not client-writable');
select is((select name from public.users where id = pg_temp.id('b')), 'Bea B.', 'other profile fields are editable');
select is(public.is_admin(), false, 'is_admin() is false for a student');
select pg_temp.logout();

update public.users set is_admin = true where id = pg_temp.id('a');
select pg_temp.login(pg_temp.id('a'));
select is(public.is_admin(), true, 'is_admin() is true for an admin');
select pg_temp.logout();

select * from finish();
rollback;
