-- Fixes from the final review of feat/p0-core (BusinessRules.md wins).
--
--   1. Wallet payments take the per-user wallet lock (BusinessRules §8: a
--      wallet payment must be covered by the balance). private.take_payment
--      now serialises with wallet_withdraw and enable_premium_placement, so
--      concurrent payments or a payment plus a withdrawal can't overdraw.
--   2. The owner's rental fee is paid 48 h after handover (§4) on every path.
--      settle_rental no longer releases it early when an admin resolves a
--      dispute quickly; run_escrow_jobs pays 'resolved' rentals at payout_at.
--   3. Whole baht (§2) for dispute claims and admin resolution amounts, and a
--      claim can't be negative.
--   4. Condition photos in SQL (§4, §9): confirm_handover, mark_returned and
--      confirm_return need at least one photo, uploaded under
--      dispute-evidence/rental/<id>/. Photos already on the rental count for
--      confirm_return (either party's).
--   5. Only the renter confirms a rental handover (§4 clarification, added
--      2026-10-25): the receiving party says they have the item, at the
--      pickup point, so an owner can't start the payout clock alone.
--   6. mark_sold(listing, buyer) needs a pending in-person purchase from that
--      buyer (they asked to buy). Without one, a seller could record a sale to
--      any student and review them.
--   7. release_sale cancels other buyers' pending in-person purchases once the
--      listing is sold, as mark_sold does.
--   8. Messages can't be edited (chat is dispute evidence, §6).
--   9. Clients can't write listings.times_changed_hands or view_count, and the
--      deposit must be 30–50% of the replacement value when one is given (§3).
--      Item history is written by the RPCs; a seller can only add the single
--      "Listed on …" row for a new listing, and can't edit or delete rows.
--
-- Idempotent (create or replace / drop if exists).

-- ─── 1. Wallet lock ─────────────────────────────────────────────────────────
create or replace function private.take_payment(
  p_user_id text, p_amount numeric, p_method text, p_memo text,
  p_rental_id text default null, p_transaction_id text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_balance numeric;
begin
  if p_method is null or p_method not in ('promptpay', 'card', 'wallet') then
    raise exception 'Choose a payment method: promptpay, card or wallet.';
  end if;
  if p_method = 'wallet' then
    -- Same lock as wallet_withdraw / enable_premium_placement (re-entrant
    -- within one transaction). The balance is read after it is held.
    perform pg_advisory_xact_lock(hashtext('wallet:' || p_user_id));
    v_balance := private.available_balance(p_user_id);
    if v_balance < p_amount then
      raise exception 'Your wallet has ฿% available, which doesn''t cover ฿%. Pay with PromptPay or card instead.',
        v_balance, p_amount;
    end if;
  end if;
  perform private.ledger(p_user_id, 'payment', case when p_method = 'wallet' then 'available' else 'external' end,
                         -p_amount, p_memo, p_rental_id, p_transaction_id, null, p_method);
end
$$;

-- ─── 2. Owner payout always at payout_at ────────────────────────────────────
create or replace function private.settle_rental(
  p_rental_id text, p_phase text, p_to_owner numeric, p_reason text, p_dispute_id text default null
)
returns public.rentals
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.rentals;
  v_to_owner numeric;
  v_to_renter numeric;
  v_title text;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  v_to_owner := least(r.deposit, greatest(0, coalesce(p_to_owner, 0)));
  v_to_renter := r.deposit - v_to_owner;
  select title into v_title from public.listings where id = r.listing_id;

  perform private.ledger(r.renter_id, 'hold_release', 'held', -r.deposit, 'Deposit released from escrow', r.id, null, p_dispute_id);
  perform private.ledger(r.renter_id, 'refund', 'available', v_to_renter, 'Deposit refund', r.id, null, p_dispute_id);
  perform private.ledger(r.owner_id, 'claim', 'available', v_to_owner,
    case when p_phase = 'missing' then 'Deposit for an item not returned'
         when p_dispute_id is not null then 'Deposit share from dispute'
         else 'Late fee from deposit' end, r.id, null, p_dispute_id);

  update public.rentals
  set phase = p_phase, released_at = now(), deposit_to_owner = v_to_owner, deposit_to_renter = v_to_renter
  where id = r.id
  returning * into r;

  update public.listings
  set status = case when p_phase = 'missing' then 'paused' else 'available' end
  where id = r.listing_id and status = 'rented';

  -- The rental fee is paid out 48 h after handover (BusinessRules §4). A
  -- dispute only delays it past that time; a quick resolution doesn't bring
  -- it forward (run_escrow_jobs pays it at payout_at).
  if r.payout_released_at is null and r.payout_at <= now() then
    perform private.release_rental_payout(r.id);
    select * into r from public.rentals where id = r.id;
  end if;

  perform private.notify(r.renter_id, 'rental_' || replace(p_phase, '-', '_'),
    case p_phase when 'missing' then 'Rental marked missing' when 'resolved' then 'Dispute resolved' else 'Deposit released' end,
    format('"%s": ฿%s refunded to your wallet, ฿%s to the owner. %s', v_title, v_to_renter, v_to_owner, p_reason),
    private.deal_link(r.id));
  perform private.notify(r.owner_id, 'rental_' || replace(p_phase, '-', '_'),
    case p_phase when 'missing' then 'Rental marked missing' when 'resolved' then 'Dispute resolved' else 'Rental closed' end,
    format('"%s": ฿%s of the deposit goes to you, ฿%s back to the renter. %s', v_title, v_to_owner, v_to_renter, p_reason),
    private.deal_link(r.id));
  return r;
end
$$;

create or replace function public.run_escrow_jobs()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_row record;
  v_payouts integer := 0;
  v_overdue integer := 0;
  v_missing integer := 0;
  v_rentals_released integer := 0;
  v_sales_released integer := 0;
  v_reminders integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('pass_it_on.run_escrow_jobs')) then
    return jsonb_build_object('skipped', true);
  end if;

  -- Overdue: past the due date and not returned.
  for v_row in
    update public.rentals set phase = 'overdue', overdue_at = now()
    where phase = 'active' and due_date < now()
    returning id, renter_id, owner_id, listing_id
  loop
    v_overdue := v_overdue + 1;
    perform private.notify(v_row.renter_id, 'rental_overdue', 'Rental overdue',
      'Your rental is past its due date. A daily late fee comes out of the deposit; after 7 days it counts as missing.',
      private.deal_link(v_row.id), 'overdue:' || v_row.id);
    perform private.notify(v_row.owner_id, 'rental_overdue', 'Rental overdue',
      'Your item is past its due date. A daily late fee comes out of the deposit; after 7 days the full deposit goes to you.',
      private.deal_link(v_row.id), 'overdue:' || v_row.id);
  end loop;

  -- Missing: more than 7 days late.
  for v_row in
    select id from public.rentals
    where phase = 'overdue' and now() > due_date + interval '7 days'
    for update skip locked
  loop
    perform private.settle_missing(v_row.id);
    v_missing := v_missing + 1;
  end loop;

  -- Rental auto-release: return window closed without a dispute.
  for v_row in
    select id, late_fee from public.rentals
    where phase = 'return-pending' and dispute_window_ends_at <= now()
    for update skip locked
  loop
    perform private.settle_rental(v_row.id, 'released', v_row.late_fee,
      'The 48-hour window closed with no dispute.');
    v_rentals_released := v_rentals_released + 1;
  end loop;

  -- Owner payout: 48 h after handover, unless a dispute is open at that time
  -- (then at the resolution, or at payout_at if the resolution came first).
  for v_row in
    select id from public.rentals
    where payout_released_at is null and payout_at <= now()
      and phase in ('active', 'overdue', 'return-pending', 'released', 'missing', 'resolved')
    for update skip locked
  loop
    perform private.release_rental_payout(v_row.id);
    v_payouts := v_payouts + 1;
  end loop;

  -- Protected sale auto-release: 48 h after handover without a dispute.
  for v_row in
    select id from public.transactions
    where status = 'handed-over' and dispute_window_ends_at <= now()
    for update skip locked
  loop
    perform private.release_sale(v_row.id, 0, 'released');
    v_sales_released := v_sales_released + 1;
  end loop;

  -- Reminders 24 h and 2 h before a window closes (once each).
  for v_row in
    select r.id, r.renter_id, r.owner_id, r.dispute_window_ends_at as ends_at,
           case when now() >= r.dispute_window_ends_at - interval '2 hours' then '2' else '24' end as hours
    from public.rentals r
    where r.phase = 'return-pending'
      and now() >= r.dispute_window_ends_at - interval '24 hours'
      and now() < r.dispute_window_ends_at
  loop
    perform private.notify(v_row.owner_id, 'window_reminder',
      format('%s hours left to report a problem', v_row.hours),
      'After that the deposit releases to the renter automatically.',
      private.deal_link(v_row.id), format('reminder%s:%s:owner', v_row.hours, v_row.id));
    perform private.notify(v_row.renter_id, 'window_reminder',
      format('Deposit releases in %s hours', v_row.hours),
      'If the owner reports no problem, your deposit comes back automatically.',
      private.deal_link(v_row.id), format('reminder%s:%s:renter', v_row.hours, v_row.id));
    v_reminders := v_reminders + 1;
  end loop;

  for v_row in
    select t.id, t.buyer_id, t.dispute_window_ends_at as ends_at,
           case when now() >= t.dispute_window_ends_at - interval '2 hours' then '2' else '24' end as hours
    from public.transactions t
    where t.status = 'handed-over'
      and now() >= t.dispute_window_ends_at - interval '24 hours'
      and now() < t.dispute_window_ends_at
  loop
    perform private.notify(v_row.buyer_id, 'window_reminder',
      format('%s hours left to open a dispute', v_row.hours),
      'After that the seller is paid automatically.',
      private.deal_link(v_row.id), format('reminder%s:%s:buyer', v_row.hours, v_row.id));
    v_reminders := v_reminders + 1;
  end loop;

  return jsonb_build_object(
    'overdue', v_overdue,
    'missing', v_missing,
    'rentalsReleased', v_rentals_released,
    'payouts', v_payouts,
    'salesReleased', v_sales_released,
    'reminderChecks', v_reminders
  );
end
$$;

-- ─── 4 + 5. Condition photos, renter confirms the handover ──────────────────
-- Every new path must be an uploaded object under dispute-evidence/<prefix>,
-- and the rental must end up with at least one photo for this step.
create or replace function private.require_condition_photos(
  p_prefix text, p_existing text[], p_new text[], p_moment text
)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  foreach v_path in array coalesce(p_new, '{}') loop
    if v_path is null or left(v_path, length(p_prefix)) <> p_prefix then
      raise exception 'Condition photos must be uploaded under dispute-evidence/%.', p_prefix;
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'dispute-evidence' and o.name = v_path) then
      raise exception 'A condition photo wasn''t uploaded (%). Add the photo again.', v_path;
    end if;
  end loop;
  if cardinality(coalesce(p_existing, '{}') || coalesce(p_new, '{}')) = 0 then
    raise exception 'Add at least one photo of the item''s condition at %.', p_moment;
  end if;
