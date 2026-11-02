import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

// All records and SDK behavior below are test fixtures; no live data is changed.
const baseline = process.argv.includes('--baseline')
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const origin = `http://127.0.0.1:${server.httpServer.address().port}`
mkdirSync('test-results', { recursive: true })
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route(/^https?:\/\//, route => new URL(route.request().url()).origin === origin ? route.fallback() : route.abort())
  const facility = { id: 1, name: 'QA 부산진시장지하차도', regionId: 1, regionName: '부산광역시', latitude: 35.1, longitude: 129.03, currentStatus: 'NORMAL', currentRiskLevel: 'SAFE', currentRiskScore: 20, manageable: true }
  const rows = ['PENDING', 'CONFIRMED', 'AUTO_PROCESSED', 'NONE', null].map((reviewStatus, index) => ({
    id: index + 1, underpassId: 1, underpassName: facility.name, cameraId: 226 + index,
    detectedNum: index === 4 ? null : '123가4567', correctedNum: index === 1 ? '부산12가3456' : null,
    imagePath: index === 0 ? 'qa-plate.svg' : null, confidence: index === 4 ? null : 0.98,
    recognitionStatus: ['LOW_CONFIDENCE', 'SUCCESS', 'FAIL', 'UNMATCHED', null][index], reviewStatus,
    reviewDeadline: index === 0 ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null,
    detectedAt: index === 4 ? null : '2026-11-02T23:59:58',
  }))
  let empty = false
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/uploads/qa-plate.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="50"><rect width="180" height="50" fill="white"/><text x="10" y="32" font-size="24">QA 123가4567</text></svg>' })
    let data = []
    if (path === '/api/managers/me') data = { id: 1, name: 'QA 관리자', role: 'REGIONAL_ADMIN', regions: [{ id: 1, name: '부산광역시' }] }
    else if (path === '/api/customers/me') data = null
    else if (path === '/api/regions') data = [{ id: 1, name: '부산광역시' }]
    else if (path === '/api/underpasses') data = { items: [facility], totalItems: 1, totalPages: 1, page: 1 }
    else if (path === '/api/underpasses/1') data = facility
    else if (path.endsWith('/cameras')) data = [{ id: 226, name: 'QA 카메라', cameraRole: 'APPROACH_LPR', underpassId: 1 }]
    else if (path === '/api/plate-logs') data = { items: empty ? [] : rows, totalItems: empty ? 0 : rows.length, totalPages: 1, page: 1 }
    else if (path === '/api/dashboard/facility-kpi') data = { facilityCount: 1, blockedCount: 0, dangerLevelCount: 0, pendingReviewCount: 1, remainingCount: 0, alertsToday: 0 }
    else if (path === '/api/dashboard/timeline') data = Array.from({ length: 12 }, (_, id) => ({ id, underpassName: facility.name, eventType: 'BLOCK', reason: 'QA 통제 상태 변경', createdAt: '2026-11-02T23:59:58' }))
    else if (path.endsWith('/risk-scores')) data = [{ riskScore: 20, predictedAt: '2026-11-02T23:00:00' }]
    else if (path.includes('/notifications') || path.startsWith('/api/pm/')) data = { items: [], totalItems: 0, totalPages: 1, page: 1 }
    return route.fulfill({ json: { success: true, data } })
  })
  // Reuse the project's map SDK stub to exercise the real map ResizeObserver.
  const mapSource = readFileSync(new URL('./manager-map-overlay.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const start = mapSource.indexOf('await page.addInitScript(') + 'await page.addInitScript('.length
  const end = mapSource.indexOf('\n  })', start) + 4
  assert(end > start, 'Map SDK test fixture must be present')
  await page.addInitScript({ content: '(' + mapSource.slice(start, end)
    .replace('relayout() {}', 'relayout() { window.qaRelayouts = (window.qaRelayouts || 0) + 1 }')
    .replace('setMap(value) {', 'setImage() {} setZIndex() {} setTitle(value) { this.el.textContent = value } setMap(value) {') + ')()' })
  await page.addInitScript(() => {
    localStorage.setItem('routel-handover-hide:1:REGIONAL_ADMIN', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
  })
  await page.goto(origin + '/admin-data/ocr', { waitUntil: 'domcontentloaded' })
  await page.locator('.resource-list-table tbody tr').filter({ hasText: '123가4567' }).first().waitFor()
  const geometry = await page.locator('.resource-list-table').evaluate(table => ({ table: table.getBoundingClientRect().width, container: table.parentElement.clientWidth, scroll: table.parentElement.scrollWidth, dates: [...table.querySelectorAll('td[data-field=detectedAt]')].map(cell => ({ text: cell.textContent.trim(), width: cell.clientWidth, scroll: cell.scrollWidth, padding: getComputedStyle(cell).padding })) }))
  console.log('OCR geometry:', JSON.stringify(geometry))
  await page.screenshot({ path: `test-results/dashboard-ocr-${baseline ? 'before' : 'after'}.png`, fullPage: true })
  if (!baseline) {
    assert(geometry.scroll <= geometry.container + 1, JSON.stringify(geometry))
    const viewports = [{ width: 1920, height: 1080 }, { width: 1920, height: 960 }, { width: 1366, height: 768 }, { width: 1366, height: 650 }, { width: 1100, height: 768 }, { width: 768, height: 900 }, { width: 390, height: 844 }]
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
      for (const viewport of viewports) {
        await page.setViewportSize(viewport)
        const result = await page.locator('.resource-list-table').evaluate(table => {
          const tableBox = table.getBoundingClientRect()
          const cells = [...table.querySelectorAll('tbody td')]
          return {
            pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
            tableOverflow: table.parentElement.scrollWidth > table.parentElement.clientWidth + 1,
            overflowingCells: cells.filter(cell => cell.scrollWidth > cell.clientWidth + 1).map(cell => cell.dataset.field),
            clippedValues: [...table.querySelectorAll('.ocr-log-timestamp span,.resource-status')].filter(value => {
              const box = value.getBoundingClientRect(), cell = value.closest('td').getBoundingClientRect()
              return box.left < cell.left || box.right > cell.right + 1 || box.bottom > cell.bottom + 1
            }).map(value => value.textContent),
            dates: [...table.querySelectorAll('td[data-field=detectedAt]')].map(cell => cell.innerText.trim()),
            count: table.querySelectorAll('tbody tr').length,
            aligned: [...table.querySelectorAll('thead th[data-field]')].every(header => {
              if (!header.getClientRects().length) return true
              const cell = table.querySelector(`tbody td[data-field="${header.dataset.field}"]`)
              return Math.abs(header.getBoundingClientRect().left - cell.getBoundingClientRect().left) < 1 && Math.abs(header.getBoundingClientRect().width - cell.getBoundingClientRect().width) < 1 && getComputedStyle(header).paddingLeft === getComputedStyle(cell).paddingLeft
            }),
            width: tableBox.width,
          }
        })
        assert.equal(result.pageOverflow, false, JSON.stringify({ theme, viewport, result }))
        assert.equal(result.tableOverflow, false, JSON.stringify({ theme, viewport, result }))
        assert.deepEqual(result.overflowingCells, [], JSON.stringify({ theme, viewport, result }))
        assert.deepEqual(result.clippedValues, [], JSON.stringify({ theme, viewport, result }))
        assert.equal(result.aligned, true)
        assert.equal(result.count, 5)
        assert(result.dates.slice(0, 4).every(date => /2026\.11\.02\s+23:59/.test(date)), JSON.stringify(result.dates))
        assert.equal(result.dates[4], '—')
        for (const status of ['낮은 신뢰도', '자동 처리', '대상 아님']) assert(await page.locator('.resource-status').filter({ hasText: status }).isVisible())
        console.log('PASS OCR', theme, `${viewport.width}x${viewport.height}`)
      }
      await page.setViewportSize({ width: 1366, height: 768 })
      await page.screenshot({ path: `test-results/dashboard-ocr-${theme}.png`, fullPage: true })
    }
    empty = true
    await page.getByRole('button', { name: '새로고침', exact: true }).click()
    await page.locator('.record-empty-state').waitFor()
    assert.equal(await page.locator('.resource-list-table').count(), 0)
    empty = false

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto(origin + '/admin-dashboard', { waitUntil: 'domcontentloaded' })
    const handoverClose = page.locator('.handover-x')
    await page.locator('.test-map-marker').first().waitFor()
    if (await handoverClose.isVisible()) await handoverClose.click()
    await page.locator('.test-map-marker').first().click()
    const selectedPanel = page.locator('.manager-map-panel')
    await selectedPanel.locator('.manager-facility-heading').waitFor()
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
      for (const viewport of viewports.slice(0, 5)) {
        const before = await page.evaluate(() => window.qaRelayouts || 0)
        const previousStage = await page.locator('.manager-map-stage').boundingBox()
        await page.setViewportSize(viewport)
        const currentStage = await page.locator('.manager-map-stage').boundingBox()
        if (previousStage.width !== currentStage.width || previousStage.height !== currentStage.height)
          await page.waitForFunction(before => window.qaRelayouts > before, before)
        const boxes = await page.locator('.dashboard-fixed-item:visible').evaluateAll(nodes => nodes.map(node => {
          const box = node.getBoundingClientRect()
          return { id: node.className, x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height, overflow: node.scrollWidth > node.clientWidth + 1 }
        }))
        for (let a = 0; a < boxes.length; a++) {
          assert.equal(boxes[a].overflow, false, JSON.stringify({ viewport, box: boxes[a] }))
          for (let b = a + 1; b < boxes.length; b++) {
            const x = boxes[a], y = boxes[b]
            assert(!(x.x < y.right - 1 && x.right > y.x + 1 && x.y < y.bottom - 1 && x.bottom > y.y + 1), JSON.stringify({ viewport, x, y }))
          }
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
        const map = boxes.find(box => box.id.includes('fixed-map'))
        const events = boxes.find(box => box.id.includes('fixed-events'))
        assert(Math.abs(map.y - events.y) < 2 && Math.abs(map.height - events.height) < 2)
        const stage = await page.locator('.manager-map-stage').boundingBox()
        const detail = await selectedPanel.boundingBox()
        assert(stage.height >= 720, 'Desktop map keeps the larger viewing area')
        if (stage.width > 600)
          assert(Math.abs(detail.height - (stage.height - 24)) < 3, 'Expanded marker details fill map height with 12px insets')
        console.log('PASS dashboard + map relayout', theme, `${viewport.width}x${viewport.height}`, 'map height', map.height)
      }
      await page.screenshot({ path: `test-results/dashboard-layout-${theme}.png`, fullPage: true })
    }
    const expandedHeight = (await selectedPanel.boundingBox()).height
    await selectedPanel.locator('.manager-detail-toggle').click()
    assert.equal(await selectedPanel.locator('.manager-panel-body').isVisible(), false)
    assert((await selectedPanel.boundingBox()).height < expandedHeight)
    await selectedPanel.locator('.manager-detail-toggle').click()
    assert.equal(await selectedPanel.locator('.manager-panel-body').isVisible(), true)
    await page.getByRole('button', { name: '화면편집', exact: true }).click()
    await page.getByRole('button', { name: '위젯 리스트 닫기', exact: true }).click()
    const map = page.locator('.fixed-map')
    const rightHandle = map.locator('.board-resize-right')
    await rightHandle.focus()
    await page.keyboard.press('ArrowRight')
    await page.locator('.board-customized').waitFor()
    const initial = await map.boundingBox()
    const relayouts = await page.evaluate(() => window.qaRelayouts)
    await rightHandle.scrollIntoViewIfNeeded()
    const handle = await rightHandle.boundingBox()
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x - 240, handle.y + handle.height / 2, { steps: 8 })
    await page.mouse.up()
    await page.waitForFunction(width => document.querySelector('.fixed-map').clientWidth < width - 100, initial.width)
    await page.waitForFunction(before => window.qaRelayouts > before, relayouts)
    const narrow = await map.boundingBox()
    await rightHandle.focus()
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
    assert((await map.boundingBox()).width > narrow.width + 50)
    await page.getByRole('button', { name: '화면편집', exact: true }).click()
    await page.getByRole('complementary', { name: '위젯 리스트' }).getByRole('button', { name: /^OCR/ }).click()
    await page.getByRole('button', { name: '위젯 리스트 닫기', exact: true }).click()
    const ocr = page.locator('[data-widget-id=ocr]')
    await ocr.getByRole('combobox', { name: 'OCR 위젯 시설' }).selectOption('1')
    await ocr.locator('.facility-video-empty').waitFor()
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
      const resize = ocr.locator('.board-resize-right')
      await resize.focus()
      for (const direction of ['ArrowLeft', 'ArrowRight']) {
        for (let i = 0; i < 10; i++) await page.keyboard.press(direction)
        assert.equal(await ocr.evaluate(node => node.scrollWidth > node.clientWidth + 1), false, `OCR widget overflow: ${theme} ${direction}`)
      }
    }
    await page.getByRole('button', { name: '취소', exact: true }).click()
    console.log('PASS widget pointer shrink, keyboard enlarge, map ResizeObserver, edit cancel, empty OCR state')
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
  await server.close()
}
