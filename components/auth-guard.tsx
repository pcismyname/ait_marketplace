'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useMarketplace } from '@/lib/store'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useMarketplace()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const isAuthPage = pathname === '/login' || pathname === '/signup'
    
    if (!isAuthenticated && !isAuthPage) {
      router.replace('/login')
    } else if (isAuthenticated && isAuthPage) {
      router.replace('/')
    }
  }, [isAuthenticated, pathname, router, mounted])

  if (!mounted) return null
  
  const isAuthPage = pathname === '/login' || pathname === '/signup'
  if (!isAuthenticated && !isAuthPage) return null
  
  return <>{children}</>
}