end
$$;
revoke execute on function private.require_condition_photos(text, text[], text[], text) from public, anon, authenticated;

-- Handover at the pickup point. paid → active. The renter (who receives the
-- item) confirms, with photos. Due date and payout time start now.
create or replace function public.confirm_handover(p_rental_id text, p_photos text[] default '{}')
returns public.rentals
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  r public.rentals;
  v_title text;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  if not found or v_uid not in (r.renter_id, r.owner_id) then
    raise exception 'Rental not found.';
  end if;
  if r.phase <> 'paid' then
    raise exception 'Handover can be confirmed only after payment (this booking is %).', r.phase;
  end if;
  if v_uid <> r.renter_id then
    raise exception 'The renter confirms the handover once they have the item, at the pickup point.';
  end if;
  perform private.require_condition_photos('rental/' || r.id || '/', r.handover_photos, p_photos, 'handover');
  update public.rentals
  set phase = 'active', handover_at = now(), start_date = now(),
      due_date = now() + period_days * interval '1 day',
      payout_at = now() + interval '48 hours',
      handover_photos = handover_photos || coalesce(p_photos, '{}'),
      handover_confirmed_by = v_uid
  where id = r.id returning * into r;
  select title into v_title from public.listings where id = r.listing_id;
  perform private.notify(r.owner_id, 'rental_handover', 'Handover confirmed',
    format('%s confirmed they have "%s". It is due back by %s; your rental fee is paid out 48 hours after the handover.',
           private.user_name(r.renter_id), v_title, to_char(r.due_date, 'DD Mon YYYY')),
    private.deal_link(r.id));
  return r;
