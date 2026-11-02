import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

// All HTTP responses and map objects are fixtures. No real facility data is changed.
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  page.setDefaultTimeout(60000)
  const errors = [], calls = [], pending = []
  let hold = false, failed = false, empty = false, score = 20
  const now = Date.parse('2026-11-02T02:30:00Z')
  const at = minutes => new Date(now + minutes * 60000).toISOString()
  const rows = [1, 2].map(id => ({
    id, name: `QA Facility ${id}`, regionName: '부산광역시 동구', roadAddress: '부산광역시 동구 중앙대로',
    latitude: 35.1 + id / 1000, longitude: 129.03, currentStatus: 'BLOCKED', currentRiskLevel: 'SAFE',
    riskScore: id === 1 ? 20 : 70, currentWaterCm: 0.5, rainfallMm: 0.01, updatedAt: at(-1),
  }))
  await page.addInitScript(time => {
    Date.now = () => time
    window.EventSource = class extends EventTarget { close() {} }
  }, now)
  const source = readFileSync(new URL('./manager-map-overlay.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const start = source.indexOf('await page.addInitScript(') + 'await page.addInitScript('.length
  const end = source.indexOf('\n  })', start) + 4
  assert(end > start)
  await page.addInitScript({ content: '(' + source.slice(start, end)
    .replace('setMap(value) {', 'setImage() {} setZIndex() {} setTitle() {} setMap(value) {') + ')()' })
  page.on('pageerror', e => errors.push(e.message))
  await page.route('https://**/*', route => route.abort())
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    calls.push(path)
    const selectedRequest = /^\/api\/underpasses\/1(?:\/risk-scores|\/risk-forecast)?$/.test(path)
    if (hold && selectedRequest) await new Promise(resolve => pending.push(resolve))
    if (failed && selectedRequest) {
      await route.fulfill({ status: 503, json: { success: false, message: 'QA 갱신 실패' } })
      return
    }
    let data = null
    if (path === '/api/underpasses') data = { items: rows, page: 1, totalPages: 1, totalItems: rows.length }
    else if (/^\/api\/underpasses\/\d+$/.test(path)) data = rows.find(row => row.id === Number(path.split('/').at(-1)))
    else if (path.endsWith('/risk-scores')) data = empty ? [] : [{ predictedAt: at(-10), riskScore: path.includes('/1/') ? score : 70, rainfallMm: 0.01 }]
    else if (path.endsWith('/risk-forecast')) data = empty ? [] : [{ targetAt: at(60), riskScore: 25 }]
    else if (path.endsWith('/weather')) data = { temperature: 14.2, humidity: 60, rainfall: 0.01, condition: '흐림' }
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto(server.resolvedUrls.local[0] + 'c-map', { waitUntil: 'domcontentloaded' })
  await page.locator('.test-map-marker').first().click()
  const metrics = page.locator('.map-detail-metrics'), chart = page.locator('.risk-history-chart')
  const status = page.locator('.map-detail-refresh')
  await expect(metrics.locator('strong').first()).toHaveText('20.0점')
  await expect(page.locator('.map-weather-marker strong')).toHaveText('14.2°')
  await expect(status).toHaveText('')
  const weatherCount = calls.filter(path => path.endsWith('/weather')).length
  const markers = await page.locator('.test-map-marker').elementHandles()
  await page.evaluate(() => { window.qaChart = document.querySelector('.risk-history-chart') })
  async function event(name, data) {
    await page.evaluate(({ name, data }) => window.dispatchEvent(new CustomEvent('routel-backend-event', { detail: { name, data } })), { name, data })
  }
  // Numeric stream updates must not restart requests for the same weather location.
  for (let i = 0; i < 5; i++) await event('water-update', { underpassId: 1, waterCm: 1 + i, measuredAt: at(0) })
  await expect(metrics.locator('strong').nth(1)).toHaveText('5 cm')
  assert.equal(calls.filter(path => path.endsWith('/weather')).length, weatherCount)
  const oldPath = await chart.locator('path[stroke-width="3"]:not([stroke-dasharray])').getAttribute('d')
  const before = await metrics.boundingBox()
  hold = true
  await event('data-changed', { resource: 'underpass', id: 1 })
  await expect.poll(() => pending.length).toBe(3)
  await expect(status).toHaveText('최신 상태를 조회 중입니다.')
  await expect(metrics.locator('strong').first()).toHaveText('20.0점')
  assert.equal(await chart.locator('path[stroke-width="3"]:not([stroke-dasharray])').getAttribute('d'), oldPath)
  assert.equal(await page.evaluate(() => window.qaChart === document.querySelector('.risk-history-chart')), true)
  assert(Math.abs((await metrics.boundingBox()).y - before.y) < 1, 'Loading does not move the metrics')
  score = 25
  hold = false
  pending.splice(0).forEach(resolve => resolve())
  await expect(metrics.locator('strong').first()).toHaveText('25.0점')
  await expect(status).toHaveText('')
  assert.equal(await page.evaluate(() => window.qaChart === document.querySelector('.risk-history-chart')), true)
  assert.equal(calls.filter(path => path.endsWith('/weather')).length, weatherCount)
  for (const marker of markers) assert(await marker.evaluate(node => node.isConnected), 'Markers stay mounted')

  failed = true
  await event('data-changed', { resource: 'underpass', id: 1 })
  await expect(status).toContainText('지하차도 조회 서버에 오류가 발생했습니다.')
  await expect(metrics.locator('strong').first()).toHaveText('25.0점')
  await expect(page.locator('.map-detail-chart-note').filter({ hasText: '마지막으로 조회한 관측값' })).toBeVisible()
  assert.equal(await chart.count(), 1)
  failed = false
  empty = true
  await event('data-changed', { resource: 'underpass', id: 1 })
  await expect(chart).toHaveCount(0)
  await expect(page.getByText('표시할 관측 정보가 없습니다.', { exact: true })).toBeVisible()

  // A different facility must never inherit the previous facility's history.
  empty = false
  await page.locator('.test-map-marker').nth(1).click()
  await expect(page.locator('.map-detail-heading .nm')).toHaveText('QA Facility 2')
  await expect(metrics.locator('strong').first()).toHaveText('70.0점')
  await expect(status).toHaveText('')
  await expect(page.locator('.map-detail-chart-note').filter({ hasText: '마지막으로 조회한 관측값' })).toHaveCount(0)
  assert.deepEqual(errors, [])
  console.log('PASS refresh retains graph/values/DOM/marker identity and positions; unchanged location skips weather; failed refresh is labeled; empty data clears; switching facility isolates data')
} finally {
  await browser.close()
  await server.close()
}
