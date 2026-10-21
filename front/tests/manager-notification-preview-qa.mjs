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
  const page = await browser.newPage(),
    errors = []
  page.on('pageerror', (error) => errors.push(error.message))
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
  let rows = [],
    previewCalls = 0,
    fail = false
  await page.route('**/api/**', (r) => {
    const url = new URL(r.request().url()),
      path = url.pathname
    let data = []
    if (path === '/api/customers/me') data = null
    if (path === '/api/managers/me')
      data = { id: 7, name: 'Manager', role: 'REGIONAL_ADMIN', regions: [] }
    if (path.endsWith('/unread-count')) data = { total: 3 }
    if (path === '/api/managers/me/notifications') {
      if (url.searchParams.get('size') === '5') previewCalls++
      if (fail)
        return r.fulfill({ status: 503, json: { success: false, message: 'Preview unavailable' } })
      data = { items: rows, page: 1, totalPages: 1, totalItems: rows.length }
    }
    return r.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const [path, width, history] of [
    ['/fac-list', 1280, '/admin-data/manager-notifications'],
    ['/admin-app/screen-9', 390, '/admin-app/notifications'],
  ]) {
    rows = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      title: `Notification ${i + 1}`,
      body: 'Preview content',
      category: 'EQUIPMENT',
      read: false,
      createdAt: '2026-10-21T12:00:00',
    }))
    previewCalls = 0
    await page.setViewportSize({ width, height: 844 })
    await page.goto(base + path)
    const bell = page.getByRole('button', { name: /관리자 알림/ })
    await bell.waitFor()
    assert.equal(previewCalls, 0, 'preview loads only when requested')
    await bell.click()
    const popup = page.getByRole('dialog', { name: '최근 알림', exact: true })
    await popup.locator('li').nth(4).waitFor()
    assert.equal(new URL(page.url()).pathname, path, 'bell opens a preview instead of navigating')
    assert.equal(await popup.locator('li').count(), 5)
    assert.equal(await popup.getByText('설비', { exact: true }).count(), 5)
    const box = await popup.boundingBox()
    assert(box.width <= 360 && box.height <= 420)
    assert(box.x >= 0 && box.x + box.width <= width)
    await page.keyboard.press('Escape')
    assert.equal(await popup.count(), 0)
    assert.equal(await bell.evaluate((el) => el === document.activeElement), true)
    await bell.click()
    await popup.locator('li').first().waitFor()
    rows.unshift({
      id: 99,
      title: 'Live notification',
      category: 'TASK',
      read: false,
      body: 'Live content',
      createdAt: '2026-10-21T12:01:00',
    })
    await page.evaluate(
      (data) =>
        window.streams
          .findLast((s) => !s.closed)
          .dispatchEvent(new MessageEvent('notification-new', { data: JSON.stringify(data) })),
      rows[0],
    )
    await popup.getByText('Live notification', { exact: true }).waitFor()
    assert.equal(await popup.locator('li').count(), 5)
    await page.mouse.click(2, 2)
    assert.equal(await popup.count(), 0, 'outside click closes preview')
    fail = true
    await bell.click()
    await popup.getByText('Preview unavailable', { exact: true }).waitFor()
    fail = false
    await popup.getByRole('button', { name: '다시 불러오기', exact: true }).click()
    await popup.locator('li').first().waitFor()
    await popup.getByRole('link', { name: '알림 내역 전체 보기 →', exact: true }).click()
    await page.waitForURL((url) => url.pathname === history)
    assert.equal(await popup.count(), 0)
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS manager web/app notification previews: lazy five-item list, 360x420 bounds, live SSE, outside/Escape close, retry and full-history navigation',
  )
} finally {
  await browser.close()
  await server.close()
}
