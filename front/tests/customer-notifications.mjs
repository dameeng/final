import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [],
    calls = []
  let rows = [
    {
      id: 7,
      category: 'RISK',
      title: '지하차도 위험 안내',
      body: '강수량이 증가했습니다. 통제 현황을 확인하세요.',
      read: false,
      createdAt: '2026-10-20 12:00',
    },
    {
      id: 8,
      category: 'NOTICE',
      title: '정기 점검 공지',
      body: '점검 일정을 확인해 주세요.',
      read: false,
      createdAt: '2026-10-20 11:00',
    },
    {
      id: 9,
      category: 'INQUIRY',
      title: '문의 답변 등록',
      body: '문의에 답변이 등록되었습니다.',
      read: false,
      createdAt: '2026-10-20 10:00',
    },
  ]
  await page.addInitScript(() => {
    class FakeNotification {
      static permission = localStorage.getItem('test-notification-permission') || 'default'
      static async requestPermission() {
        this.permission = 'granted'
        localStorage.setItem('test-notification-permission', 'granted')
        return 'granted'
      }
      constructor() {}
      close() {}
    }
    Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true })
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/**', (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method()
    calls.push({ path, method })
    let data = null
    if (path === '/api/customers/me')
      data = { id: 11, name: '고객', loginId: 'test_customer', phone: '01012345678' }
    if (path === '/api/customers/me/device-tokens')
      data = [{ id: 1, platform: 'APP', active: true }]
    if (path === '/api/customers/me/cars') data = []
    if (path === '/api/customers/me/notifications') {
      let selected = rows
      if (url.searchParams.get('category'))
        selected = selected.filter((row) => row.category === url.searchParams.get('category'))
      if (url.searchParams.get('unreadOnly') === 'true')
        selected = selected.filter((row) => !row.read)
      data = {
        items: selected.slice(0, Number(url.searchParams.get('size') || 20)),
        page: 1,
        totalPages: 1,
        totalItems: selected.length,
      }
    }
    if (path === '/api/customers/me/notifications/unread-count')
      data = {
        total: rows.filter((row) => !row.read).length,
        byCategory: Object.fromEntries(
          ['RISK', 'NOTICE', 'INQUIRY'].map((category) => [
            category,
            rows.filter((row) => !row.read && row.category === category).length,
          ]),
        ),
      }
    if (path.endsWith('/read') && method === 'PUT') {
      const id = Number(path.split('/').at(-2))
      rows = rows.map((row) => (row.id === id ? { ...row, read: true } : row))
    }
    if (path.endsWith('/read-all') && method === 'PUT')
      rows = rows.map((row) =>
        !url.searchParams.get('category') || row.category === url.searchParams.get('category')
          ? { ...row, read: true }
          : row,
      )
    return route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  await page.goto(base + '/my-home')
  await page.locator('#account-cars').waitFor()
  assert.equal(
    await page.getByRole('heading', { name: '등록된 알림 기기', exact: true }).count(),
    0,
  )
  const bell = page.locator('.notification-bell button')
  await bell.getByText('3', { exact: true }).waitFor()
  await bell.click()
  const popup = page.locator('#customer-notification-popup')
  await popup.getByText('지하차도 위험 안내', { exact: true }).waitFor()
  assert.equal(new URL(page.url()).pathname, '/my-home')
  await page.keyboard.press('Escape')
  assert.equal(await popup.count(), 0)
  assert(await bell.evaluate((el) => el === document.activeElement))
  await bell.click()
  await popup.waitFor()
  await page.locator('.account-service>h1').click()
  assert.equal(await popup.count(), 0)
  await bell.click()
  await popup.getByRole('link', { name: /지하차도 위험 안내/ }).click()
  await page.waitForURL(
    (url) => url.pathname === '/my-alerts' && url.searchParams.get('notification') === '7',
  )
  await page.locator('.notification-center-body').filter({ hasText: '강수량이 증가' }).waitFor()
  assert(
    calls.some((c) => c.path === '/api/customers/me/notifications/7/read' && c.method === 'PUT'),
  )
  await page.getByRole('heading', { name: '알림 수신 설정', exact: true }).waitFor()
  await page.getByText('알림 수신 중', { exact: true }).waitFor()
  const toggle = page.getByRole('switch', { name: '이 브라우저 알림', exact: true })
  assert.equal(await toggle.getAttribute('aria-checked'), 'false')
  await toggle.click()
  assert.equal(await toggle.getAttribute('aria-checked'), 'true')
  assert.equal(await page.evaluate(() => localStorage.getItem('routel-browser-alerts:11')), '1')
  await page.reload()
  await toggle.waitFor()
  assert.equal(await toggle.getAttribute('aria-checked'), 'true')
  await toggle.click()
  assert.equal(await toggle.getAttribute('aria-checked'), 'false')
  await page
    .getByRole('navigation', { name: '알림 분류' })
    .getByRole('button', { name: /공지/ })
    .click()
  await page.waitForFunction(
    () => document.querySelectorAll('.notification-center-item').length === 1,
  )
  assert((await page.locator('.notification-center-list').innerText()).includes('정기 점검 공지'))
  await page.getByRole('button', { name: '모두 읽음', exact: true }).click()
  await page.getByLabel('안 읽은 알림만', { exact: true }).check()
  await page.getByText('안 읽은 알림이 없습니다.', { exact: true }).waitFor()
  await page.getByLabel('안 읽은 알림만', { exact: true }).uncheck()
  for (const [width, height] of [
    [1440, 1000],
    [1280, 800],
    [390, 844],
    [360, 640],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height })
    await bell.click()
    await popup.waitFor()
    const rect = await popup.boundingBox()
    assert(rect.x >= 0 && rect.x + rect.width <= width + 1)
    assert(rect.y >= 0 && rect.y + rect.height <= height + 1)
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    )
    await popup.getByRole('button', { name: '알림 창 닫기', exact: true }).click()
  }
  await page.goto(base + '/customer-app/screen-12')
  await page.locator('.notification-settings-details>summary').click()
  await page.getByRole('heading', { name: '알림 수신 설정', exact: true }).waitFor()
  assert.equal(await page.locator('.notification-center-list').count(), 1)
  assert.deepEqual(errors, [])
  console.log(
    'PASS settings moved, bell dropdown, outside/Escape close, history navigation/read, browser preference, category/read-all and mobile layout',
  )
} finally {
  await browser?.close()
  await server.close()
}
