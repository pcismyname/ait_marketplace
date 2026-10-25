-- Rentals booked before the P0 schema (the old 4-phase model) were paid
-- without ledger rows. When they settle, settle_rental posts
-- `hold_release held -deposit`, which would leave the renter with a negative
-- "held" balance and an unbacked "available" balance.
-- Record the deposit the platform has been holding for them, the same way
-- pay_rental does: the payment from outside (external) and the escrow hold.
-- Their rental-fee payout was already marked as settled by p0_core, so no
-- owner hold is added. Safe to re-run: only rentals with no ledger rows.

insert into public.wallet_ledger (user_id, rental_id, kind, bucket, amount, memo)
select r.renter_id, r.id, 'payment', 'external', -r.deposit,
       'Deposit paid for a booking made before escrow tracking'
from public.rentals r
where r.phase in ('paid', 'active', 'overdue', 'return-pending', 'disputed')
  and r.deposit > 0
  and not exists (select 1 from public.wallet_ledger w where w.rental_id = r.id);

insert into public.wallet_ledger (user_id, rental_id, kind, bucket, amount, memo)
select r.renter_id, r.id, 'hold', 'held', r.deposit, 'Deposit held in escrow'
from public.rentals r
where r.phase in ('paid', 'active', 'overdue', 'return-pending', 'disputed')
  and r.deposit > 0
  and not exists (
    select 1 from public.wallet_ledger w
    where w.rental_id = r.id and w.kind <> 'payment'
  );
