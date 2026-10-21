import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage(),
    errors = [],
    calls = []
  let failWeather = false
  const rows = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `테스트지하차도 ${i + 1}`,
    regionName: '동구',
    roadAddress: '부산광역시 동구 중앙대로 ' + i,
    latitude: 35.12 + i * 0.001,
    longitude: 129.04,
    currentStatus: 'NORMAL',
    currentRiskLevel: '안전',
  }))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/v2/maps/sdk.js*', (r) => r.abort())
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname
    calls.push(url.pathname + url.search)
    if (path === '/api/navigation/weather')
      return route.fulfill(
        failWeather
          ? {
              status: 502,
              json: {
                success: false,
                message: '기상청 관측 정보를 받아오지 못했습니다.',
                data: null,
              },
            }
          : {
              json: {
                success: true,
                data: {
                  temperature: 17.2,
                  humidity: 82,
                  rainfall: 1.5,
                  windSpeed: 2.3,
                  condition: '비',
                  observedAt: '2026-10-20T11:00:00+09:00',
                  source: '기상청',
                },
              },
            },
      )
    return route.fulfill({
      json: {
        success: true,
        data:
          path === '/api/underpasses'
            ? { items: rows, page: 1, totalPages: 1, totalItems: 12 }
            : /^\/api\/underpasses\/\d+$/.test(path)
              ? rows[Number(path.split('/').at(-1)) - 1]
              : path.endsWith('/risk-scores')
                ? []
                : null,
      },
    })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1280, 720],
    [1024, 600],
    [900, 600],
    [844, 390],
    [390, 844],
    [360, 640],
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto(base + '/c-map')
    await page.locator('.facility-list-panel .it').first().waitFor()
    const dimensions = await page.evaluate(() => {
      const r = (selector) => {
        const x = document.querySelector(selector).getBoundingClientRect()
        return { x: x.x, y: x.y, w: x.width, h: x.height, bottom: x.bottom, right: x.right }
      }
      return {
        map: r('.mapw'),
        panel: r('.facility-list-panel'),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        sidebar: !!document.querySelector('.customer-section-sidebar'),
      }
    })
    assert.equal(dimensions.overflow, false, `${width}x${height} overflow`)
    assert.equal(dimensions.sidebar, true)
    if (width > 900) {
      assert(Math.abs(dimensions.map.h - dimensions.panel.h) < 2)
      assert(Math.abs(dimensions.map.bottom - (height - 16)) < 5, JSON.stringify(dimensions))
      assert(dimensions.panel.x >= dimensions.map.right - 1)
    } else {
      assert(dimensions.map.h >= 320)
      assert(dimensions.panel.y >= dimensions.map.bottom)
    }
    await page.locator('.map-weather-marker').click()
    const popup = page.locator('.map-weather-detail')
    await popup.getByText('17.2°', { exact: true }).waitFor()
    await popup.getByText('82%', { exact: true }).waitFor()
    await popup.getByText('1.5 mm', { exact: true }).waitFor()
    assert((await popup.locator('footer').innerText()).includes('기상청'))
    const popupRect = await popup.boundingBox(),
      mapRect = await page.locator('.mapw').boundingBox()
    assert(
      popupRect.x >= mapRect.x && popupRect.x + popupRect.width <= mapRect.x + mapRect.width + 1,
    )
    assert(popupRect.y >= mapRect.y - 1, `${width} popup clipped above map`)
    await popup.getByRole('button', { name: '날씨 상세 닫기', exact: true }).click()
    await page.locator('.facility-list-panel .it').first().click()
    await page.locator('.swapped-detail .nm').waitFor()
    const det = page.locator('.swapped-detail'),
      cctv = det.getByRole('button', { name: '▶ 현재 CCTV 보기 (이 지하차도만)', exact: true })
    await cctv.scrollIntoViewIfNeeded()
    assert(await cctv.isVisible())
    if (width > 900) assert(Math.abs((await det.boundingBox()).height - dimensions.map.h) < 2)
    await page.getByRole('button', { name: '목록으로', exact: true }).click()
    await page.locator('.customer-list-pagination').scrollIntoViewIfNeeded()
    assert(await page.locator('.customer-list-pagination').isVisible())
    const next = page
      .locator('.customer-list-pagination')
      .getByRole('button', { name: '다음', exact: true })
    await next.click()
    assert((await page.locator('.customer-list-pagination').innerText()).includes('2 /'))
    console.log(
      'PASS viewport, equal panels, weather popup, detail and pagination reachable',
      width,
      height,
    )
  }
  failWeather = true
  await page.goto(base + '/c-map')
  await page.locator('.map-weather-marker').click()
  await page.locator('.weather-error').waitFor()
  failWeather = false
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click()
  await page.locator('.map-weather-detail').getByText('17.2°', { exact: true }).waitFor()
  assert(!calls.some((path) => path.startsWith('/api/weather?')))
  assert(calls.some((path) => path.startsWith('/api/navigation/weather?lat=35.12')))
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  mkdirSync('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/map-viewport-weather.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS KMA route, selected facility coordinates, weather retry, no runtime errors')
} finally {
  await browser?.close()
  await server.close()
}
