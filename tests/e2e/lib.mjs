// Shared helpers for the end-to-end flows in tests/e2e/.
//
// Runs against a running app (default http://localhost:3000, override with
// E2E_BASE_URL) that talks to the LOCAL Supabase stack, using the demo
// accounts from `npm run seed:demo`. Uses playwright-core with the installed
// Microsoft Edge (E2E_BROWSER_CHANNEL=chrome to use Chrome instead).
//
// Credentials, in order:
//   1. env vars E2E_<ROLE>_EMAIL and E2E_<ROLE>_PASSWORD (ROLE = OWNER, RENTER, BUYER, SELLER, ADMIN)
//   2. demo-accounts.local.md (git-ignored, written by npm run seed:demo)
// Passwords are never printed or written to RESULTS.md.
//
// Each flow creates its own fresh listings (titled "E2E …") so it never
// depends on, or disturbs, the seeded deals. Flows only use the API (publishable
// key, signed in as a demo user) for setup and for admin_time_travel shortcuts
// the UI exposes too; every user-facing step goes through the browser.

import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(path.join(ROOT, 'package.json'))
const { chromium } = require('playwright-core')
const { createClient } = require('@supabase/supabase-js')

export const BASE = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
export const HEADLESS = process.env.E2E_HEADED !== '1'
export const OUT = path.join(ROOT, 'tests', 'e2e', 'output')
mkdirSync(OUT, { recursive: true })

// ─── Environment ────────────────────────────────────────────────────────────

function readEnvFile(file) {
  if (!existsSync(file)) return {}
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
  )
}
const fileEnv = readEnvFile(path.join(ROOT, '.env.development.local'))
export const SUPABASE_URL = process.env.SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL
export const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? fileEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, or create .env.development.local (docs/Database.md §9).')
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(SUPABASE_URL) && process.env.E2E_ALLOW_REMOTE !== '1') {
  throw new Error(`Refusing to run against ${SUPABASE_URL}: the flows create deals and move (simulated) money. Use the local stack.`)
}

