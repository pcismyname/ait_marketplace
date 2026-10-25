-- Fee parity: SQL quotes must equal lib/fees.ts (BusinessRules §2) to the baht,
-- including JavaScript's round-half-up on ties. Expected values were taken
-- from computeRentalQuote / computeSaleQuote; npm run test:db re-checks a grid.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- Worked examples from BusinessRules.md
select is((public.quote_rental(250, 800) ->> 'totalDueNow')::numeric, 1105::numeric, 'mini fridge: 250 + 25 + 30 + 800 = ฿1,105');
select is(public.quote_rental(250, 800),
  '{"rentalFee":250,"commission":25,"handlingFee":30,"deposit":800,"platformFees":55,"totalDueNow":1105,"refundable":800}'::jsonb,
  'rental quote has the same shape as RentalQuote in lib/fees.ts');
select is((public.quote_sale(1000, 'protected') ->> 'total')::numeric, 1040::numeric, 'protected sale ฿1,000 → ฿1,040');
select is(public.quote_sale(1000, 'protected'),
  '{"mode":"protected","price":1000,"protectionFee":40,"total":1040,"escrow":true}'::jsonb,
  'sale quote has the same shape as SaleQuote in lib/fees.ts');
select is(public.quote_sale(1200, 'in-person'),
  '{"mode":"in-person","price":1200,"protectionFee":0,"total":1200,"escrow":false}'::jsonb,
  'in-person sale is free and unprotected');

-- Escrow fee max(30, 3% of deposit)
select is((public.quote_rental(100, 0) ->> 'handlingFee')::numeric, 30::numeric, 'escrow fee minimum ฿30 (no deposit)');
select is((public.quote_rental(100, 1000) ->> 'handlingFee')::numeric, 30::numeric, 'escrow fee ฿30 at ฿1,000');
select is((public.quote_rental(100, 1500) ->> 'handlingFee')::numeric, 45::numeric, 'escrow fee ฿45 at ฿1,500');
select is((public.quote_rental(100, 3000) ->> 'handlingFee')::numeric, 90::numeric, 'escrow fee ฿90 at ฿3,000');
select is((public.quote_rental(100, null) ->> 'deposit')::numeric, 0::numeric, 'missing deposit counts as zero (legacy)');

-- Grid against JS reference values (commission, handling, total)
select is((public.quote_rental(500, 2000) ->> 'totalDueNow')::numeric, 2610::numeric, '500 / 2000 → 2610');
select is((public.quote_rental(85, 200) ->> 'commission')::numeric, 9::numeric, '85 → commission 9 (8.5 rounds up)');
select is((public.quote_rental(85, 200) ->> 'totalDueNow')::numeric, 324::numeric, '85 / 200 → 324');
select is((public.quote_rental(5, 200) ->> 'commission')::numeric, 1::numeric, '5 → commission 1 (0.5 rounds up, not to even)');
select is((public.quote_rental(15, 2050) ->> 'commission')::numeric, 2::numeric, '15 → commission 2 (1.5 rounds up)');
select is((public.quote_rental(15, 2050) ->> 'handlingFee')::numeric, 62::numeric, '2050 → escrow 62 (61.5 rounds up)');
select is((public.quote_rental(25, 1150) ->> 'handlingFee')::numeric, 35::numeric, '1150 → escrow 35 (34.5 rounds up)');
select is((public.quote_rental(25, 1150) ->> 'totalDueNow')::numeric, 1213::numeric, '25 / 1150 → 1213');
select is((public.quote_rental(45, 850) ->> 'commission')::numeric, 5::numeric, '45 → commission 5 (4.5 rounds up)');
select is((public.quote_rental(1, 3000) ->> 'totalDueNow')::numeric, 3091::numeric, '1 / 3000 → 3091');
select is((public.quote_rental(99.5, 250.5) ->> 'totalDueNow')::numeric, 390::numeric, '99.5 / 250.5 → 390');
select is((public.quote_sale(150, 'protected') ->> 'protectionFee')::numeric, 15::numeric, '150 → protection 15 (4.5 rounds up)');
select is((public.quote_sale(50, 'protected') ->> 'protectionFee')::numeric, 12::numeric, '50 → protection 12 (1.5 rounds up)');
select is((public.quote_sale(2050, 'protected') ->> 'total')::numeric, 2122::numeric, '2050 → 2122');
select is((public.quote_sale(99.5, 'protected') ->> 'total')::numeric, 112.5::numeric, '99.5 → 112.5');

select throws_ok($$ select public.quote_sale(100, 'cash') $$, 'P0001', null, 'unknown sale mode is rejected');
select throws_ok($$ select public.quote_rental(-1, 200) $$, 'P0001', null, 'negative price is rejected');

-- Late fees (lib/fees.ts dailyLateFee / lateReturnSettlement)
select is((select late_fee from private.late_settlement(now(), now() + interval '3 days', 300, 30, 800)), 30::numeric,
  '3 days late on ฿300 / month → ฿30');
select is((select daily_fee from private.late_settlement(now(), now(), 250, 120, 800)), 3::numeric,
  'daily fee is ceil(250 / 120) = 3');
select is((select days from private.late_settlement(now(), now() + interval '1 hour', 100, 7, 300)), 1,
  'part days count as a whole day');
select ok((select not is_missing from private.late_settlement(now(), now() + interval '7 days', 100, 7, 300)),
  'exactly 7 days late is still overdue');
select is((select late_fee from private.late_settlement(now(), now() + interval '7 days 1 hour', 100, 7, 300)), 300::numeric,
  'more than 7 days late is missing: full deposit');

select * from finish();
rollback;
