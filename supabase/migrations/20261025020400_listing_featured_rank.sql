-- Browse ordering: featured listings first, honouring the 7-day expiry.
--
-- `listings.featured` stays client-writable (premium placement is simulated,
-- BusinessRules §2), and `featured_until` records when the placement ends.
-- PostgREST can't order by an expression, so `is_featured` is a computed
-- field: `select=*,is_featured` / `order=is_featured.desc` work on listings.
--
-- A listing counts as featured while `featured` is true and `featured_until`
-- is empty (legacy rows, no expiry) or still in the future.

create or replace function public.is_featured(l public.listings)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(l.featured, false) and (l.featured_until is null or l.featured_until > now())
$$;

comment on function public.is_featured(public.listings) is
  'Computed field for browse ordering: featured and not past featured_until.';

grant execute on function public.is_featured(public.listings) to anon, authenticated, service_role;
