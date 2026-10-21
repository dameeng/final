import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  let manager = false
  const old = {
    id: 1,
    category: 'NOTICE',
    title: 'Existing notice',
    body: 'Old body',
    read: false,
    createdAt: '2026-10-21T10:00:00',
  }
  await page.addInitScript(() => {
    window.streams = []
    window.EventSource = class extends EventTarget {
      constructor() {
        super()
        window.streams.push(this)
      }
      close() {
        this.closed = true
      }
    }
  })
  await page.route('**/api/**', (r) => {
    const path = new URL(r.request().url()).pathname
    let data = []
    if (path === '/api/customers/me') data = manager ? null : { id: 1, name: 'Customer' }
    if (path === '/api/managers/me')
      data = manager ? { id: 2, name: 'Manager', role: 'REGIONAL_ADMIN', regions: [] } : null
    if (path.endsWith('/notifications'))
      data = { items: [old], page: 1, totalPages: 1, totalItems: 1 }
    if (path.endsWith('/unread-count')) data = { total: 1, byCategory: { NOTICE: 1 } }
    return r.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const [url, isManager] of [
    ['/my-alerts', false],
    ['/customer-app/screen-12', false],
    ['/admin-data/manager-notifications', true],
    ['/admin-app/notifications', true],
  ]) {
    manager = isManager
    await page.goto(base + url)
    await page.getByText('Existing notice', { exact: true }).first().waitFor()
    await page.waitForFunction(() => window.streams.some((source) => !source.closed))
    assert.equal(
      await page.locator('.notification-arrival-glow').count(),
      0,
      'initial unread history does not flash',
    )
    await page.clock.install()
    const incoming = {
      ...old,
      id: 101,
      title: 'New arrival',
      unread: { total: 2, byCategory: { NOTICE: 2 } },
    }
    const emit = async () =>
      page.evaluate((data) => {
        window.streams
          .findLast((source) => !source.closed)
          .dispatchEvent(new MessageEvent('notification-new', { data: JSON.stringify(data) }))
      }, incoming)
    await emit()
    const row = page
      .locator('.notification-arrival-glow')
      .filter({ hasText: 'New arrival' })
      .first()
    await row.waitFor()
    assert.equal(
      await row.evaluate((el) => getComputedStyle(el).animationName),
      'notification-arrival',
    )
    assert(
      (await page.locator('button.notification-arrival-glow,a.notification-arrival-glow').count()) >
        0,
      'bell also highlights',
    )
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await row.evaluate((el) => getComputedStyle(el).animationName), 'none')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.clock.fastForward(6100)
    assert.equal(await page.locator('.notification-arrival-glow').count(), 0)
    await emit()
    assert.equal(
      await page.locator('.notification-arrival-glow').count(),
      0,
      'duplicate delivery never restarts the effect',
    )
    await page.clock.resume()
  }
  console.log(
    'PASS new notification border/bell glow on customer/admin web/app, no initial/duplicate flash, 6-second expiry and reduced motion',
  )
} finally {
  await browser.close()
  await server.close()
}
