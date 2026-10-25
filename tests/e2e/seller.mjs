// Seller flow: create listings through /sell with a real photo upload, and
// check the deposit rules (BusinessRules §3: ฿200–฿3,000, 30–50% of the
// replacement value) before a rental listing can be published.

import { addPhotos, apiAs, choose, expectText, expectToast, isMain, loginAs, runFlow, shot, stamp, waitFor } from './lib.mjs'

export async function main(flow, browser) {
  const page = await loginAs(browser, 'seller')
  const { client } = await apiAs('seller')
  const rentTitle = `E2E desk lamp for rent ${stamp()}`
  const saleTitle = `E2E textbook for sale ${stamp()}`
  const created = []

  try {
    await flow.step('open /sell and choose "For rent"', async () => {
      await page.goto('/sell')
      await page.getByRole('button', { name: /For rent/ }).click()
      await page.locator('#deposit').waitFor()
    })

    await flow.step('upload a photo (validated and stored in listing-photos)', async () => {
      await addPhotos(page, page.locator('form'), 1)
      await page.locator('[data-testid=photo-tile]').first().waitFor()
      await waitFor(
        () => page.getByRole('button', { name: 'Publish listing' }).isEnabled(),
        (enabled) => enabled,
        { what: 'photo upload to finish' },
      )
    })

    await flow.step('fill title, description, category, condition, price, period, pickup', async () => {
      await page.locator('#title').fill(rentTitle)
      await page.locator('#description').fill('Adjustable LED desk lamp, three brightness levels. E2E test listing.')
      await choose(page, 'Category', 'Electronics')
      await choose(page, 'Condition', 'Good')
      await page.locator('#price').fill('150')
      await choose(page, 'Rental period', 'Per month')
      await choose(page, 'Pickup location', 'AIT Library')
    })

    await flow.step('deposit below ฿200 is refused', async () => {
      await page.locator('#deposit').fill('150')
      await page.locator('#deposit-error').waitFor()
      return (await page.locator('#deposit-error').innerText()).trim()
    })

    await flow.step('deposit above ฿3,000 is refused', async () => {
      await page.locator('#deposit').fill('3500')
      await page.locator('#deposit-error').waitFor()
      return (await page.locator('#deposit-error').innerText()).trim()
    })

    await flow.step('deposit outside 30–50% of a ฿2,000 replacement value is refused', async () => {
      await page.locator('#replacement-value').fill('2000')
      await page.locator('#deposit').fill('400')
      await page.locator('#deposit-error').waitFor()
      return (await page.locator('#deposit-error').innerText()).trim()
    })

    await flow.step('a ฿800 deposit (40%) is accepted', async () => {
      await page.locator('#deposit').fill('800')
      await page.locator('#deposit-error').waitFor({ state: 'detached', timeout: 5_000 })
    })

    await flow.step('publish → redirected to My Listings with a success toast', async () => {
      await page.getByRole('button', { name: 'Publish listing' }).click()
      await expectToast(page, /listing is live/i)
      await page.waitForURL(/\/my-listings/)
      await expectText(page, rentTitle)
    })

    await flow.step('database row matches the form (deposit, replacement value, photo, period)', async () => {
      const { data, error } = await client.from('listings').select('*').eq('title', rentTitle).single()
      if (error) throw new Error(error.message)
      created.push(data.id)
      const problems = []
      if (data.type !== 'rent') problems.push(`type ${data.type}`)
      if (Number(data.deposit) !== 800) problems.push(`deposit ${data.deposit}`)
      if (Number(data.replacement_value) !== 2000) problems.push(`replacement ${data.replacement_value}`)
      if (data.rental_period !== 'per month') problems.push(`period ${data.rental_period}`)
      if (data.images?.length !== 1) problems.push(`images ${data.images?.length}`)
      if (data.featured) problems.push('featured without paying')
      if (problems.length) throw new Error(problems.join(', '))
      const res = await fetch(data.images[0])
      if (!res.ok) throw new Error(`photo URL ${res.status}`)
      return `฿${data.price} ${data.rental_period}, deposit ฿${data.deposit}, photo ${res.headers.get('content-type')}`
    })

    await flow.step('the listing page shows the deposit and the rental quote', async () => {
      await page.goto(`/listing/${created[0]}`)
      await expectText(page, rentTitle)
      await expectText(page, /Refundable deposit/i)
      await shot(page, 'seller-rent-listing')
    })

    await flow.step('create a sale listing with a photo (no deposit field)', async () => {
      await page.goto(`/sell`)
      await page.getByRole('button', { name: /For sale/ }).click()
      if (await page.locator('#deposit').count()) throw new Error('sale form shows a deposit field')
      await addPhotos(page, page.locator('form'), 1)
      await page.locator('[data-testid=photo-tile]').first().waitFor()
      await page.locator('#title').fill(saleTitle)
      await page.locator('#description').fill('Engineering mathematics, 10th edition. E2E test listing.')
      await choose(page, 'Category', 'Textbooks')
      await choose(page, 'Condition', 'Like new')
      await page.locator('#price').fill('450')
      await choose(page, 'Pickup location', 'Dorm B Lobby')
      await waitFor(() => page.getByRole('button', { name: 'Publish listing' }).isEnabled(), Boolean, { what: 'upload' })
      await page.getByRole('button', { name: 'Publish listing' }).click()
      await expectToast(page, /listing is live/i)
      await page.waitForURL(/\/my-listings/)
      const { data } = await client.from('listings').select('id, type, deposit, images, price').eq('title', saleTitle).single()
      created.push(data.id)
      if (data.type !== 'sale' || data.deposit !== null || data.images.length !== 1 || Number(data.price) !== 450) {
        throw new Error(`unexpected row ${JSON.stringify(data)}`)
      }
      return `sale ฿${data.price}`
    })

    await flow.step('fractional prices are refused (whole baht only)', async () => {
      await page.goto(`/sell`)
      await page.getByRole('button', { name: /For sale/ }).click()
      await page.locator('#price').fill('150.75')
      await page.getByRole('button', { name: 'Publish listing' }).click()
      await expectText(page, /whole baht|whole number/i, { timeout: 5_000 })
    })
  } finally {
    // Leave nothing behind: the listings have no deals, so the seller can delete them.
    if (created.length) await client.from('listings').delete().in('id', created)
  }
}

if (isMain(import.meta.url)) {
  const ok = await runFlow('seller', main)
  process.exit(ok ? 0 : 1)
}
