import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const baselineMode = process.argv.includes('--baseline')
const output = 'tests/design-preview/water-dashboard'
await mkdir(output, { recursive: true })
const baseline = baselineMode ? null : JSON.parse(await readFile(`${output}/baseline.json`, 'utf8'))
const boardKey = 'routel-dashboard-board-v1:REGIONAL_ADMIN:7'
const savedLayout = {
  version: 2,
  order: ['summary', 'events', 'map', 'top5', 'todo', 'verify', 'health'], hidden: [],
  sizes: { summary: { width: 1000, height: 180 }, events: { width: 350, height: 560 }, map: { width: 650, height: 560 }, top5: { width: 500, height: 320 }, todo: { width: 250, height: 200 }, verify: { width: 250, height: 200 }, health: { width: 500, height: 200 } },
}
const facilities = Array.from({ length: 3 }, (_, i) => ({ id: i + 1, name: 'Facility ' + (i + 1), regionId: 1, regionName: '부산광역시', roadAddress: '부산광역시 중구 중앙대로', latitude: 35.104 + i * .006, longitude: 129.03 + i * .006, currentStatus: i === 1 ? 'BLOCKED' : 'NORMAL', currentRiskLevel: i === 1 ? 'DANGER' : 'CAUTION', currentRiskScore: 28 + i * 20, riskScore: 28 + i * 20, currentWaterCm: 8 + i, rainfallMm: 2, remainingCount: 2, pendingReviewCount: 1, manageable: true }))
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const origin = `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const captures = [], interactions = [], errors = []
try {
  const page = await browser.newPage()
  page.setDefaultTimeout(12000)
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('routel-session-kind', 'manager')
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    sessionStorage.setItem('routel-handover-seen:7:REGIONAL_ADMIN:0', today)
  })
  // Reuse the existing map SDK fixture rather than relying on external map keys.
  const mapFixture = (await readFile('tests/manager-map-overlay.mjs', 'utf8')).replaceAll('\r\n', '\n')
  const start = mapFixture.indexOf('await page.addInitScript(') + 'await page.addInitScript('.length
  const end = mapFixture.indexOf('\n  })\n  const rows', start) + 4
  assert(start > 0 && end > start, 'Shared map fixture must be available')
  await page.addInitScript({ content: '(' + mapFixture.slice(start, end) + ')();' + `
    window.kakao.maps.Map.prototype.getBounds=function(){return {contain:()=>true}};
    window.kakao.maps.Map.prototype.getProjection=function(){return {containerPointFromCoords:point=>({x:(point.lng-129)*10000,y:(35.2-point.lat)*10000})}};
    window.kakao.maps.LatLng.prototype.getLat=function(){return this.lat};
    window.kakao.maps.LatLng.prototype.getLng=function(){return this.lng};
    window.kakao.maps.event.preventMap=()=>{};
    window.kakao.maps.CustomOverlay=class {constructor(options){this.content=options.content;this.setMap(options.map)}setMap(map){this.content?.remove();if(map)map.host.append(this.content)}};
  ` })
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname
    let data = []
    if (path === '/api/managers/me') data = { id: 7, name: '부산 관리자', role: 'REGIONAL_ADMIN', regions: [{ id: 1, name: '부산광역시' }] }
    else if (path === '/api/customers/me') data = null
    else if (path.endsWith('unread-count')) data = { count: 0, total: 0, byCategory: {} }
    else if (path === '/api/dashboard/facility-kpi') data = { facilityCount: 45, blockedCount: 1, dangerLevelCount: 2, pendingReviewCount: 4, remainingCount: 3 }
    else if (path === '/api/dashboard/timeline') data = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, underpassId: i % 3 + 1, underpassName: '부산 시설 ' + (i + 1), eventType: i % 2 ? 'RISK_LEVEL_DOWN' : 'RISK_LEVEL_UP', riskLevel: i % 2 ? 'SAFE' : 'CAUTION', createdAt: `2026-10-23T12:${String(59 - i).padStart(2, '0')}:00` }))
    else if (path === '/api/dashboard/risk-margin') data = Array.from({ length: 5 }, (_, i) => ({ underpassId: i + 1, underpassName: ['장평지하차도', '부산진시장지하차도', '문현지하차도', '대남지하차도', '신선대지하차도'][i], riskScore: 65 - i * 8, margin: 5 + i * 8 }))
    else if (path === '/api/underpasses') data = { items: facilities, page: 1, size: 10, totalItems: 3, totalPages: 1 }
    else if (/^\/api\/underpasses\/\d+$/.test(path)) data = facilities.find(facility => facility.id === Number(path.split('/').at(-1)))
    else if (path.endsWith('/risk-scores')) data = Array.from({ length: 12 }, (_, i) => ({ riskScore: [20, 23, 21, 28, 31, 27, 35, 38, 36, 42, 39, 45][i], rainfallMm: 2, predictedAt: new Date(Date.now() - (11 - i) * 15 * 60 * 1000).toISOString() }))
    else if (path === '/api/weather') data = { temperature: 18, rainfall: 0, humidity: 60, condition: '맑음' }
    else if (path.endsWith('/notifications')) data = { items: [], page: 1, totalItems: 0, totalPages: 1 }
    return route.fulfill({ json: { success: true, data } })
  })

  async function openDashboard(layout, width) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(origin + '/admin-dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.evaluate(({ boardKey, savedLayout, layout }) => {
      if (layout === 'saved') localStorage.setItem(boardKey, JSON.stringify(savedLayout))
      else localStorage.removeItem(boardKey)
    }, { boardKey, savedLayout, layout })
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForFunction(() => document.querySelectorAll('.fixed-events .tl>li').length === 10)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(250)
    const handover = page.locator('dialog.admin-handover[open]')
    if (await handover.count()) await handover.getByRole('button', { name: '확인하고 닫기', exact: true }).click()
  }

  for (const layout of ['default', 'saved']) {
    for (const width of [390, 1440, 1920]) {
      await openDashboard(layout, width)
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => {
          document.documentElement.dataset.theme = theme
          window.scrollTo(0, 0)
          document.querySelectorAll('.backend-main,.page').forEach(node => { node.scrollTop = 0 })
        }, theme)
        await page.waitForTimeout(220)
        const geometry = await page.evaluate(() => {
          const grid = document.querySelector('.dashboard-fixed-layout')
          const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }
          return { grid: rect(grid), widgets: [...grid.querySelectorAll('.dashboard-fixed-item')].map(node => ({ id: [...node.classList].find(name => name.startsWith('fixed-')) || node.dataset.widgetId, ...rect(node) })) }
        })
        const check = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, region: document.querySelector('.fixed-map .map-top')?.textContent.trim(), selectedRegion: document.querySelector('[aria-label="부산 구·군 선택"]')?.textContent.includes('부산 전체'), widgetCount: document.querySelectorAll('.dashboard-fixed-item').length }))
        assert.equal(check.widgetCount, 7, 'Original seven widgets must remain')
        assert(check.region.includes('부산'), 'Dashboard must preserve the Busan jurisdiction')
        assert(check.selectedRegion, 'Busan region filter must remain available')
        assert(!check.overflow, `${layout} ${width}px ${theme} horizontal overflow`)
        const capture = { layout, width, theme, geometry, check }
        captures.push(capture)
        if (baseline) {
          const previous = baseline.captures.find(item => item.layout === layout && item.width === width && item.theme === theme)
          assert(previous, 'Matching pre-design baseline must exist')
          for (const widget of geometry.widgets) {
            const original = previous.geometry.widgets.find(item => item.id === widget.id)
            assert(original, `Existing widget ${widget.id} must remain`)
            for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(widget[key] - original[key]) <= 1, `${layout} ${width}px ${theme} ${widget.id}.${key}: before ${original[key]}, after ${widget[key]}`)
          }
        }
        await page.screenshot({ path: `${output}/${baselineMode ? 'before' : 'after'}-${layout}-${width}-${theme}.png`, fullPage: true })
        console.log(`PASS geometry ${layout} ${width}px ${theme}`)
      }
    }
  }
  await writeFile(`${output}/${baselineMode ? 'baseline' : 'geometry-results'}.json`, JSON.stringify({ captures, errors }, null, 2))
  if (!baselineMode) {
    await openDashboard('default', 1440)
    const list = page.getByRole('list', { name: '최근 이벤트 목록', exact: true })
    const head = page.locator('.fixed-events .wg-head')
    // Measure the actual scroll chain: the app can scroll its shell or the document.
    const outerScroll = () => page.evaluate(() => {
      const ancestors = new Set([document.scrollingElement])
      let node = document.querySelector('.fixed-events')?.parentElement
      while (node) { ancestors.add(node); node = node.parentElement }
      return [...ancestors].reduce((total, ancestor) => total + (ancestor?.scrollTop || 0), 0)
    })
    assert.equal(await list.locator(':scope > li').count(), 10, 'The first event page must show exactly ten entries')
    await list.evaluate(node => { node.scrollTop = 0 })
    await list.hover({ position: { x: 24, y: 32 } })
    const scrollRoom = await list.evaluate(node => node.scrollHeight - node.clientHeight)
    assert(scrollRoom > 10, 'Ten event entries must be reachable through the widget scroll area')
    const headerBefore = await head.boundingBox(), outerBefore = await outerScroll()
    await page.mouse.wheel(0, Math.min(160, scrollRoom / 2))
    await page.waitForTimeout(180)
    const innerScrollTop = await list.evaluate(node => node.scrollTop)
    assert(innerScrollTop > 0, 'Wheel input inside the event list must move its own scrollbar')
    assert(Math.abs((await head.boundingBox()).y - headerBefore.y) <= 1, 'Event title must stay fixed while its rows scroll')
    assert(Math.abs(await outerScroll() - outerBefore) <= 1, 'The outer page must stay still while the list has scroll room')
    await list.evaluate(node => { node.scrollTop = node.scrollHeight })
    await list.hover({ position: { x: 24, y: 32 } })
    const boundaryBefore = await outerScroll()
    await page.mouse.wheel(0, 220)
    await page.waitForTimeout(180)
    const boundaryAfter = await outerScroll()
    assert(boundaryAfter > boundaryBefore, 'At the list bottom, wheel input must continue down the surrounding page')
    interactions.push({ check: 'event-scroll', rows: 10, innerScrollTop, outerScrollDeltaAtBottom: boundaryAfter - boundaryBefore })
    const next = page.getByRole('button', { name: '최근 이벤트 다음 페이지', exact: true })
    const previous = page.getByRole('button', { name: '최근 이벤트 이전 페이지', exact: true })
    assert(await previous.isDisabled())
    await next.click()
    await page.waitForFunction(() => document.querySelector('.fixed-events .tl>li strong')?.textContent === '부산 시설 11')
    assert.equal(await list.locator(':scope > li').count(), 10, 'The second event page must show the next ten entries')
    assert.equal(await list.evaluate(node => node.scrollTop), 0, 'Changing event pages must reset the inner scrollbar')
    await next.click()
    await page.waitForFunction(() => document.querySelectorAll('.fixed-events .tl>li').length === 3)
    assert(await next.isDisabled())
    assert.equal(await list.locator('li strong').first().textContent(), '부산 시설 21', 'The last page must continue from event 21 without repeats')
    interactions.push({ check: 'event-pagination', pageSizes: [10, 10, 3], lastPageNextDisabled: true })
    console.log('PASS event scrolling and 10/10/3 pagination')

    // Select through the map's public marker interaction, then inspect the same
    // measured series used by the live panel instead of synthetic SVG probes.
    await page.locator('.test-map-marker').filter({ hasText: /^Facility 1(?:\s*·|$)/ }).click()
    const panel = page.getByRole('region', { name: '선택 시설', exact: true })
    await panel.locator('.manager-facility-heading').waitFor()
    await page.waitForFunction(() => document.querySelector('.manager-risk strong')?.textContent?.replace(/\s+/g, '') === '45.0점')
    assert.equal(await panel.locator('.manager-facility-heading>strong').textContent(), 'Facility 1')
    const readings = await panel.locator('dl').evaluate(node => Object.fromEntries([...node.querySelectorAll('dt')].map(term => [term.textContent.trim(), term.nextElementSibling?.textContent.trim()])))
    assert.equal(readings['현재 수위'], '8 cm', 'Selected facility water level must retain the API reading')
    assert.equal(readings['강수량'], '2 mm', 'Selected facility rainfall must retain the API reading')
    await panel.locator('summary').filter({ hasText: '관측 기록' }).click()
    const history = panel.getByRole('img', { name: '선택 시설 위험도 관측 기록', exact: true })
    await history.waitFor()
    assert.equal(await history.locator('.dashboard-chart-hover').count(), 12, 'All twelve observed samples must remain in the chart')
    assert.match(await history.locator('.dashboard-observed-line').getAttribute('d'), /^M.+L/, 'The observed series must contain a connected data path')
    assert.equal(await history.locator('.dashboard-chart-hover').last().getAttribute('cy'), '65', 'The last 45-point observation must use its real chart ordinate')
    assert.match(await history.locator('.dashboard-chart-hover').last().getAttribute('aria-label'), /위험 점수 45점$/, 'The newest observation must expose its measured value accessibly')
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
        await page.waitForTimeout(220)
        const stage = await page.locator('.manager-map-stage').boundingBox(), detail = await panel.boundingBox()
        assert(stage && detail, 'The selected facility panel and its map stage must be visible')
        assert(detail.x >= stage.x - 1 && detail.y >= stage.y - 1 && detail.x + detail.width <= stage.x + stage.width + 1 && detail.y + detail.height <= stage.y + stage.height + 1, `${width}px ${theme}: selected facility detail must stay within its map stage`)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}px ${theme}: facility detail must not cause horizontal page overflow`)
        await history.scrollIntoViewIfNeeded()
        await panel.screenshot({ path: `${output}/after-selected-facility-${width}-${theme}.png` })
        interactions.push({ check: 'selected-map-facility', width, theme, stage, detail, score: 45, observations: 12, readings })
        console.log(`PASS selected facility ${width}px ${theme}`)
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await panel.getByRole('button', { name: '시설 선택 해제', exact: true }).click()
    await page.getByRole('button', { name: '화면편집', exact: true }).click()
    await page.getByRole('complementary', { name: '위젯 리스트' }).getByRole('button', { name: /위험 추이/ }).click()
    await page.getByRole('button', { name: '위젯 리스트 닫기' }).click()
    const risk = page.locator('[data-widget-id="risk"]')
    await risk.getByLabel('위험 추이 시설', { exact: true }).selectOption('1')
    await risk.locator('svg[role="img"]').waitFor()
    assert((await risk.innerText()).includes('45'), 'Risk visualization must retain the observed score')
    const map = page.locator('.fixed-map'), grip = map.locator('.board-resize-right')
    await grip.scrollIntoViewIfNeeded()
    const initial = await map.boundingBox(), handle = await grip.boundingBox()
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2 - 37, handle.y + handle.height / 2, { steps: 5 })
    await page.mouse.up()
    const resized = await map.boundingBox()
    assert(Math.abs(initial.width - resized.width - 37) < 4, 'Small resize movement must remain precise')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    const saved = await page.evaluate(key => localStorage.getItem(key), boardKey)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.locator('.board-customized').waitFor()
    assert.equal(await page.evaluate(key => localStorage.getItem(key), boardKey), saved, 'Widget settings must survive reload unchanged')
    assert.equal(await page.locator('[data-widget-id="risk"]').count(), 1, 'Added risk widget must survive reload')
    await page.locator('[data-widget-id="risk"]').getByLabel('위험 추이 시설', { exact: true }).selectOption('1')
    await page.locator('[data-widget-id="risk"] svg[role="img"]').waitFor()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForTimeout(150)
    const moving = await page.evaluate(() => [...document.querySelectorAll('.water-dashboard *')].filter(node => {
      const style = getComputedStyle(node)
      return style.animationName !== 'none' && style.animationDuration.split(',').some(value => parseFloat(value) > .001)
    }).map(node => ({ tag: node.tagName, class: String(node.className), animation: getComputedStyle(node).animationName })))
    assert.deepEqual(moving, [], 'Reduced motion must stop decorative dashboard animations')
    await page.screenshot({ path: `${output}/after-custom-risk-reduced-motion.png`, fullPage: true })
    await writeFile(`${output}/interaction-results.json`, JSON.stringify({ interactions, errors }, null, 2))
  }
  assert.deepEqual(errors, [], 'Dashboard must have no runtime errors')
  console.log(JSON.stringify({ mode: baselineMode ? 'baseline' : 'verification', geometryConditions: captures.length, interactionConditions: interactions.length, errors: errors.length }, null, 2))
} finally {
  await browser.close()
  await server.close()
}
