import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

// Test-only responses. No requests below read or modify production facility data.
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const base = `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const now = Date.parse('2026-11-02T02:03:00Z')
const at = minutes => new Date(now + minutes * 60000).toISOString()
const history = [[-59, 0.4], [-45, 2.5], [-38, 85], [-37, 0.1], [-3, 0.1]].map(([minutes, riskScore]) => ({ predictedAt: at(minutes), riskScore, rainfallMm: 0.01 }))
const forecast = [[30, 1.1], [90, 5], [150, 9.1]].map(([minutes, riskScore]) => ({ targetAt: at(minutes), riskScore }))
let scenario = 'normal'
mkdirSync('test-results', { recursive: true })
try {
  const { riskChartSeries } = await server.ssrLoadModule('/src/utils/risk-chart.ts')
  const expected = riskChartSeries(history, forecast, 20, 260, 110, 100, { now })
  const page = await browser.newPage({ timezoneId: 'Asia/Seoul' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(60000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(time => { Date.now = () => time }, now)
  await page.route('https://**/*', route => route.abort())
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    const empty = scenario === 'missing'
    const facility = {
      id: 1, name: scenario === 'long' ? 'QA 부산진시장과 중앙대로 교차구간 연결 지하차도 긴 시설명 확인 대상' : 'QA 초량지하차도',
      regionName: '부산광역시 동구', roadAddress: '부산광역시 동구 중앙대로 111 지하차도 진입 구간',
      latitude: 35.1, longitude: 129.03, currentStatus: 'BLOCKED', currentRiskLevel: 'SAFE',
      riskScore: empty ? null : 0.1, currentWaterCm: empty ? null : 0, rainfallMm: empty ? null : 0.01,
      updatedAt: empty ? null : at(-3),
    }
    let data = null
    if (path === '/api/underpasses') data = { items: [facility], totalItems: 1, totalPages: 1, page: 1 }
    else if (path === '/api/underpasses/1') data = facility
    else if (path.endsWith('/risk-scores')) data = empty ? [] : history
    else if (path.endsWith('/risk-forecast')) data = empty ? [] : forecast
    else if (['/api/navigation/weather', '/api/weather'].includes(path)) data = empty ? {} : { temperature: scenario === 'condition' ? null : 14.2, condition: '흐림', rainfall: 0.01, humidity: 70, observedAt: at(-3) }
    else if (path.endsWith('/stream')) return route.fulfill({ status: 204 })
    return route.fulfill({ json: { success: true, data } })
  })
  async function open(width, height) {
    await page.setViewportSize({ width, height })
    await page.goto(base + '/c-map', { waitUntil: 'domcontentloaded' })
    await page.locator('.facility-list-panel .it').first().click()
    await page.locator('.map-detail-heading .nm').waitFor()
    await page.waitForFunction(() => !document.querySelector('.swapped-detail .weather-value')?.textContent.includes('조회 중'))
    if (scenario !== 'missing') await page.locator('.risk-history-chart').waitFor()
  }
  async function verify(theme, width, height) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
    const panel = page.locator('.swapped-detail')
    assert.equal(await panel.locator('.map-detail-metrics > div').count(), 4)
    assert.equal(await panel.locator('.map-detail-states dt').allTextContents().then(texts => texts.join('|')), '위험 단계|통제 상태')
    assert.equal((await panel.locator('.map-detail-control').textContent()).trim(), '통제 중')
    assert.equal((await panel.locator('.risk-level-badge').textContent()).trim(), '안전')
    assert.equal(await panel.locator('.det > button[aria-expanded]').count(), 0)
    const layout = await panel.evaluate(panel => {
      const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
      const metrics = [...panel.querySelectorAll('.map-detail-metrics > div')]
      const sections = [...panel.querySelector('.det').children].filter(node => node.getClientRects().length)
      const bounds = box(panel)
      return {
        width: bounds.width,
        pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        panelOverflow: panel.scrollWidth > panel.clientWidth + 1,
        overflowing: [...panel.querySelectorAll('.map-detail-heading,.map-detail-observed,.map-detail-metrics > div,.map-detail-footer,.map-detail-chart-legend')].filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.className),
        rows: metrics.map(box),
        framed: metrics.some(node => getComputedStyle(node).borderTopWidth !== '0px' || getComputedStyle(node).backgroundColor !== 'rgba(0, 0, 0, 0)'),
        overlap: sections.some((node, index) => index && box(sections[index - 1]).bottom > box(node).y + 1),
        heading: box(panel.querySelector('.map-detail-heading .nm')),
        location: box(panel.querySelector('.map-detail-location')),
        body: { scroll: panel.querySelector('.det').scrollHeight, height: panel.querySelector('.det').clientHeight },
      }
    })
    assert.equal(layout.pageOverflow, false, JSON.stringify({ scenario, theme, width, layout }))
    assert.equal(layout.panelOverflow, false)
    if (width > 900) {
      const map = await page.locator('.map-swap-layout > .mapw').boundingBox()
      const detail = await panel.boundingBox()
      assert(Math.abs(map.y - detail.y) < 1 && Math.abs(map.height - detail.height) < 1,
        'The desktop map and facility panel share their top and bottom edges')
    }
    assert.deepEqual(layout.overflowing, [])
    assert.equal(layout.framed, false, 'Metrics are separated by spacing, not cards')
    assert.equal(layout.overlap, false)
    assert(layout.location.y >= layout.heading.bottom - 1)
    const [a, b, c, d] = layout.rows
    assert(Math.abs(a.y - b.y) < 1 && Math.abs(c.y - d.y) < 1)
    assert(Math.abs(a.x - c.x) < 1 && Math.abs(b.x - d.x) < 1)
    const values = (await panel.locator('.map-detail-metrics strong').allTextContents()).map(text => text.trim())
    if (scenario === 'missing') {
      assert.deepEqual(values, ['—', '—', '—', '—'])
      assert.equal(await panel.locator('.risk-history-chart').count(), 0)
    } else {
      assert.deepEqual(values, ['0.1점', '0 cm', '0.01 mm', scenario === 'condition' ? '흐림' : '14.2°C'])
      const svg = panel.locator('.risk-history-chart')
      assert.equal(await svg.locator('path[stroke-width="3"]:not([stroke-dasharray])').getAttribute('d'), expected.observedPath, 'The spike and every observation stay intact')
      assert.equal(await svg.locator('path[stroke-dasharray="6 4"]').getAttribute('d'), expected.forecastPath)
      assert.equal(await svg.locator('path[stroke-opacity=".5"]').getAttribute('d'), expected.carryPath)
      assert.equal(await panel.locator('.map-detail-chart-legend li').count(), 3)
      const outsideLabels = await svg.evaluate(svg => {
        const vb = svg.viewBox.baseVal
        return [...svg.querySelectorAll('text')].filter(text => { const b = text.getBBox(); return b.x < vb.x - 1 || b.y < vb.y - 1 || b.x + b.width > vb.x + vb.width + 1 || b.y + b.height > vb.y + vb.height + 1 }).map(text => text.textContent)
      })
      assert.deepEqual(outsideLabels, [])
    }
    assert.equal(await panel.locator('.map-detail-footer a').getAttribute('href'), '/info/app-guide#install')
    await panel.locator('.map-detail-footer').scrollIntoViewIfNeeded()
    assert(await panel.locator('.map-detail-footer a').isVisible())
    if (width === 1920 && height === 1080 || width === 1366 && height === 768 || width === 390) {
      // Element screenshots otherwise include the page's fixed header over the sidebar.
      await page.locator('.customer-header').evaluateAll(nodes => nodes.forEach(node => node.style.visibility = 'hidden'))
      await panel.locator('.det').evaluate(node => { node.scrollTop = 0 })
      await panel.screenshot({ path: `test-results/map-facility-detail-${scenario}-${theme}-${width}.png` })
    }
    console.log('PASS detail panel', scenario, theme, `${width}x${height}`, 'panel width', layout.width)
  }
  for (const [width, height] of [[1920, 1080], [1920, 960], [1366, 768], [1366, 650], [1100, 768], [390, 844]]) {
    await open(width, height)
    for (const theme of ['light', 'dark']) await verify(theme, width, height)
  }
  for (scenario of ['long', 'missing', 'condition']) {
    for (const [width, height] of [[1366, 768], [390, 844]]) {
      await open(width, height)
      for (const theme of ['light', 'dark']) await verify(theme, width, height)
    }
  }
  await page.locator('.swapped-detail .back-to-list').click()
  await page.locator('.facility-list-panel .it').first().waitFor()
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
  await server.close()
}
