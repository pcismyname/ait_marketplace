import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = createClient(await cookies())
  const { count, error } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })

  if (error) {
    return NextResponse.json(
      { connected: false, error: error.message },
      { status: 503 },
    )
  }

  return NextResponse.json({ connected: true, listings: count ?? 0 })
}