function loadCredentials() {
  const creds = {}
  const mdPath = path.join(ROOT, 'demo-accounts.local.md')
  if (existsSync(mdPath)) {
    for (const line of readFileSync(mdPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\| (\w+) \| (\S+@ait\.asia) \| `([^`]+)` \|/)
      if (m) creds[m[1]] = { email: m[2], password: m[3] }
    }
  }
  for (const role of ['owner', 'renter', 'buyer', 'seller', 'admin']) {
    const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`]
    const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`]
    if (email && password) creds[role] = { email, password }
  }
  return creds
}
export const CREDS = loadCredentials()

export function cred(role) {
  const c = CREDS[role]
  if (!c) throw new Error(`No credentials for "${role}": run npm run seed:demo or set E2E_${role.toUpperCase()}_EMAIL/_PASSWORD.`)
  return c
}

// ─── Results ────────────────────────────────────────────────────────────────

/** Collects pass/fail per step for one flow. */
export class Flow {
  constructor(name) {
    this.name = name
    this.steps = []
    this.startedAt = new Date()
  }

  /** Run one step; a failure is recorded and re-thrown (later steps depend on it). */
  async step(label, fn) {
    const started = Date.now()
    try {
      const note = await fn()
      this.steps.push({ label, ok: true, ms: Date.now() - started, note: typeof note === 'string' ? note : '' })
      console.log(`  ✓ ${label}${typeof note === 'string' && note ? ` — ${note}` : ''}`)
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).split('\n')[0].slice(0, 300)
      this.steps.push({ label, ok: false, ms: Date.now() - started, note: message })
      console.log(`  ✗ ${label} — ${message}`)
      throw error
    }
  }

  get ok() {
    return this.steps.length > 0 && this.steps.every((s) => s.ok)
  }
}

/** Write tests/e2e/output/<name>.json (RESULTS.md is assembled by run.mjs). */
export function saveFlow(flow, extra = {}) {
  const file = path.join(OUT, `${flow.name}.json`)
  writeFileSync(
    file,
    JSON.stringify({ name: flow.name, ok: flow.ok, startedAt: flow.startedAt.toISOString(), steps: flow.steps, ...extra }, null, 2),
  )
}

// ─── Supabase (setup and admin shortcuts only) ──────────────────────────────

const apiCache = new Map()
/** A supabase-js client signed in as a demo role (publishable key; RLS applies). */
export async function apiAs(role) {
  if (apiCache.has(role)) return apiCache.get(role)
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword(cred(role))
  if (error) throw new Error(`API sign-in as ${role}: ${error.message}`)
  const entry = { client, userId: data.user.id }
  apiCache.set(role, entry)
  return entry
}

export async function rpc(role, fn, args = {}) {
  const { client } = await apiAs(role)
  const { data, error } = await client.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data
}

export async function selectOne(role, table, id) {
  const { client } = await apiAs(role)
  const { data, error } = await client.from(table).select('*').eq('id', id).single()
  if (error) throw new Error(`${table} ${id}: ${error.message}`)
  return data
}

/** Insert a fresh listing owned by `role` (the listing guard still applies). */
export async function createListing(role, fields) {
  const { client, userId } = await apiAs(role)
  const row = {
    seller_id: userId,
    title: `E2E ${fields.title} ${stamp()}`,
    description: 'Created by the end-to-end tests (tests/e2e).',
    category: 'other',
    condition: 'good',
    pickup_location: 'Dorm A Lobby',
    images: [],
    status: 'available',
    ...fields,
    ...(fields.title ? { title: `E2E ${fields.title} ${stamp()}` } : {}),
  }
  const { data, error } = await client.from('listings').insert(row).select('*').single()
  if (error) throw new Error(`create listing: ${error.message}`)
  return data
}

/** Sum of a user's wallet bucket (RLS: own rows). */
export async function walletBalance(role, bucket = 'available') {
  const { client, userId } = await apiAs(role)
  const { data, error } = await client.from('wallet_ledger').select('amount').eq('user_id', userId).eq('bucket', bucket)
  if (error) throw new Error(`wallet: ${error.message}`)
  return data.reduce((sum, r) => sum + Number(r.amount), 0)
}

export const stamp = () => new Date().toISOString().slice(5, 19).replace(/[-:T]/g, '')

// ─── Browser ────────────────────────────────────────────────────────────────

export async function launch() {
  return chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL ?? 'msedge', headless: HEADLESS })
}

/** A new browser context logged in through the real /login page. */
export async function loginAs(browser, role, { width = 1280, height = 900 } = {}) {
  const context = await browser.newContext({ baseURL: BASE, viewport: { width, height } })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  const { email, password } = cred(role)
  await page.goto('/login')
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)
  await page.locator('button[type=submit]').click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  return page
}

/** Text of the newest toast (sonner). */
export async function toastText(page, { timeout = 20_000 } = {}) {
  const t = page.locator('[data-sonner-toast]').last()
  await t.waitFor({ timeout })
  return (await t.innerText()).replace(/\s+/g, ' ').trim()
}

/** Wait for a toast containing `text` (string or RegExp). */
export async function expectToast(page, text, { timeout = 20_000 } = {}) {
  const re = text instanceof RegExp ? text : new RegExp(escapeRe(text), 'i')
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: re }).last()
  await toast.waitFor({ timeout })
  return (await toast.innerText()).replace(/\s+/g, ' ').trim()
}

export async function expectText(page, text, { timeout = 20_000 } = {}) {
  const re = text instanceof RegExp ? text : new RegExp(escapeRe(text), 'i')
  await page.getByText(re).first().waitFor({ timeout })
}

export async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return path.relative(ROOT, file).replaceAll('\\', '/')
}

/** Poll a value until `ok(value)` or time out. */
export async function waitFor(fn, ok, { timeout = 30_000, every = 750, what = 'condition' } = {}) {
  const until = Date.now() + timeout
  let last
  while (Date.now() < until) {
    last = await fn()
    if (ok(last)) return last
    await new Promise((r) => setTimeout(r, every))
  }
  throw new Error(`Timed out waiting for ${what} (last: ${JSON.stringify(last)})`)
}

/** Pick an option in a base-ui Select by its trigger's aria-label. */
export async function choose(page, triggerLabel, optionText) {
  await page.locator(`[aria-label="${triggerLabel}"]`).first().click()
  await page.getByRole('option', { name: optionText, exact: true }).first().click()
}

/** A small, valid PNG (decodable by createImageBitmap) for photo uploads. */
export function photoFile(name = 'condition.png', rgb = [46, 125, 50]) {
  const file = path.join(OUT, name)
  if (!existsSync(file)) writeFileSync(file, solidPng(32, 24, rgb))
  return file
}

function solidPng(width, height, [r, g, b]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(zlib.crc32(body) >>> 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())])
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Upload photos in an open dialog / form and wait for the tiles. */
export async function addPhotos(page, scope, count = 1) {
  const input = scope.locator('input[type=file]').first()
  const files = Array.from({ length: count }, (_, i) => photoFile(`condition-${i}.png`, [40 + i * 60, 125, 50]))
  await input.setInputFiles(files)
}

export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Horizontal overflow check for the current page. */
export async function overflow(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
}

/** Run a flow file's main(): prints, saves JSON, exits non-zero on failure. */
export async function runFlow(name, main) {
  const flow = new Flow(name)
  console.log(`\n▶ ${name}`)
  let browser
  let error
  try {
    browser = await launch()
    await main(flow, browser)
  } catch (e) {
    error = e
  } finally {
    await browser?.close().catch(() => undefined)
  }
  saveFlow(flow, error ? { error: String(error?.message ?? error).split('\n')[0] } : {})
  console.log(flow.ok && !error ? `✔ ${name} passed` : `✘ ${name} failed`)
  return flow.ok && !error
}

export const isMain = (metaUrl) => process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(metaUrl)
