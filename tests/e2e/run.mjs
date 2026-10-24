// Runs every end-to-end flow in order and writes tests/e2e/RESULTS.md.
//
//   npm run test:e2e                 all flows
//   npm run test:e2e -- rental late  only these
//
// Needs: the app running (E2E_BASE_URL, default http://localhost:3000) against
// the local Supabase stack, and demo accounts (npm run seed:demo). See lib.mjs.

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { BASE, OUT, ROOT, runFlow } from './lib.mjs'

const FLOWS = {
  seller: () => import('./seller.mjs'),
  buyer: () => import('./buyer.mjs'),
  rental: () => import('./rental.mjs'),
  late: () => import('./late.mjs'),
  links: () => import('./links.mjs'),
  quality: () => import('./quality.mjs'),
}
const DESCRIPTIONS = {
  seller: 'Seller: create listings with a photo; deposit rules (BusinessRules §3)',
  buyer: 'Buyer: in-person sale and protected sale with confirm receipt (§5)',
  rental: 'Owner + renter: request → approve → pay → handover → payout → return → release; dispute (repairable damage); 48 h auto-release (§4, §6)',
  late: 'Late and missing returns (§4)',
  links: 'Dead-link crawl as buyer, owner, seller and admin',
  quality: 'Core pages at 390 px and 1280 px: no horizontal overflow, basic accessibility',
}

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const names = wanted.length ? wanted : Object.keys(FLOWS)
const results = []
for (const name of names) {
  if (!FLOWS[name]) throw new Error(`Unknown flow "${name}" (have: ${Object.keys(FLOWS).join(', ')})`)
  const mod = await FLOWS[name]()
  await runFlow(name, mod.main)
  results.push(JSON.parse(readFileSync(path.join(OUT, `${name}.json`), 'utf8')))
}

const when = new Date()
const lines = [
  '# End-to-end results',
  '',
  `Run ${when.toISOString().slice(0, 16).replace('T', ' ')} UTC against ${BASE} (local Supabase, demo accounts from \`npm run seed:demo\`), headless Microsoft Edge via playwright-core.`,
  'Re-run with `npm run test:e2e` (setup notes at the top of [lib.mjs](lib.mjs)). Screenshots go to `tests/e2e/output/` (git-ignored).',
  '',
  '| Flow | Result | Steps |',
  '|---|---|---|',
  ...results.map((r) => `| ${DESCRIPTIONS[r.name] ?? r.name} | ${r.ok ? 'pass' : '**FAIL**'} | ${r.steps.filter((s) => s.ok).length}/${r.steps.length} |`),
  '',
]
for (const r of results) {
  lines.push(`## ${r.name} — ${r.ok ? 'pass' : 'FAIL'}`, '', '| # | Step | Result | Notes |', '|---|---|---|---|')
  r.steps.forEach((s, i) => lines.push(`| ${i + 1} | ${s.label.replaceAll('|', '\\|')} | ${s.ok ? 'pass' : '**fail**'} | ${(s.note || '').replaceAll('|', '\\|')} |`))
  if (r.error && !r.steps.some((s) => !s.ok)) lines.push('', `Error: ${r.error}`)
  lines.push('')
}
// Only a full run rewrites the committed results file.
const target = wanted.length ? path.join(OUT, 'RESULTS.partial.md') : path.join(ROOT, 'tests', 'e2e', 'RESULTS.md')
writeFileSync(target, lines.join('\n'))
console.log(`\nResults written to ${path.relative(ROOT, target)}`)
process.exit(results.every((r) => r.ok) ? 0 : 1)
