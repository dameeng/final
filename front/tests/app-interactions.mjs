import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const errors = [], calls = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    class Map {
      constructor(host, options) { this.center = options.center; this.level = options.level }
      getCenter() { return this.center } setCenter(p) { this.center = p } panTo(p) { this.center = p }
      setLevel(v) { this.level = v } getLevel() { return this.level }
      setBounds() {} relayout() {} setZoomable() {}
      getBounds() { return { contain: () => true, getSouthWest: () => new LatLng(35,129), getNorthEast: () => new LatLng(36,130) } }
      getProjection() { return { containerPointFromCoords: () => ({ x: 100, y: 100 }) } }
    }
    class Shape { setMap() {} close() {} setContent() {} setPosition() {} }
    class LatLng { constructor(lat, lng) { this.lat = lat; this.lng = lng } getLat() { return this.lat } getLng() { return this.lng } }
    class Bounds { extend() {} }
    class Cluster { clear() {} addMarkers() {} redraw() {} }
    window.kakao = { maps: { Map, LatLng, LatLngBounds: Bounds, Marker: Shape, MarkerImage: Shape, MarkerClusterer: Cluster, InfoWindow: Shape, Size: Shape, Point: Shape, event: { addListener() {}, removeListener() {} }, load: fn => fn() } }
  })
  let manager = false, unread = 2
  const notifications = Array.from({ length: 110 }, (_, i) => ({ id: i + 1, title: `안전 알림 ${i + 1}`, body: `알림 본문 ${i + 1}\n상세 안내 내용입니다.`, category: 'RISK', read: false, createdAt: '2026-10-28T12:00:00', refType: 'UNDERPASS', refId: 1 }))
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname
    calls.push({ path, method: route.request().method(), page: url.searchParams.get('page') })
    let data = null
    if (path === '/api/customers/me' && !manager) data = { id: 1, name: '테스트 고객', role: 'customer' }
    if (path === '/api/managers/me' && manager) data = { id: 2, name: '테스트 관리자', role: 'REGIONAL_ADMIN', regions: [{ id: 3, name: '동구' }] }
    if (path === '/api/regions') data = [{ id: 3, name: '동구' }]
    if (path === '/api/underpasses') data = { items: Array.from({ length: 32 }, (_, i) => ({ id: i + 1, name: `초량 시설 ${i + 1}`, latitude: 35.1, longitude: 129.1, roadAddress: '부산광역시 동구', currentStatus: 'NORMAL', currentRiskLevel: 'SAFE' })), totalPages: 1, totalItems: 32, page: 1 }
    if (path.endsWith('/notifications')) {
      const p = Number(url.searchParams.get('page') || 1), size = Number(url.searchParams.get('size') || 10)
      data = { items: notifications.slice((p - 1) * size, p * size), page: p, totalItems: notifications.length, totalPages: Math.ceil(notifications.length / size) }
    }
    if (path.endsWith('/unread-count')) data = { total: unread, byCategory: { RISK: unread } }
    if (path.endsWith('/read-all')) { unread = 0; notifications.forEach(row => { row.read = true }) }
    return route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  await page.goto(base + '/customer-app/screen-5')
  const handle = page.locator('.mobile-sheet-handle'), map = page.locator('.mobile-app-map .mapw')
  await expect(handle).toBeVisible()
  await handle.click()
  await expect(map).toBeHidden()
  await expect(page.getByRole('searchbox', { name: '지하차도 이름 검색' })).toBeVisible()
  await expect(page.locator('.facility-list-panel .it')).toHaveCount(5)
  await page.getByRole('button', { name: '2페이지', exact: true }).click()
  await expect(page.locator('.facility-list-panel .it').first()).toContainText('초량 시설 6')
  await expect.poll(() => page.locator('.app-map-sheet').evaluate(el => Math.abs(el.getBoundingClientRect().height - (el.closest('.mobile-app-map').clientHeight - 74)))).toBeLessThan(2)
  const rect = await handle.boundingBox()
  await page.mouse.move(rect.x + 50, rect.y + 25); await page.mouse.down()
  await page.mouse.move(rect.x + 50, rect.y + 110, { steps: 8 }); await page.mouse.up()
  await expect(handle).toHaveAttribute('aria-expanded', 'false')
  await expect(map).toBeVisible()
  for (const mode of ['customer', 'manager']) {
    manager = mode === 'manager'; unread = 2
    notifications.forEach(row => { row.read = false })
    const history = manager ? '/admin-app/notifications' : '/customer-app/screen-12'
    await page.goto(base + history)
    const bell = page.locator('.notification-bell button.header-alert-link').first()
    await bell.click()
    const popup = page.getByRole('dialog', { name: '최근 알림' })
    await expect(popup.locator('li a').first()).toBeVisible()
    assert(await popup.locator('li a').first().evaluate(el=>el.getBoundingClientRect().height<100),'Preview notifications use compact rows')
    assert(await popup.locator('.notification-read-all').evaluate(el=>el.scrollWidth<=el.clientWidth),'Read-all label fits the button')
    await popup.getByRole('button', { name: '모두 읽음', exact: true }).click()
    await expect.poll(() => calls.filter(call => call.path === `/api/${manager ? 'managers' : 'customers'}/me/notifications/read-all` && call.method === 'PUT').length).toBeGreaterThan(0)
    await popup.locator('li a').first().click()
    await expect(page).toHaveURL(new RegExp(history + '\\?notification=1'))
    await expect(page.locator('.notification-detail-view h1')).toHaveText('안전 알림 1')
    await expect(page.locator('.notification-detail-body')).toContainText('상세 안내 내용입니다.')
    await expect(page.getByRole('link', { name: '관련 내용 확인' })).toBeVisible()
    const relatedColors=await page.getByRole('link',{name:'관련 내용 확인'}).evaluate(el=>({text:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}))
    assert.notEqual(relatedColors.text,relatedColors.background,'Related content button text contrasts with its background')
    assert(await page.locator('.notification-detail-card').evaluate(el=>el.getBoundingClientRect().height>=340),'Detail content has sufficient room')
    await expect(page.getByRole('button',{name:'이전 알림',exact:false})).toBeDisabled()
    await page.getByRole('button',{name:'다음 알림',exact:false}).click()
    await expect(page.locator('.notification-detail-view h1')).toHaveText('안전 알림 2')
    await page.getByRole('button',{name:'이전 알림',exact:false}).click()
    await expect(page.locator('.notification-detail-view h1')).toHaveText('안전 알림 1')
    if (manager) {
      const card = page.locator('.notification-detail-card')
      assert.equal(await card.evaluate(el => getComputedStyle(el).borderRadius), '14px')
      assert(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'notification detail fits the app width')
      await (await import('node:fs/promises')).mkdir('test-results', { recursive: true })
      await page.screenshot({ path: 'test-results/admin-notification-detail.png' })
    }
    await page.getByRole('button', { name: '알림 목록' }).click()
    const pager = page.locator('.app-number-pagination')
    await pager.getByRole('button', { name: '5페이지', exact: true }).click()
    await expect(pager.locator('button[aria-label$="페이지"]:not([aria-label="이전 페이지"]):not([aria-label="다음 페이지"])')).toHaveText(['3','4','5','6','7'])
    await expect(pager.getByRole('button', { name: '5페이지', exact: true })).toHaveAttribute('aria-current','page')
    await expect(pager.getByRole('button', { name: '6페이지', exact: true })).toBeVisible()
    await expect(pager.getByRole('button', { name: '1페이지', exact: true })).toHaveCount(0)
    await pager.getByRole('button', { name: '6페이지', exact: true }).click()
    await expect(pager.getByRole('button', { name: '6페이지', exact: true })).toHaveAttribute('aria-current', 'page')
    // Direct links also resolve notifications beyond the first API page.
    notifications[104].read = false
    await page.goto(base + history + '?notification=105')
    await expect(page.locator('.notification-detail-view h1')).toHaveText('안전 알림 105')
    await expect.poll(() => calls.filter(call => call.path === `/api/${manager ? 'managers' : 'customers'}/me/notifications/105/read` && call.method === 'PUT').length).toBeGreaterThan(0)
  }
  assert.deepEqual(errors, [])
  console.log('PASS app map sheet, five-row list, read-all, notification detail/deep links, customer and manager numbered paging')
} finally { await browser.close(); await server.close() }
