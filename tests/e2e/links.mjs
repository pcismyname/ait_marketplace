// Dead-link crawl: logs in as each demo role, follows every internal <a href>
// it finds (breadth first, up to MAX_PAGES per role), and fails on a 404, a
// Next.js "not found" page, an uncaught page error, or horizontal overflow at
// the current width. Run: node tests/e2e/links.mjs  (part of npm run test:e2e)

import { BASE, isMain, loginAs, runFlow } from './lib.mjs'

const ROLES = ['buyer', 'owner', 'seller', 'admin']
const MAX_PAGES = Number(process.env.E2E_CRAWL_MAX ?? 90)
const START = ['/', '/browse', '/needs', '/rentals', '/my-listings', '/chat', '/notifications', '/dashboard/orders',
  '/dashboard/wallet', '/dashboard/settings', '/how-it-works', '/sell']
const ADMIN_START = ['/admin/dashboard', '/admin/disputes', '/admin/listings', '/admin/users']
// Actions that sign out or change state when opened are not crawled.
const SKIP = [/^\/logout/, /^\/api\//]

/** Collapse ids so each route shape is visited a few times, not hundreds. */
function shape(pathname) {
  return pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
}

export async function main(flow, browser) {
  const failures = []
  let visited = 0
  for (const role of ROLES) {
    const page = await loginAs(browser, role)
    const queue = [...START, ...(role === 'admin' ? ADMIN_START : [])]
    const seen = new Set()
    const shapes = new Map()
    while (queue.length && seen.size < MAX_PAGES) {
      const href = queue.shift()
      if (seen.has(href)) continue
      const url = new URL(href, BASE)
      const key = shape(url.pathname)
      if ((shapes.get(key) ?? 0) >= 3) continue
      shapes.set(key, (shapes.get(key) ?? 0) + 1)
      seen.add(href)
      page.errors.length = 0
      let status = 0
      try {
        const res = await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        status = res?.status() ?? 0
        await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)
      } catch (error) {
        failures.push(`${role} ${href}: navigation failed (${error.message.split('\n')[0]})`)
        continue
      }
      visited++
      const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 4000)
      if (status === 404 || /This page could not be found|404: Not Found/i.test(body)) failures.push(`${role} ${href}: 404`)
      else if (status >= 500) failures.push(`${role} ${href}: HTTP ${status}`)
      for (const message of page.errors) failures.push(`${role} ${href}: page error "${message.slice(0, 160)}"`)
      const links = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') ?? ''))
      for (const link of links) {
        if (!link.startsWith('/') || link.startsWith('//')) continue
        if (SKIP.some((re) => re.test(link))) continue
        if (!seen.has(link)) queue.push(link.split('#')[0])
      }
    }
    await page.context().close()
    await flow.step(`${role}: crawled ${seen.size} internal links`, async () => {
      const mine = failures.filter((f) => f.startsWith(`${role} `))
      if (mine.length) throw new Error(mine.join(' | '))
      return `${shapes.size} route shapes`
    }).catch(() => undefined)
  }
  if (failures.length) throw new Error(`${failures.length} broken link(s)`)
  return visited
}

if (isMain(import.meta.url)) {
  const ok = await runFlow('links', main)
  process.exit(ok ? 0 : 1)
}