end
$$;

create or replace function public.mark_returned(p_rental_id text, p_photos text[] default '{}')
returns public.rentals
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  r public.rentals;
  v_title text;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  if not found or v_uid not in (r.renter_id, r.owner_id) then
    raise exception 'Rental not found.';
  end if;
  if r.phase not in ('active', 'overdue') then
    raise exception 'Only an active or overdue rental can be marked returned (this one is %).', r.phase;
  end if;
  perform private.require_condition_photos('rental/' || r.id || '/', r.return_photos, p_photos, 'return');
  r := private.record_return(r.id, p_photos);
  if r.phase = 'return-pending' then
    select title into v_title from public.listings where id = r.listing_id;
    perform private.notify(case when v_uid = r.renter_id then r.owner_id else r.renter_id end,
      'rental_returned', 'Item returned',
      format('"%s" is back. The owner has 48 hours to confirm the condition or report a problem; then the deposit releases automatically.%s',
             v_title, case when r.late_fee > 0 then format(' Late fee: ฿%s from the deposit.', r.late_fee) else '' end),
      private.deal_link(r.id));
  end if;
  return r;
end
$$;

create or replace function public.confirm_return(p_rental_id text, p_photos text[] default '{}')
returns public.rentals
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  r public.rentals;
begin
  select * into r from public.rentals where id = p_rental_id for update;
  if not found or v_uid not in (r.renter_id, r.owner_id) then
    raise exception 'Rental not found.';
  end if;
  if r.owner_id <> v_uid then
    raise exception 'Only the owner can confirm the item came back in good condition.';
  end if;
  if r.phase not in ('active', 'overdue', 'return-pending') then
    raise exception 'Only a returned rental can be confirmed (this one is %).', r.phase;
  end if;
  perform private.require_condition_photos('rental/' || r.id || '/', r.return_photos, p_photos, 'return');
  if r.phase in ('active', 'overdue') then
    r := private.record_return(r.id, p_photos);
    if r.phase = 'missing' then
      return r;
    end if;
  else
    update public.rentals set return_photos = return_photos || coalesce(p_photos, '{}') where id = r.id;
  end if;
  return private.settle_rental(r.id, 'released', r.late_fee, 'The owner confirmed the item came back in good condition.');
