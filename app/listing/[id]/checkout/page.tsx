'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { ArrowLeft, CreditCard, QrCode, ShieldCheck, Tag } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { computeRentalQuote, RENTAL_COMMISSION_RATE } from '@/lib/fees'
import { Button } from '@/components/ui/button'

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { listings } = useMarketplace()
  const listing = listings.find(l => l.id === id)

  const [paymentMethod, setPaymentMethod] = useState<'promptpay' | 'card'>('promptpay')
  const [processing, setProcessing] = useState(false)

  if (!listing) return null

  const isRent = listing.type === 'rent'
  const quote = isRent ? computeRentalQuote({ price: listing.price, deposit: listing.deposit }) : null
  const total = isRent ? quote!.totalDueNow : listing.price

  const onPay = () => {
    setProcessing(true)
    setTimeout(() => {
      setProcessing(false)
      toast.success('Payment successful!', { description: 'Your transaction has been secured.' })
      router.push(`/transaction/tx_${listing.id}`)
    }, 1500)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-3 mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        
        {/* Left Col: Payment Method */}
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Secure Checkout</h1>
            <p className="mt-2 text-[14px] text-muted-foreground">Select a payment method to complete your order.</p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Payment Method</h2>
            
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
                paymentMethod === 'promptpay' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'
              }`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#113566] text-white">
                  <QrCode className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-foreground">PromptPay</p>
                  <p className="text-[11px] text-muted-foreground">Scan QR code</p>
                </div>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'promptpay'}
                  onChange={() => setPaymentMethod('promptpay')}
                  className="h-4 w-4 text-primary focus:ring-primary"
                />
              </label>

              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
                paymentMethod === 'card' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'
              }`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-foreground">Credit Card</p>
                  <p className="text-[11px] text-muted-foreground">Powered by Omise</p>
                </div>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  className="h-4 w-4 text-primary focus:ring-primary"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-foreground">Escrow Protection</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Your payment is held securely in escrow by PassItOn. Funds are only released to the seller once you confirm receipt of the item in the described condition.
              </p>
            </div>
          </div>
        </div>

        {/* Right Col: Order Summary */}
        <div>
          <div className="sticky top-24 rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-semibold tracking-tight">Order Summary</h2>
            
            <div className="flex gap-4">
              <div className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-md bg-surface-tinted">
                <Image src={listing.images[0]} alt={listing.title} fill className="object-cover" />
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-[14px] font-semibold line-clamp-2">{listing.title}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[12px] font-medium text-muted-foreground capitalize">{listing.type}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4 text-[13px]">
              {isRent ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rental fee ({listing.rentalPeriod})</span>
                    <span className="font-medium">฿{listing.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform fee ({RENTAL_COMMISSION_RATE * 100}%)</span>
                    <span className="font-medium">฿{quote?.commission}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Escrow handling fee</span>
                    <span className="font-medium">฿{quote?.handlingFee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Security deposit <span className="text-[11px]">(Refundable)</span></span>
                    <span className="font-medium">฿{quote?.deposit}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Item Price</span>
                  <span className="font-medium">฿{listing.price}</span>
                </div>
              )}
            </div>

            <div className="flex items-end justify-between border-t border-border pt-4">
              <p className="text-[14px] font-semibold">Total to Pay</p>
              <p className="font-display text-2xl font-bold text-foreground">฿{total}</p>
            </div>

            <Button onClick={onPay} disabled={processing} className="w-full h-11 text-[13px] font-semibold">
              {processing ? 'Processing...' : 'Confirm & Pay'}
            </Button>
            
            <p className="text-center text-[10px] text-muted-foreground px-4">
              By confirming, you agree to the AIT Circular Marketplace terms of service.
            </p>
          </div>
        </div>
        
      </div>
    </div>
  )
}
