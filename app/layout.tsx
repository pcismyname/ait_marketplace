import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, Playfair_Display } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { BRAND_FULL } from '@/lib/data'
import { MarketplaceProvider } from '@/lib/store'
import { SiteHeader } from '@/components/site-header'
import { Toaster } from '@/components/ui/sonner'
import { AuthGuard } from '@/components/auth-guard'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: `${BRAND_FULL} — Buy, Sell & Rent on campus`,
  description:
    'PassItOn is the circular student marketplace for the Asian Institute of Technology. Buy, sell and rent furniture, electronics, bikes, textbooks and kitchen gear, with rental deposits held in escrow and outgoing students matched to incoming ones.',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f3ee' },
    { media: '(prefers-color-scheme: dark)', color: '#141e16' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`bg-background ${instrumentSans.variable} ${playfair.variable}`}>
      <body className="antialiased font-sans">
        <MarketplaceProvider>
          <Suspense fallback={null}>
            <AuthGuard>
              <SiteHeader />
              <main className="min-h-[calc(100vh-4rem)]">{children}</main>
            </AuthGuard>
          </Suspense>
          <Toaster position="top-center" />
        </MarketplaceProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
