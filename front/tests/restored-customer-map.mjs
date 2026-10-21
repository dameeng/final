import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
const base = `http://127.0.0.1:${server.httpServer.address().port}`
let browser
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage(),
    errors = []
  let failed = false
  const rows = [
    {
      id: 1,
      name: '초량1지하차도',
      regionName: '부산광역시',
      latitude: 35.1,
      longitude: 129.1,
      currentStatus: 'BLOCKED',
      currentRiskLevel: '위험',
      riskScore: 76.4,
      roadAddress: '부산광역시 동구',
    },
    {
      id: 2,
      name: '범천지하차도',
      regionName: '부산광역시',
      latitude: 35.15,
      longitude: 129.05,
      currentStatus: 'NORMAL',
      currentRiskLevel: '안전',
      riskScore: 21,
      roadAddress: '부산광역시 부산진구',
    },
  ]
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/v2/maps/sdk.js*', (r) => r.abort())
  await page.route('**/api/**', (r) => {
    const path = new URL(r.request().url()).pathname
    if (path === '/api/underpasses')
      return r.fulfill(
        failed
          ? { status: 500, json: { success: false, message: '서버 오류', data: null } }
          : {
              json: { success: true, data: { items: rows, page: 1, totalPages: 1, totalItems: 2 } },
            },
      )
    if (path === '/api/underpasses/1') return r.fulfill({ json: { success: true, data: rows[0] } })
    if (path.endsWith('/risk-scores'))
      return r.fulfill({
        json: {
          success: true,
          data: [
            { riskScore: 60, predictedAt: new Date().toISOString() },
            { riskScore: 76.4, predictedAt: new Date().toISOString() },
          ],
        },
      })
    if (path === '/api/weather')
      return r.fulfill({
        json: { success: true, data: { temperature: 18, condition: '비', rainfall: 2 } },
      })
    return r.fulfill({ json: { success: true, data: null } })
  })
  for (const width of [1900, 1280, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(base + '/c-map')
    const list = page.locator('.facility-list-panel')
    await list.getByRole('button', { name: /초량1지하차도/ }).waitFor()
    assert.equal(await page.locator('.legacy-live-map .underpass-map-table').count(), 0)
    assert.equal(await page.locator('.legacy-live-map .underpass-map-form').count(), 0)
    assert.equal(await list.locator('.it').count(), 2)
    const map = page.locator('.customer-map-canvas'),
      before = await map.boundingBox(),
      panel = await list.boundingBox()
    assert(before.width > 200 && before.height >= 360)
    if (width >= 1280)
      assert(before.x + before.width <= panel.x + 1, 'map stays left, list stays right')
    const handle = await map.elementHandle()
    await list.getByRole('button', { name: /초량1지하차도/ }).click()
    await page.locator('.swapped-detail .nm').filter({ hasText: '초량1지하차도' }).waitFor()
    await page.locator('.risk-history-chart').waitFor()
    assert.equal(Math.round((await map.boundingBox()).width), Math.round(before.width))
    assert(await handle.evaluate((el) => el.isConnected))
    await page.getByRole('button', { name: '상세 접기 ▴', exact: true }).click()
    assert(await page.locator('.detail-extended').isHidden())
    await page.getByRole('button', { name: '상세 펼치기 ▾', exact: true }).click()
    assert(
      await page
        .getByRole('button', { name: '▶ 현재 CCTV 보기 (이 지하차도만)', exact: true })
        .isVisible(),
    )
    await page.getByRole('button', { name: '목록으로', exact: true }).click()
    await list.waitFor()
    await list.getByRole('button', { name: '안전', exact: true }).click()
    assert.equal(await list.locator('.it').count(), 1)
    await list.getByRole('button', { name: '전체', exact: true }).click()
    await list.getByRole('searchbox', { name: '검색', exact: true }).fill('범천')
    assert.equal(await list.locator('.it').count(), 1)
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    )
    console.log('PASS restored map/list/detail, API data, filters, fixed map size', width)
  }
  failed = true
  await page.goto(base + '/c-map')
  await page.getByRole('alert').filter({ hasText: '조회 서버에 오류' }).waitFor()
  assert.equal(await page.locator('.facility-list-panel .it').count(), 0)
  assert(await page.locator('.customer-map-canvas').isVisible())
  failed = false
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await page.locator('.facility-list-panel .it').first().waitFor()
  await page.setViewportSize({ width: 1900, height: 1000 })
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  mkdirSync('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/restored-customer-map.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS API error stays visible, refresh recovers, no runtime errors')
} finally {
  await browser?.close()
  await server.close()
}