end
$$;

-- ─── 3. Whole-baht dispute amounts ──────────────────────────────────────────
create or replace function public.file_dispute(
  p_reason text,
  p_description text default '',
  p_rental_id text default null,
  p_transaction_id text default null,
  p_evidence text[] default '{}',
  p_claim_amount numeric default null
)
returns public.disputes
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  r public.rentals;
  t public.transactions;
  d public.disputes;
  v_against text;
  v_prefix text;
  v_title text;
  v_path text;
begin
  if num_nonnulls(p_rental_id, p_transaction_id) <> 1 then
    raise exception 'A dispute is about exactly one rental or one purchase.';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 2 then
    raise exception 'Give a short reason for the dispute.';
  end if;
  if p_claim_amount is not null and (p_claim_amount < 0 or p_claim_amount <> trunc(p_claim_amount)) then
    raise exception 'The claim must be a whole number of baht, ฿0 or more.';
  end if;

  if p_rental_id is not null then
    select * into r from public.rentals where id = p_rental_id for update;
    if not found or v_uid not in (r.renter_id, r.owner_id) then
      raise exception 'Rental not found.';
    end if;
    if r.phase <> 'return-pending' then
      raise exception 'A rental dispute can be filed only after the return, within 48 hours (this rental is %).', r.phase;
    end if;
    if now() >= r.dispute_window_ends_at then
      raise exception 'The 48-hour dispute window for this rental has closed.';
    end if;
    if p_claim_amount is not null and p_claim_amount > r.deposit then
      raise exception 'A claim can''t exceed the ฿% deposit.', r.deposit;
    end if;
    v_against := case when v_uid = r.renter_id then r.owner_id else r.renter_id end;
    v_prefix := 'rental/' || r.id || '/';
    select title into v_title from public.listings where id = r.listing_id;
  else
    select * into t from public.transactions where id = p_transaction_id for update;
    if not found or v_uid not in (t.buyer_id, t.seller_id) then
      raise exception 'Purchase not found.';
    end if;
    if t.mode <> 'protected' then
      raise exception 'Sales paid in person have no dispute support.';
    end if;
    if t.buyer_id <> v_uid then
      raise exception 'Only the buyer can open a dispute on a purchase.';
    end if;
    if t.status <> 'handed-over' then
      raise exception 'A purchase dispute can be filed only after handover, within 48 hours (this purchase is %).', t.status;
    end if;
    if now() >= t.dispute_window_ends_at then
      raise exception 'The 48-hour dispute window for this purchase has closed.';
    end if;
    if p_claim_amount is not null and p_claim_amount > t.price then
      raise exception 'A refund claim can''t exceed the ฿% price.', t.price;
    end if;
    v_against := t.seller_id;
    v_prefix := 'sale/' || t.id || '/';
    select title into v_title from public.listings where id = t.listing_id;
  end if;

  foreach v_path in array coalesce(p_evidence, '{}') loop
    if left(v_path, length(v_prefix)) <> v_prefix then
      raise exception 'Evidence must be uploaded under dispute-evidence/%.', v_prefix;
    end if;
  end loop;

  insert into public.disputes (rental_id, transaction_id, filed_by, against_id, reason, description, evidence, claim_amount)
  values (p_rental_id, p_transaction_id, v_uid, v_against, trim(p_reason), coalesce(p_description, ''),
          coalesce(p_evidence, '{}'), p_claim_amount)
  returning * into d;

  if p_rental_id is not null then
    update public.rentals set phase = 'disputed' where id = p_rental_id;
  else
    update public.transactions set status = 'disputed' where id = p_transaction_id;
  end if;

  perform private.notify(v_against, 'dispute_opened', 'Dispute opened',
    format('%s opened a dispute about "%s": %s. The money stays held until an admin decides.',
           private.user_name(v_uid), v_title, trim(p_reason)), '/dispute/' || d.id);
  perform private.notify_admins('dispute_opened', 'New dispute to review',
    format('"%s": %s', v_title, trim(p_reason)), '/admin/disputes');
  return d;
