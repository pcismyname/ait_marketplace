// Quality pass (action_items P0 2.10) on the core flow pages, as the role that
// would see each one, at phone (390 × 844) and desktop (1280 × 900) width:
//   - full-page screenshot to tests/e2e/output/quality/<width>/<page>.png
//   - no horizontal overflow (document scrollWidth ≤ clientWidth)
//   - basic accessibility: every visible form control has a label, every
//     <img> has alt text, every button and link has an accessible name, and
//     keyboard focus is visible on the first focusable elements.
// Run: node tests/e2e/quality.mjs (part of npm run test:e2e)

import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { apiAs, isMain, loginAs, OUT, runFlow } from './lib.mjs'

const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
]

async function firstId(role, table, filter) {
  const { client } = await apiAs(role)
  let q = client.from(table).select('id')
  for (const [k, v] of Object.entries(filter)) q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v)
  const { data } = await q.order('created_at', { ascending: false }).limit(1)
  return data?.[0]?.id
}

async function pages() {
  const { userId: ownerId } = await apiAs('owner')
  const { userId: sellerId } = await apiAs('seller')
  const rentListing = await firstId('owner', 'listings', { seller_id: ownerId, type: 'rent', status: 'available' })
  const saleListing = await firstId('seller', 'listings', { seller_id: sellerId, type: 'sale', status: 'available' })
  const approved = await firstId('renter', 'rentals', { phase: 'approved' })
  const approvedListing = approved ? (await apiAs('renter')).client.from('rentals').select('listing_id').eq('id', approved).single() : null
  const activeRental = await firstId('renter', 'rentals', { phase: ['active', 'overdue', 'return-pending'] })
  const handedOver = await firstId('buyer', 'transactions', { status: 'handed-over' })
  const dispute = await firstId('admin', 'disputes', { status: 'open' })
  const requestedListing = await firstId('owner', 'rentals', { phase: 'requested' }).then(async (id) => {
    if (!id) return rentListing
    const { data } = await (await apiAs('owner')).client.from('rentals').select('listing_id').eq('id', id).single()
    return data.listing_id
  })
  const list = [
    { name: 'login', role: null, url: '/login' },
    { name: 'signup', role: null, url: '/signup' },
    { name: 'home', role: 'buyer', url: '/' },
    { name: 'browse', role: 'buyer', url: '/browse' },
    { name: 'listing-sale', role: 'buyer', url: `/listing/${saleListing}` },
    { name: 'listing-rent', role: 'renter', url: `/listing/${rentListing}` },
    { name: 'checkout-sale', role: 'buyer', url: `/listing/${saleListing}/checkout` },
    { name: 'sell', role: 'seller', url: '/sell' },
    { name: 'my-listings', role: 'seller', url: '/my-listings' },
    { name: 'listing-requests', role: 'owner', url: `/dashboard/listings/${requestedListing}/requests` },
    { name: 'rentals-renting', role: 'renter', url: '/rentals?view=renting' },
    { name: 'rentals-lending', role: 'owner', url: '/rentals?view=lending' },
    { name: 'orders', role: 'buyer', url: '/dashboard/orders' },
    { name: 'wallet', role: 'renter', url: '/dashboard/wallet' },
    { name: 'notifications', role: 'owner', url: '/notifications' },
    { name: 'chat', role: 'buyer', url: '/chat' },
    { name: 'needs', role: 'renter', url: '/needs' },
    { name: 'profile', role: 'buyer', url: `/profile/${sellerId}` },
    { name: 'admin-dashboard', role: 'admin', url: '/admin/dashboard' },
    { name: 'admin-disputes', role: 'admin', url: '/admin/disputes' },
    { name: 'admin-listings', role: 'admin', url: '/admin/listings' },
  ]
  if (approvedListing) {
    const { data } = await approvedListing
    list.push({ name: 'checkout-rent', role: 'renter', url: `/listing/${data.listing_id}/checkout?rental=${approved}` })
  }
  if (activeRental) list.push({ name: 'transaction-rental', role: 'renter', url: `/transaction/${activeRental}` })
  if (handedOver) {
    list.push({ name: 'transaction-sale', role: 'buyer', url: `/transaction/${handedOver}` })
    list.push({ name: 'confirm-receipt', role: 'buyer', url: `/transaction/${handedOver}/confirm` })
  }
  if (dispute) {
    list.push({ name: 'dispute', role: 'admin', url: `/dispute/${dispute}` })
    list.push({ name: 'admin-dispute', role: 'admin', url: `/admin/disputes/${dispute}` })
  }
  return list
}

