import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  base = server.resolvedUrls.local[0]
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    window.sources = []
    window.EventSource = class extends EventTarget {
      constructor() {
        super()
        window.sources.push(this)
      }
      close() {
        this.closed = true
      }
    }
  })
  await page.route('**/api/**', (r) => {
    const path = new URL(r.request().url()).pathname
    let data = []
    if (path === '/api/customers/me') data = null
    if (path === '/api/managers/me')
      data = {
        id: 1,
        name: '관리자',
        role: 'REGIONAL_ADMIN',
        regions: [{ id: 1, name: '부산광역시' }],
      }
    if (path.endsWith('/notifications/unread-count')) data = { total: 4 }
    if (path === '/api/plate-logs') data = { items: [], page: 1, totalItems: 0, totalPages: 1 }
    return r.fulfill({ json: { success: true, data } })
  })
  for (const path of [
    'admin-app/screen-9',
    'admin-app/screen-10',
    'admin-app/screen-11',
    'admin-app/screen-12',
    'admin-app/screen-14',
    'admin-app/ocr',
    'admin-app/reviews',
    'admin-app/transits',
    'admin-app/notifications',
  ]) {
    await page.goto(base + path)
    await page.locator('.manager-app-header').waitFor()
    assert.equal(await page.locator('.manager-app-header').count(), 1)
    assert.equal(await page.getByRole('button', { name: '이전 화면으로', exact: true }).count(), 1)
    assert.equal(
      await page.getByRole('link', { name: 'ROUTEL 관리자 앱 홈', exact: true }).count(),
      1,
    )
    assert.equal(await page.getByRole('button', { name: /관리자 알림/ }).count(), 1)
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    )
    const frame = await page.locator('.manager-app-shell').boundingBox()
    assert(frame.height <= 845)
    const navigation = page.locator('.admin-app-bottom-nav').first()
    if (await navigation.count()) {
      const box = await navigation.boundingBox()
      assert(box.y + box.height <= 845, 'bottom navigation remains in viewport: ' + path)
    }
  }
  await page.getByRole('button', { name: '관리자 앱 메뉴 열기' }).click()
  const drawer = page.getByRole('dialog', { name: '관리자 앱 페이지 메뉴' })
  await drawer.waitFor()
  assert.equal(await drawer.locator('nav a').count(), 12)
  await drawer.getByRole('link', { name: '점검 대상·알림', exact: true }).click()
  await page.waitForURL('**/admin-app/screen-11')
  assert.equal(await drawer.isVisible(), false)
  await page.getByRole('button', { name: '이전 화면으로', exact: true }).click()
  await page.waitForURL('**/admin-app/notifications')
  await page.getByRole('button', { name: /관리자 알림/ }).click()
  await page.getByRole('dialog', { name: '최근 알림', exact: true }).waitFor()
  assert(page.url().endsWith('/admin-app/notifications'))
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt')
    event.prompt = async () => {}
    event.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(event)
  })
  assert.equal(
    await page.getByRole('button', { name: '홈 화면에 앱 설치', exact: true }).count(),
    0,
  )
  await page.evaluate(() =>
    window.sources
      .filter((s) => !s.closed)
      .at(-1)
      .dispatchEvent(
        new MessageEvent('notification-new', {
          data: JSON.stringify({ id: 9, title: '알림', category: 'TASK' }),
        }),
      ),
  )
  await page.locator('.manager-app-bell-preview .header-alert-count').filter({ hasText: '4' }).waitFor()
  await page.getByRole('button', { name: '관리자 앱 메뉴 열기' }).click()
  await page.keyboard.press('Escape')
  assert.equal(await drawer.isVisible(), false)
  assert.deepEqual(errors, [])
  console.log(
    'PASS admin app header: all screens, centered back, logo/bell/unread, 12 menu destinations, navigation/close/Escape, install banner hidden, mobile height',
  )
} finally {
  await browser.close()
  await server.close()
}