end
$$;

-- Admin decides. Rentals: normal-wear (฿0 to owner), repairable-damage
-- (p_amount = repair cost), lost-or-destroyed (full deposit). The owner's
-- share includes any late fee and never exceeds the deposit.
-- Sales: not-as-described (p_amount = refund, default the full price) or
-- normal-wear (claim rejected, seller paid in full; BusinessRules §6).
create or replace function public.resolve_dispute(
  p_dispute_id text, p_finding text, p_amount numeric default null, p_note text default null
)
returns public.disputes
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  d public.disputes;
  r public.rentals;
  t public.transactions;
  v_claim numeric;
  v_to_owner numeric;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can resolve disputes.';
  end if;
  select * into d from public.disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'Dispute not found.';
  end if;
  if d.status <> 'open' then
    raise exception 'This dispute is already resolved.';
  end if;
  if p_amount is not null and p_amount < 0 then
    raise exception 'The amount can''t be negative.';
  end if;
  if p_amount is not null and p_amount <> trunc(p_amount) then
    raise exception 'The amount must be a whole number of baht.';
  end if;

  if d.rental_id is not null then
    select * into r from public.rentals where id = d.rental_id for update;
    if p_finding = 'normal-wear' then
      v_claim := 0;
    elsif p_finding = 'repairable-damage' then
      if p_amount is null then
        raise exception 'Enter the repair cost for repairable damage.';
      end if;
      if p_amount > r.deposit then
        raise exception 'The repair cost (฿%) can''t exceed the ฿% deposit: the owner never receives more than the deposit.', p_amount, r.deposit;
      end if;
      v_claim := p_amount;
    elsif p_finding = 'lost-or-destroyed' then
      v_claim := r.deposit;
    elsif p_finding = 'not-as-described' then
      raise exception '"Not as described" applies to sales; for a rental choose normal-wear, repairable-damage or lost-or-destroyed.';
    else
      raise exception 'Unknown finding "%".', p_finding;
    end if;
    v_to_owner := least(r.deposit, r.late_fee + v_claim);
    update public.disputes
    set status = 'resolved', finding = p_finding, resolution_amount = v_claim,
        deposit_to_owner = v_to_owner, deposit_to_renter = r.deposit - v_to_owner,
        resolution_note = nullif(trim(p_note), ''), resolved_by = v_uid, resolved_at = now()
    where id = d.id returning * into d;
    perform private.settle_rental(r.id, 'resolved', v_to_owner,
      format('Admin finding: %s.', replace(p_finding, '-', ' ')), d.id);
  else
    select * into t from public.transactions where id = d.transaction_id for update;
    if p_finding = 'not-as-described' then
      v_claim := coalesce(p_amount, t.price);
      if v_claim > t.price then
        raise exception 'The refund (฿%) can''t exceed the ฿% price.', v_claim, t.price;
      end if;
    elsif p_finding = 'normal-wear' then
      v_claim := 0;
    else
      raise exception 'For a purchase choose not-as-described (with a refund amount) or normal-wear (no refund).';
    end if;
    update public.disputes
    set status = 'resolved', finding = p_finding, resolution_amount = v_claim,
        refund_to_buyer = v_claim, seller_amount = t.price - v_claim,
        resolution_note = nullif(trim(p_note), ''), resolved_by = v_uid, resolved_at = now()
    where id = d.id returning * into d;
    perform private.release_sale(t.id, v_claim, 'resolved', d.id);
  end if;
  return d;
