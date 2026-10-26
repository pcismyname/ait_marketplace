-- Sale commission (BusinessRules §2, decided 2026-10-26).
--
-- The seller pays 10% of the sale price on protected sales, taken from the
-- payout when escrow releases. The buyer protection fee (฿10 + 3%) is
-- unchanged, and in-person sales stay free.
--
--   1. transactions.seller_commission: the commission quoted at checkout
--      (0 for in-person sales and for purchases paid before this rule).
--      After release it holds the commission actually charged.
--   2. quote_sale also returns sellerCommission and sellerPayout
--      (same numbers as computeSaleQuote in lib/fees.ts).
--   3. create_sale stores the quoted commission.
--   4. release_sale charges 10% of what the seller keeps:
--      round((price - refund) * 10%), so a full refund means no commission.
--      The commission is booked as a platform_fee; the dispute's
--      seller_amount is updated to the net payout.

-- ─── 1. Column ──────────────────────────────────────────────────────────────
alter table public.transactions
  add column if not exists seller_commission numeric not null default 0;

alter table public.transactions drop constraint if exists transactions_seller_commission_check;
alter table public.transactions add constraint transactions_seller_commission_check
  check (seller_commission >= 0 and (mode = 'protected' or seller_commission = 0));

comment on column public.transactions.seller_commission is
  'Sale commission (10%) taken from the seller payout on protected sales. Quoted at checkout; after release, the amount charged. BusinessRules §2.';

-- ─── 2. Quote ───────────────────────────────────────────────────────────────
create or replace function public.quote_sale(p_price numeric, p_mode text)
returns jsonb
language plpgsql immutable
security definer
set search_path = public
as $$
declare
  v_price double precision := p_price::double precision;
  v_fee double precision := 0;
  v_commission double precision := 0;
begin
  if p_price is null or p_price < 0 then
    raise exception 'The price must be zero or more.';
  end if;
  if p_mode not in ('in-person', 'protected') then
    raise exception 'Unknown payment mode "%": use in-person or protected.', p_mode;
  end if;
  if p_mode = 'protected' then
    v_fee := 10 + private.js_round(v_price * 0.03::double precision);
    v_commission := private.js_round(v_price * 0.1::double precision);
  end if;
  return jsonb_build_object(
    'mode', p_mode,
    'price', v_price,
    'protectionFee', v_fee,
    'total', v_price + v_fee,
    'sellerCommission', v_commission,
    'sellerPayout', v_price - v_commission,
    'escrow', p_mode = 'protected'
  );
end
$$;
comment on function public.quote_sale(numeric, text) is
  'Sale quote, same shape and numbers as computeSaleQuote in lib/fees.ts.';

