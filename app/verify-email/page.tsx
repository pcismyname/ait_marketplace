import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
export default function VerifyEmailPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-muted text-primary mb-6">
        <MailCheck className="h-8 w-8" />
      </div>
      
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Check your inbox</h1>
      <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
        We've sent a magic link to your email address. Click the link to securely log in and verify your account.
      </p>

      <div className="mt-8 space-y-4">
        <a href="https://mail.google.com" className={cn(buttonVariants({ variant: "outline" }), "w-full")} target="_blank" rel="noopener noreferrer">
          Open Gmail
        </a>
        <div className="text-[13px] text-muted-foreground">
          Didn't receive the email? <button className="font-semibold text-primary hover:underline">Resend</button>
        </div>
      </div>

      <div className="mt-12 text-[13px]">
        <Link href="/login" className="text-muted-foreground hover:text-foreground hover:underline">
          &larr; Back to login
        </Link>
      </div>
    </div>
  )
}
