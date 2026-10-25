-- Pre-arrival matching (Proposal "calendar-aware matching", Timeline P0
-- "same category + needed-by date", BusinessRules §9 "pre-arrival matches are
-- held until the incoming student arrives").
--
-- A need matches a listing when:
--   * the listing is live (`status = 'available'`; hidden / paused / sold /
--     rented / reserved listings never match),
--   * same category,
--   * the listing type fits (`needs.listing_type` is 'any', 'sale' or 'rent'),
--   * the listing isn't the need owner's own,
--   * the need is still open: no needed-by date, or needed-by is at most
--     30 days in the past (students keep looking in their first month).
-- Featured listings (premium placement, not past featured_until) come first,
-- then the newest.
--
-- When a listing becomes live (new listing, or back to available) the owner
-- of every open matching need gets one in-app notification per need and
-- listing (dedupe key `match:<need>:<listing>`).
--
-- Idempotent: safe to re-run.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Columns
-- ───────────────────────────────────────────────────────────────────────────

alter table public.needs
  add column if not exists needed_by date,
  add column if not exists listing_type text not null default 'any';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'needs_listing_type_check') then
    alter table public.needs
      add constraint needs_listing_type_check check (listing_type = any (array['any', 'sale', 'rent']));
  end if;
end
$$;

create index if not exists needs_category_idx on public.needs (category, needed_by);

comment on column public.needs.needed_by is
  'Date the student needs the item by (usually their arrival). Matching stays open until 30 days after it.';
comment on column public.needs.listing_type is
  'Which listings match: any, sale (buy) or rent.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Free-text arrival dates → needed_by (legacy rows and old clients)
-- ───────────────────────────────────────────────────────────────────────────

-- 'YYYY-MM-DD' or 'August 2026' / 'Aug 2026' (→ first of that month).
create or replace function private.parse_need_date(p_text text)
returns date
language plpgsql stable
set search_path = ''
as $$
declare
  v text := trim(coalesce(p_text, ''));
begin
  if v ~ '^\d{4}-\d{2}-\d{2}$' then
    return v::date;
  end if;
  if v ~* '^[a-z]+\.?\s+\d{4}$' then
    begin
      return to_date(replace(v, '.', ''), 'FMMonth YYYY');
    exception when others then
      return to_date(replace(v, '.', ''), 'Mon YYYY');
    end;
  end if;
  return null;
exception when others then
  return null;
end
$$;

create or replace function private.fill_need_date()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.needed_by is null then
    new.needed_by := private.parse_need_date(new.arrival_date);
  end if;
  return new;
end
$$;

drop trigger if exists needs_fill_date on public.needs;
create trigger needs_fill_date
  before insert or update of arrival_date, needed_by on public.needs
  for each row execute function private.fill_need_date();

update public.needs set needed_by = private.parse_need_date(arrival_date)
where needed_by is null and private.parse_need_date(arrival_date) is not null;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. The matching rule (one place)
-- ───────────────────────────────────────────────────────────────────────────

create or replace function private.need_is_open(p_needed_by date)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_needed_by is null or p_needed_by >= current_date - 30
$$;

create or replace function private.need_matches_listing(n public.needs, l public.listings)
returns boolean
language sql stable
set search_path = ''
as $$
  select l.status = 'available'
     and l.category = n.category
     and (n.listing_type = 'any' or n.listing_type = l.type)
     and l.seller_id <> n.user_id
     and private.need_is_open(n.needed_by)
$$;

-- Matches for the caller's own needs (p_need_id null), or for one need
-- (needs are readable by every signed-in user, so this reveals nothing new).
create or replace function public.match_needs(p_need_id text default null)
returns table (need_id text, listing_id text, featured boolean, listed_at timestamptz)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
begin
  return query
  select n.id, l.id,
         coalesce(l.featured, false) and (l.featured_until is null or l.featured_until > now()),
         l.created_at
  from public.needs n
  join public.listings l on private.need_matches_listing(n, l)
  where (p_need_id is null and n.user_id = v_uid) or n.id = p_need_id
  order by n.id,
           (coalesce(l.featured, false) and (l.featured_until is null or l.featured_until > now())) desc,
           l.created_at desc;
end
$$;

comment on function public.match_needs(text) is
  'Live listings matching the caller''s needs (or one need): category, type, needed-by window. Featured first.';

revoke all on function public.match_needs(text) from public, anon;
grant execute on function public.match_needs(text) to authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Notify need owners when a matching listing goes live
-- ───────────────────────────────────────────────────────────────────────────

create or replace function private.notify_need_matches()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  n public.needs;
begin
  if new.status is distinct from 'available' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.status is not distinct from new.status
     and old.category is not distinct from new.category
     and old.type is not distinct from new.type then
    return new;
  end if;
  for n in select * from public.needs where category = new.category loop
    if private.need_matches_listing(n, new) then
      perform private.notify(
        n.user_id, 'need_match',
        'New match: ' || left(new.title, 80),
        format('Matches your need "%s". %s', left(n.title, 80),
               case when new.type = 'rent' then 'Available to rent.' else 'For sale.' end),
        '/listing/' || new.id,
        'match:' || n.id || ':' || new.id);
    end if;
  end loop;
  return new;
end
$$;

drop trigger if exists listings_notify_need_matches on public.listings;
create trigger listings_notify_need_matches
  after insert or update of status, category, type on public.listings
  for each row execute function private.notify_need_matches();