-- ─── 3. Purchase stores the quoted commission ───────────────────────────────
create or replace function public.create_sale(p_listing_id text, p_mode text, p_method text default null)
returns public.transactions
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := private.require_uid();
  l public.listings;
  q jsonb;
  t public.transactions;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found.';
  end if;
  if l.type <> 'sale' then
    raise exception 'This listing is for rent; request a rental instead.';
  end if;
  if l.seller_id = v_uid then
    raise exception 'You can''t buy your own listing.';
  end if;
  if l.status <> 'available' then
    raise exception 'This item isn''t available right now.';
  end if;
  q := public.quote_sale(l.price, p_mode);

  if p_mode = 'in-person' then
    select * into t from public.transactions
    where listing_id = l.id and buyer_id = v_uid and status = 'pending';
    if found then
      return t;
    end if;
    insert into public.transactions (listing_id, buyer_id, seller_id, mode, price, protection_fee, total, status)
    values (l.id, v_uid, l.seller_id, 'in-person', l.price, 0, l.price, 'pending')
    returning * into t;
    perform private.notify(l.seller_id, 'sale_requested', 'Buyer wants to pay in person',
      format('%s wants to buy "%s" and pay you ฿%s at handover. Mark it sold once paid.',
             private.user_name(v_uid), l.title, l.price), private.deal_link(t.id));
    return t;
  end if;

  if p_method is null or p_method not in ('promptpay', 'card', 'wallet') then
    raise exception 'Choose a payment method: promptpay, card or wallet.';
  end if;
  insert into public.transactions (listing_id, buyer_id, seller_id, mode, price, protection_fee, total,
                                   seller_commission, payment_method, status, paid_at)
  values (l.id, v_uid, l.seller_id, 'protected', l.price, (q ->> 'protectionFee')::numeric,
          (q ->> 'total')::numeric, (q ->> 'sellerCommission')::numeric, p_method, 'paid', now())
  returning * into t;

  perform private.take_payment(v_uid, t.total, p_method, format('Protected purchase: %s', l.title), null, t.id);
  perform private.ledger(l.seller_id, 'hold', 'held', t.price, 'Sale payment, released 48 h after handover', null, t.id);
  perform private.ledger(null, 'platform_fee', 'platform', t.protection_fee, 'Buyer protection fee', null, t.id);

  update public.listings set status = 'reserved' where id = l.id;

  perform private.notify(l.seller_id, 'sale_paid', 'Item paid with protection',
    format('%s paid ฿%s for "%s". Pass It On holds it until handover plus 48 hours, then pays you ฿%s (after the %s%% sale commission). Meet at %s.',
           private.user_name(v_uid), t.price, l.title, t.price - t.seller_commission, 10, l.pickup_location),
    private.deal_link(t.id));
  return t;
end
$$;

-- ─── 4. Release deducts the commission ──────────────────────────────────────
create or replace function private.release_sale(p_transaction_id text, p_refund numeric, p_status text, p_dispute_id text default null)
returns public.transactions
language plpgsql security definer
set search_path = ''
as $$
declare
  t public.transactions;
  v_refund numeric;
  v_commission numeric;
  v_payout numeric;
  v_title text;
  v_sold boolean;
  v_other record;
begin
  select * into t from public.transactions where id = p_transaction_id for update;
  v_refund := least(t.price, greatest(0, coalesce(p_refund, 0)));
  -- 10% of what the seller keeps. Purchases quoted before the rule (stored
  -- commission 0) stay commission-free.
  v_commission := case
    when t.seller_commission > 0
      then private.js_round(greatest(0, t.price - v_refund)::double precision * 0.1::double precision)::numeric
    else 0
  end;
  v_payout := t.price - v_refund - v_commission;
  v_sold := not (v_refund >= t.price and v_refund > 0);
  select title into v_title from public.listings where id = t.listing_id;

  perform private.ledger(t.seller_id, 'hold_release', 'held', -t.price, 'Sale payment released from escrow', null, t.id, p_dispute_id);
  perform private.ledger(t.seller_id, 'payout', 'available', v_payout, 'Sale payout', null, t.id, p_dispute_id);
  perform private.ledger(null, 'platform_fee', 'platform', v_commission, 'Sale commission', null, t.id, p_dispute_id);
  perform private.ledger(t.buyer_id, 'refund', 'available', v_refund, 'Refund from dispute', null, t.id, p_dispute_id);

  update public.transactions
  set status = p_status, released_at = now(), completed_at = now(),
      refund_to_buyer = v_refund, seller_amount = v_payout, seller_commission = v_commission,
      handover_at = coalesce(handover_at, now())
  where id = t.id
  returning * into t;

  if p_dispute_id is not null then
    update public.disputes set seller_amount = v_payout where id = p_dispute_id;
  end if;

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
    case when v_commission > 0
      then format('฿%s for "%s" is now in your wallet (simulated), after the ฿%s sale commission.', v_payout, v_title, v_commission)
      else format('฿%s for "%s" is now in your wallet (simulated).', v_payout, v_title)
    end, private.deal_link(t.id));
  if v_refund > 0 then
    perform private.notify(t.buyer_id, 'sale_' || p_status, 'Refund issued',
      format('฿%s for "%s" was refunded to your wallet.', v_refund, v_title), private.deal_link(t.id));
  end if;
  return t;
end
$$;
