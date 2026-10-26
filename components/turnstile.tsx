'use client'

/**
 * Cloudflare Turnstile CAPTCHA widget.
 *
 * Uses the official Turnstile script loaded from Cloudflare's CDN.
 * The default sitekey (1x00000000000000000000AA) is Cloudflare's public
 * "always passes" test key — safe to use in development/demo environments.
 * In production, replace NEXT_PUBLIC_TURNSTILE_SITE_KEY with your real key.
 *
 * Props:
 *  onVerify  – called with the token once the challenge is solved.
 *  onExpire  – called when the token expires (widget needs to be re-solved).
 *  onError   – called if the challenge encounters an error.
 */

import { useEffect, useRef, useCallback } from 'react'

// Cloudflare's "always passes" test sitekey
const SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback?: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'compact'
        },
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

interface TurnstileProps {
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: () => void
  theme?: 'light' | 'dark' | 'auto'
}

export function Turnstile({
  onVerify,
  onExpire,
  onError,
  theme = 'auto',
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current)
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: onVerify,
      'expired-callback': onExpire,
      'error-callback': onError,
      theme,
      size: 'normal',
    })
  }, [onVerify, onExpire, onError, theme])

  useEffect(() => {
    // If Turnstile is already loaded, render immediately.
    if (window.turnstile) {
      renderWidget()
      return
    }

    // Otherwise inject the script once and render when it's ready.
    const existingScript = document.getElementById('cf-turnstile-script')
    if (!existingScript) {
      const script = document.createElement('script')
      script.id = 'cf-turnstile-script'
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.onload = renderWidget
      document.head.appendChild(script)
    } else {
      // Script tag exists but may still be loading
      existingScript.addEventListener('load', renderWidget)
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [renderWidget])

  return (
    <div>
      <div ref={containerRef} className="cf-turnstile" />
    </div>
  )
}
