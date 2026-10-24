import { type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

// Next 16 "proxy" convention (formerly middleware.ts): refreshes the Supabase
// session cookie on every request. Runs on the Node.js runtime.
export async function proxy(request: NextRequest) {
  const { supabase, response } = createClient(request)
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