end
$$;

-- ─── 6. mark_sold only to a buyer who asked ─────────────────────────────────
create or replace function public.mark_sold(p_listing_id text, p_buyer_id text default null)
returns public.transactions
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  l public.listings;
  t public.transactions;
  v_other record;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found.';
  end if;
  if l.seller_id <> v_uid then
    raise exception 'Only the seller can mark this listing sold.';
  end if;
  if l.type <> 'sale' then
    raise exception 'Rental listings can''t be marked sold.';
  end if;
  if l.status = 'sold' then
    raise exception 'This listing is already sold.';
  end if;
  if exists (select 1 from public.transactions where listing_id = l.id and status in ('paid', 'handed-over', 'disputed')) then
    raise exception 'This item has a protected purchase in progress; it is marked sold when that completes.';
  end if;
  if p_buyer_id = v_uid then
    raise exception 'You can''t sell to yourself.';
  end if;

  if p_buyer_id is not null then
    select * into t from public.transactions
    where listing_id = l.id and buyer_id = p_buyer_id and status = 'pending' for update;
    if not found then
      raise exception 'That student hasn''t asked to buy this item. They tap "Buy now" and choose to pay in person first, or mark it sold without a buyer.';
    end if;
    update public.transactions set status = 'completed', completed_at = now(), seller_amount = price
    where id = t.id returning * into t;
  else
    insert into public.transactions (listing_id, buyer_id, seller_id, mode, price, protection_fee, total,
                                     status, completed_at, seller_amount)
    values (l.id, null, v_uid, 'in-person', l.price, 0, l.price, 'completed', now(), l.price)
    returning * into t;
  end if;

  for v_other in
    update public.transactions set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid
    where listing_id = l.id and status = 'pending' and id <> t.id
    returning id, buyer_id
  loop
    perform private.notify(v_other.buyer_id, 'sale_cancelled', 'Item sold to someone else',
      format('"%s" was sold to another buyer.', l.title), private.deal_link(v_other.id));
  end loop;

  update public.listings
  set status = 'sold', times_changed_hands = times_changed_hands + case when p_buyer_id is null then 0 else 1 end
  where id = l.id;
  if p_buyer_id is not null then
    insert into public.listing_history (listing_id, owner_name, action, date)
    values (l.id, private.user_name(p_buyer_id), 'Bought in person', to_char(now(), 'Mon YYYY'));
    perform private.notify(p_buyer_id, 'sale_completed', 'Purchase complete',
      format('%s marked "%s" as sold to you.', private.user_name(v_uid), l.title), private.deal_link(t.id));
  end if;
  return t;
end
$$;

-- ─── 7. A protected sale that completes closes the in-person intents ────────
create or replace function private.release_sale(p_transaction_id text, p_refund numeric, p_status text, p_dispute_id text default null)
returns public.transactions
language plpgsql security definer
set search_path = ''
as $$
declare
  t public.transactions;
  v_refund numeric;
  v_title text;
  v_sold boolean;
  v_other record;