/** Runs in the page: basic accessibility findings. */
function audit() {
  const visible = (el) => {
    // Hidden from assistive tech on purpose (decorative overlays, base-ui's
    // hidden form inputs that mirror a labelled Select trigger).
    if (el.closest('[aria-hidden="true"]') || el.getAttribute('aria-hidden') === 'true') return false
    if (/-hidden-input$/.test(el.id)) return false
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
  }
  const name = (el) =>
    (el.getAttribute('aria-label') || '').trim() ||
    (el.getAttribute('aria-labelledby') ? 'labelledby' : '') ||
    (el.getAttribute('title') || '').trim() ||
    (el.innerText || '').trim() ||
    (el.querySelector('img[alt]:not([alt=""]), svg[aria-label]') ? 'img' : '')
  const where = (el) => {
    const id = el.id ? `#${el.id}` : ''
    const t = el.getAttribute('data-testid') ? `[data-testid=${el.getAttribute('data-testid')}]` : ''
    return `${el.tagName.toLowerCase()}${id}${t}${el.getAttribute('type') ? `[type=${el.getAttribute('type')}]` : ''}`
  }
  const issues = []
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (el.type === 'hidden' || !visible(el)) continue
    const labelled = (el.labels && el.labels.length > 0) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')
    if (!labelled) issues.push(`control without a label: ${where(el)}${el.placeholder ? ` (placeholder "${el.placeholder}")` : ''}`)
  }
  for (const el of document.querySelectorAll('img')) {
    if (!el.hasAttribute('alt')) issues.push(`img without alt: ${el.getAttribute('src')?.slice(0, 60)}`)
  }
  for (const el of document.querySelectorAll('button, [role=button], a[href]')) {
    if (!visible(el)) continue
    if (!name(el)) issues.push(`${el.tagName.toLowerCase()} without an accessible name: ${el.outerHTML.slice(0, 90)}`)
  }
  for (const el of document.querySelectorAll('[role=button]')) {
    if (el.tagName !== 'BUTTON' && el.tabIndex < 0 && visible(el)) issues.push(`role=button not focusable: ${where(el)}`)
  }
  return [...new Set(issues)]
}

export async function main(flow, browser) {
  const list = await pages()
  const failures = []
  for (const size of WIDTHS) {
    const dir = path.join(OUT, 'quality', size.name)
    mkdirSync(dir, { recursive: true })
    const sessions = new Map()
    const pageFor = async (role) => {
      if (sessions.has(role)) return sessions.get(role)
      let page
      if (role) page = await loginAs(browser, role, size)
      else {
        const context = await browser.newContext({ baseURL: (await import('./lib.mjs')).BASE, viewport: size })
        page = await context.newPage()
        page.errors = []
        page.on('pageerror', (e) => page.errors.push(e.message))
      }
      sessions.set(role, page)
      return page
    }
    for (const p of list) {
      const page = await pageFor(p.role)
      page.errors.length = 0
      await page.goto(p.url)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)
      await page.waitForTimeout(400)
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      await page.screenshot({ path: path.join(dir, `${p.name}.png`), fullPage: true })
      const issues = await page.evaluate(audit)
      const problems = []
      if (scrollWidth > clientWidth) problems.push(`horizontal overflow ${scrollWidth}px > ${clientWidth}px`)
      for (const e of page.errors) problems.push(`page error: ${e.slice(0, 120)}`)
      problems.push(...issues)
      await flow
        .step(`${size.width}px ${p.name} (${p.url.replace(/[0-9a-f-]{36}/g, ':id')})`, async () => {
          if (problems.length) throw new Error(problems.join(' · '))
          return `scrollWidth ${scrollWidth} = clientWidth ${clientWidth}`
        })
        .catch(() => failures.push(p.name))
    }
    // Keyboard focus is visible on the first few focusable elements of the browse page.
    const page = await pageFor('buyer')
    await page.goto('/browse')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)
    await flow
      .step(`${size.width}px keyboard focus is visible (browse, first 6 tab stops)`, async () => {
        const missing = []
        for (let i = 0; i < 6; i++) {
          await page.keyboard.press('Tab')
          const info = await page.evaluate(() => {
            const el = document.activeElement
            if (!el || el === document.body) return null
            const s = getComputedStyle(el)
            const shown = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none')
            return { shown, what: `${el.tagName.toLowerCase()} ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}` }
          })
          if (info && !info.shown) missing.push(info.what)
        }
        if (missing.length) throw new Error(`no visible focus on: ${missing.join(', ')}`)
      })
      .catch(() => failures.push('focus'))
    for (const s of sessions.values()) await s.context().close()
  }
  if (failures.length) throw new Error(`${failures.length} page check(s) failed`)
}

if (isMain(import.meta.url)) {
  const ok = await runFlow('quality', main)
  process.exit(ok ? 0 : 1)
}
