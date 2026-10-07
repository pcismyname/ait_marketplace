'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X, ShieldCheck, ArrowLeft, MessageCircle } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

const MOCK_REQUESTS = [
  { id: 'req_1', user: { name: 'Alex Wong', batch: 'Fall 2026', program: 'Computer Science', rating: 4.8 }, message: 'Hi! Is this still available? I can pick it up tomorrow afternoon.', date: '2 hours ago', status: 'pending' },
  { id: 'req_2', user: { name: 'Sarah Jenkins', batch: 'Spring 2025', program: 'Data Science', rating: 5.0 }, message: 'Would you be willing to do 350 THB?', date: '5 hours ago', status: 'pending' },
]

export default function ListingRequestsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { listings } = useMarketplace()
  const [requests, setRequests] = useState(MOCK_REQUESTS)
  const [listing, setListing] = useState(listings.find(l => l.id === id))

  const onAccept = (reqId: string) => {
    setRequests(requests.filter(r => r.id !== reqId))
    toast.success('Request accepted!', { description: 'The buyer has been notified to proceed with payment.' })
  }

  const onDecline = (reqId: string) => {
    setRequests(requests.filter(r => r.id !== reqId))
    toast('Request declined')
  }

  if (!listing) return null

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/my-listings')} className="shrink-0 h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Listing Requests</h1>
          <p className="text-[13px] text-muted-foreground mt-1">For "{listing.title}"</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MessageCircle className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold tracking-tight">No pending requests</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">You've responded to all requests for this item.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-border bg-card p-5 transition-all">
              <div className="flex flex-col sm:flex-row gap-5">
                
                {/* User Info */}
                <div className="flex flex-1 gap-4">
                  <Avatar className="h-10 w-10 shrink-0 border border-border">
                    <AvatarFallback className="text-[11px] font-bold bg-primary-muted text-primary">
                      {req.user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold">{req.user.name}</p>
                      <span className="flex items-center gap-0.5 rounded-sm bg-surface-tinted px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      {req.user.program} &middot; {req.user.batch} &middot; ⭐ {req.user.rating}
                    </p>
                    <p className="mt-2 text-[13px] italic text-muted-foreground bg-muted/50 p-2 rounded-md border border-border/50">
                      "{req.message}"
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-2">{req.date}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-start gap-2 shrink-0 sm:flex-col sm:justify-start">
                  <Button onClick={() => onAccept(req.id)} size="sm" className="w-full sm:w-auto h-8 text-[12px]">
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button onClick={() => onDecline(req.id)} size="sm" variant="outline" className="w-full sm:w-auto h-8 text-[12px]">
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Decline
                  </Button>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
