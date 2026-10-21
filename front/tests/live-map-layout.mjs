import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
const base = `http://127.0.0.1:${server.httpServer.address().port}`
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  const errors = []
  let failed = true
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/v2/maps/sdk.js*', (r) => r.abort())
  await page.route('**/api/**', (r) => {
    const path = new URL(r.request().url()).pathname
    if (path === '/api/underpasses') {
      if (failed)
        return r.fulfill({
          status: 500,
          json: { success: false, message: '서버 오류', data: null },
        })
      return r.fulfill({
        json: {
          success: true,
          data: {
            items: [
              {
                id: 1,
                name: '테스트지하차도',
                regionName: '부산광역시',
                latitude: 35.1,
                longitude: 129.1,
                currentStatus: 'NORMAL',
                currentRiskLevel: '안전',
              },
            ],
            page: 1,
            totalPages: 1,
            totalItems: 1,
          },
        },
      })
    }
    return r.fulfill({ json: { success: true, data: null } })
  })
  for (const width of [1900, 1280, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(base + '/c-map')
    await page.getByRole('alert').filter({ hasText: '조회 서버에 오류' }).waitFor()
    const result = await page.locator('.legacy-live-map').evaluate((el) => {
      const rect = (selector) => el.querySelector(selector).getBoundingClientRect()
      const legend = rect('.pill'),
        map = rect('.customer-map-canvas'),
        title = rect('.facility-list-panel'),
        header = document.querySelector('.customer-header').getBoundingClientRect()
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        titleVisible: title.top >= header.bottom,
        legendHeight: legend.height,
        legendDisplay: getComputedStyle(el.querySelector('.pill')).display,
        mapHeight: map.height,
        mapWidth: map.width,
      }
    })
    assert.equal(result.overflow, false, `overflow ${width}`)
    assert.equal(result.titleVisible, true, `title clipped ${width}`)
    assert.equal(result.legendDisplay, 'flex')
    assert(result.legendHeight < 110, `legend too tall ${width}`)
    assert(result.mapHeight >= 360 && result.mapHeight <= 1000)
    assert(result.mapWidth > 200, `map too narrow ${width}`)
    console.log('PASS live map layout and server-error state', width)
  }
  failed = false
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await page.locator('.it').filter({ hasText: '테스트지하차도' }).waitFor()
  assert.equal(await page.getByRole('alert').filter({ hasText: '조회 서버에 오류' }).count(), 0)
  assert.deepEqual(errors, [])
  console.log('PASS refresh recovers from server error and displays real API rows')
} finally {
  await browser?.close()
  await server.close()
}
