import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  let type = 'PUMP', missing = false, value = 12.345
  const columns = {
    PUMP: ['vibration', 'pressure', 'temperature', 'current', 'flow', 'rpm'],
    CCTV: ['video_receive_rate', 'response_time_ms', 'packet_loss_rate', 'image_blur_score'],
    DISPLAY: ['temperature_c', 'ambient_c', 'ripple_v', 'response_time_ms', 'error_count', 'bad_pixel_pct'],
    WATER_LEVEL: ['level_m'],
  }
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    const equipment = { equipId: 15, name: '테스트 설비', type, underpassId: 7, underpassName: '초량지하차도', score: null }
    let data = { items: [], page: 1, totalItems: 0, totalPages: 1 }
    if (path === '/api/managers/me') data = { id: 1, name: '관리자', role: 'REGIONAL_ADMIN', regions: [] }
    else if (path === '/api/customers/me') data = null
    else if (path === '/api/pm/equipments/15') data = {
      equipment, currentSensors: { recordedAt: missing ? null : '2026-10-28T12:10:00', values: missing ? {} : Object.fromEntries(columns[type].map((key, i) => [key, i === 1 ? 0 : i === 2 ? null : value])) },
      detail: { features: [], extra: type === 'PUMP' ? { sensors: [{ '항목': 'vibration', '센서': '진동', '현재': 999, '평소': 10, '상태': '정상' }] } : {} },
      cautionMin: 40, dangerMin: 70, topCauses: [], recentActions: [], scoredAt: '2026-10-27T12:00:00',
    }
    else if (path === '/api/pm/equipments') data = { ...data, items: [equipment] }
    else if (path.endsWith('/scores') || path === '/api/regions') data = []
    else if (path.endsWith('/thresholds')) data = { history: [] }
    else if (path.endsWith('/sensor-trend')) data = { points: [{at:'2026-10-22T12:00:00',value:10},{at:'2026-10-28T12:00:00',value:12}], band: null }
    return route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    for (type of Object.keys(columns)) {
      missing = false; value = 12.345
      const path = width === 1440 ? '/pm-equipment-detail?id=15' : '/admin-app/screen-10?id=15'
      await page.goto(base + path)
      const sensors = page.getByRole('region', { name: '센서 현재값', exact: true })
      await expect(sensors.locator('.pm-current-sensor')).toHaveCount(columns[type].length)
      await sensors.scrollIntoViewIfNeeded()
      const graph=page.locator('.pm-sensor-card .pm-chart-scroll')
      await expect(graph).toBeVisible()
      await expect.poll(()=>graph.evaluate(el=>Math.abs(el.scrollWidth-el.clientWidth-el.scrollLeft))).toBeLessThan(2)
      await expect(sensors.locator('strong').first()).toHaveText('12.345')
      await expect(sensors).toContainText('2026.10.28 12:10')
      if (columns[type].length > 1) await expect(sensors.locator('strong').nth(1)).toHaveText('0')
      if (columns[type].length > 2) await expect(sensors.locator('.pm-current-sensor').nth(2)).toContainText('미수신')
      assert(await sensors.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${type} sensor card fits at ${width}px`)
      if (type==='PUMP' && width<1440) {
        const comparison=page.locator('.pm-sensor-table-card tbody tr').first()
        assert(await comparison.evaluate(el=>el.getBoundingClientRect().height<115),'Analysis comparison uses a compact two-row box')
        assert(await comparison.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Analysis values fit compact box')
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow')
    }
  }
  value = 20
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('routel-backend-event', { detail: { name: 'pm-update', data: { items: [{ equipId: 15 }] } } })))
  await expect(page.locator('.pm-current-sensor strong').first()).toHaveText('20')
  missing = true
  await page.reload()
  await expect(page.locator('.pm-current-sensors')).toContainText('아직 수신된 센서 측정값이 없습니다.')
  await expect(page.locator('.pm-current-sensor strong').first()).toHaveText('—')
  assert.deepEqual(errors, [])
  console.log('PASS four equipment types, latest raw vs old model values, units, null/zero/no-score/no-data, realtime refresh and 320/390px app + web layout')
} finally { await browser.close(); await server.close() }