begin
  select * into t from public.transactions where id = p_transaction_id for update;
  v_refund := least(t.price, greatest(0, coalesce(p_refund, 0)));
  v_sold := not (v_refund >= t.price and v_refund > 0);
  select title into v_title from public.listings where id = t.listing_id;

  perform private.ledger(t.seller_id, 'hold_release', 'held', -t.price, 'Sale payment released from escrow', null, t.id, p_dispute_id);
  perform private.ledger(t.seller_id, 'payout', 'available', t.price - v_refund, 'Sale payout', null, t.id, p_dispute_id);
  perform private.ledger(t.buyer_id, 'refund', 'available', v_refund, 'Refund from dispute', null, t.id, p_dispute_id);

  update public.transactions
  set status = p_status, released_at = now(), completed_at = now(),
      refund_to_buyer = v_refund, seller_amount = t.price - v_refund,
      handover_at = coalesce(handover_at, now())
  where id = t.id
  returning * into t;

  update public.listings
  set status = case when v_sold then 'sold' else 'paused' end,
      times_changed_hands = times_changed_hands + case when v_sold then 1 else 0 end
  where id = t.listing_id;

  if v_sold then
    insert into public.listing_history (listing_id, owner_name, action, date)
    values (t.listing_id, private.user_name(t.buyer_id), 'Bought with buyer protection', to_char(now(), 'Mon YYYY'));

    -- Other buyers who asked to pay in person: the item is gone.
    for v_other in
      update public.transactions set status = 'cancelled', cancelled_at = now(), cancelled_by = t.seller_id
      where listing_id = t.listing_id and status = 'pending' and id <> t.id
      returning id, buyer_id
    loop
      perform private.notify(v_other.buyer_id, 'sale_cancelled', 'Item sold to someone else',
        format('"%s" was sold to another buyer.', v_title), private.deal_link(v_other.id));
    end loop;
  end if;

  perform private.notify(t.seller_id, 'sale_' || p_status, 'Sale payment released',
    format('฿%s for "%s" is now in your wallet (simulated).', t.price - v_refund, v_title), private.deal_link(t.id));
  if v_refund > 0 then
    perform private.notify(t.buyer_id, 'sale_' || p_status, 'Refund issued',
      format('฿%s for "%s" was refunded to your wallet.', v_refund, v_title), private.deal_link(t.id));
  end if;
  return t;
end
$$;

-- ─── 8. Chat messages are evidence: no edits ────────────────────────────────
drop policy if exists "Users can update their messages" on public.messages;
revoke update on public.messages from authenticated, anon;

-- ─── 9. Listing stats, deposit vs value, item history ──────────────────────
create or replace function private.guard_listing_client_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_min numeric;
  v_max numeric;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  -- Counters are kept by the server (RPCs, seed).
  if tg_op = 'INSERT' then
    new.times_changed_hands := 1;
    new.view_count := 0;
  elsif new.times_changed_hands is distinct from old.times_changed_hands
        or new.view_count is distinct from old.view_count then
    raise exception 'Views and hand-over counts are kept by PassItOn and can''t be edited.';
  end if;

  -- §3: with a replacement value, the deposit is 30–50% of it, clamped to
  -- ฿200–฿3,000 (lib/fees.ts depositRangeForValue).
  if new.type = 'rent' and coalesce(new.replacement_value, 0) > 0 and new.deposit is not null
     and (tg_op = 'INSERT' or new.type is distinct from old.type or new.deposit is distinct from old.deposit
          or new.replacement_value is distinct from old.replacement_value) then
    -- floor(x + 0.5) = Math.round for positive x (private.js_round, inlined:
    -- this trigger runs as the client role, which can't call private.*).
    v_min := least(3000, greatest(200, floor(new.replacement_value::double precision * 0.3::double precision + 0.5)::numeric));
    v_max := least(3000, greatest(200, floor(new.replacement_value::double precision * 0.5::double precision + 0.5)::numeric));
    if new.deposit < v_min or new.deposit > v_max then
      raise exception 'For an item worth ฿%, the deposit must be between ฿% and ฿%.',
        to_char(new.replacement_value, 'FM999,999,990'), to_char(v_min, 'FM9,990'), to_char(v_max, 'FM9,990');
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists listings_client_fields_guard on public.listings;
create trigger listings_client_fields_guard
  before insert or update on public.listings
  for each row execute function private.guard_listing_client_fields();

-- Item history: the RPCs write it. A seller adds only the first row of a new
-- listing ("Listed on …", under their own name) and never edits or deletes.
drop policy if exists "Sellers add history to their listings" on public.listing_history;
drop policy if exists "Sellers edit history of their listings" on public.listing_history;
drop policy if exists "Sellers add the listed entry to a new listing" on public.listing_history;
create policy "Sellers add the listed entry to a new listing" on public.listing_history
  for insert to authenticated
  with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())::text)
    and action like 'Listed on %'
    and owner_name = (select u.name from public.users u where u.id = (select auth.uid())::text)
    and not exists (select 1 from public.listing_history h where h.listing_id = listing_history.listing_id)
  );
revoke update, delete on public.listing_history from authenticated, anon;
