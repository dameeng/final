import { chromium } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = process.env.INTERFACE_QA_ORIGIN ? null : await createServer({ configLoader:'runner', server:{host:'127.0.0.1',port:0,strictPort:false} })
await server?.listen()
const origin = process.env.INTERFACE_QA_ORIGIN || `http://127.0.0.1:${server.httpServer.address().port}`
const output = 'tests/design-preview/interface-refinements'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const errors = [], checks = []
const mapOnly = process.argv.includes('--map-only')
const facilities = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `부산 지하차도 ${i + 1}`, regionId: 1, regionName: '부산광역시', roadAddress: '부산광역시 중구 중앙대로', latitude: 35.104 + i * .001, longitude: 129.03 + i * .001, currentStatus: 'NORMAL', currentRiskLevel: i ? 'SAFE' : 'WARNING', currentRiskScore: 40.32, currentWaterCm: 8, manageable: true }))
try {
  const page = await browser.newPage()
  page.setDefaultTimeout(15000)
  page.setDefaultNavigationTimeout(60000)
  page.on('pageerror', error => errors.push({ path: page.url(), message: error.message }))
  await page.addInitScript(() => {
    localStorage.setItem('routel-session-kind', /^\/(?:admin|fac-|pm-)/.test(location.pathname) ? 'manager' : 'customer')
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    sessionStorage.setItem('routel-handover-seen:7:REGIONAL_ADMIN:0', today)
  })
  const fixture = (await readFile('tests/manager-map-overlay.mjs', 'utf8')).replaceAll('\r\n', '\n')
  const start = fixture.indexOf('await page.addInitScript(') + 'await page.addInitScript('.length
  const end = fixture.indexOf('\n  })\n  const rows', start) + 4
  assert(start > 0 && end > start)
  await page.addInitScript({ content: '(' + fixture.slice(start, end) + ')();' + `
    window.kakao.maps.Map.prototype.getBounds=function(){return {contain:()=>true}};
    window.kakao.maps.Map.prototype.getProjection=function(){return {containerPointFromCoords:point=>({x:(point.lng-129)*10000,y:(35.2-point.lat)*10000})}};
    window.kakao.maps.LatLng.prototype.getLat=function(){return this.lat};
    window.kakao.maps.LatLng.prototype.getLng=function(){return this.lng};
    window.kakao.maps.event.preventMap=()=>{};
    window.kakao.maps.CustomOverlay=class {constructor(options){this.content=options.content;this.setMap(options.map)}setMap(map){this.content?.remove();if(map)map.host.append(this.content)}};
  ` })
  let signedIn = true
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname
    const paginate = items => { const size = Number(url.searchParams.get('size') || 10), current = Number(url.searchParams.get('page') || 1); return { items: items.slice((current - 1) * size, current * size), page: current, size, totalItems: items.length, totalPages: Math.ceil(items.length / size) } }
    let data = []
    if (path === '/api/customers/me') { if (!signedIn) return route.fulfill({ status: 401, json: { success: false } }); data = { id: 8, name: '고객', loginId: 'customer', phone: '01000000000' } }
    else if (path === '/api/managers/me') data = { id: 7, name: '부산 관리자', role: 'REGIONAL_ADMIN', regions: [{ id: 1, name: '부산광역시' }] }
    else if (path.endsWith('unread-count')) data = { count: 0, total: 0, byCategory: {} }
    else if (path === '/api/regions') data = [{ id: 1, name: '부산광역시' }]
    else if (path === '/api/underpasses') data = paginate(facilities)
    else if (/^\/api\/underpasses\/\d+$/.test(path)) data = facilities.find(row => row.id === Number(path.split('/').at(-1)))
    else if (path.endsWith('/risk-scores')) data = [{ riskScore: 40.32, predictedAt: new Date().toISOString() }]
    else if (path === '/api/dashboard/facility-kpi') data = { facilityCount: 12, blockedCount: 0, dangerLevelCount: 0, pendingReviewCount: 0, remainingCount: 0 }
    else if (path === '/api/dashboard/risk-margin') data = facilities.slice(0, 5).map(row => ({ underpassId: row.id, underpassName: row.name, riskScore: 40.32, margin: 29.68 }))
    else if (path === '/api/weather') data = { temperature: 18, condition: '맑음' }
    else if (path.endsWith('/notifications') || path.endsWith('/alerts')) data = paginate([])
    return route.fulfill({ json: { success: true, data } })
  })
  async function open(path, width) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(origin + path, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.querySelector('#app')?.textContent.trim().length > 30)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(250)
    const handover = page.locator('dialog.admin-handover[open]')
    if (await handover.count()) await handover.getByRole('button', { name: '확인하고 닫기', exact: true }).click()
  }
  for (signedIn of mapOnly ? [] : [false, true]) for (const width of [320, 390, 768, 1280, 1440, 1920]) {
    await open('/info/company', width)
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
      await page.waitForTimeout(300)
      const geometry = await page.evaluate(() => {
        const nav = document.querySelector('.customer-main-nav').getBoundingClientRect()
        const header = document.querySelector('.customer-header').getBoundingClientRect()
        const controls = [...document.querySelectorAll('.customer-header a,.customer-header button')].filter(node => !node.closest('#customer-header-dropdown') && node.getClientRects().length)
        const blocked = controls.filter(node => { const r = node.getBoundingClientRect(); return !node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) }).map(node => node.textContent.trim() || node.getAttribute('aria-label'))
        return { center: nav.x + nav.width / 2, headerCenter: header.x + header.width / 2, viewport: document.documentElement.clientWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1, blocked, font: getComputedStyle(document.querySelector('.customer-menu-link')).fontSize }
      })
      assert(Math.abs(geometry.center - geometry.headerCenter) < 1, `Menu must stay centred inside the header (excluding the reserved scrollbar gutter): ${JSON.stringify(geometry)}`)
      assert.deepEqual(geometry.blocked, [], `Header controls must not overlap at ${width}`)
      assert.equal(geometry.overflow, false)
      checks.push({ kind: 'header', width, theme, signedIn, ...geometry })
    }
    if (signedIn && [390, 1440].includes(width)) await page.screenshot({ path: `${output}/header-${width}.png` })
    console.log(`PASS header ${width} signedIn=${signedIn}`)
  }
  for (const path of mapOnly ? [] : ['/admin-dashboard', '/fac-list', '/pm-equipment', '/admin-app/screen-3']) {
    for (const width of [390, 1440]) {
      await open(path, width)
      const toggle = page.getByRole('button', { name: /라이트·다크/ }).first()
      await toggle.waitFor()
      const before = await page.locator('html').getAttribute('data-theme')
      await toggle.click()
      const after = await page.locator('html').getAttribute('data-theme')
      assert.notEqual(after, before)
      assert.equal(await page.evaluate(() => localStorage.getItem('routel-theme')), after)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await toggle.waitFor()
      assert.equal(await page.locator('html').getAttribute('data-theme'), after)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      checks.push({ kind: 'admin-theme', path, width, after })
      if (path === '/admin-dashboard') {
        await page.locator('.fixed-top5 .rank .sc').first().waitFor()
        const sizes = await page.locator('.fixed-top5 .rank,.fixed-top5 .widget-original-content,.fixed-top5 .rank li').evaluateAll(nodes => nodes.map(node => ({ class: node.className, width: node.clientWidth, scroll: node.scrollWidth })))
        assert(sizes.every(row => row.scroll <= row.width + 1), JSON.stringify(sizes))
        assert.equal(await page.locator('.fixed-top5 .rank .sc').first().innerText(), '40.32')
        await page.locator('.fixed-top5').screenshot({ path: `${output}/risk-${width}.png` })
      }
      console.log(`PASS theme ${path} ${width}`)
    }
  }
  for (const path of ['/c-map', '/customer-app/screen-5']) for (const width of [390, 1440]) {
    await open(path, width)
    if (path.includes('customer-app')) await page.locator('.mobile-sheet-handle').click()
    await page.locator('.facility-list-panel .lst>li').first().waitFor()
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
      await page.waitForTimeout(300)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      await page.screenshot({ path: `${output}/map-${path.includes('customer-app') ? 'app' : 'web'}-${width}-${theme}.png` })
      const weatherPaint = await page.evaluate(() => ({weather:getComputedStyle(document.querySelector('.map-weather-marker')).backgroundColor,panel:getComputedStyle(document.querySelector('.facility-list-panel')).backgroundColor}))
      assert.equal(weatherPaint.weather, weatherPaint.panel, 'Weather control must use the same light/dark surface as its map panel')
      checks.push({ kind: 'map', path, width, theme })
    }
    if (path === '/c-map') {
      await page.locator('.facility-list-panel .lst .it').first().click()
      await page.locator('.swapped-detail .nm').waitFor()
      await page.getByRole('button', { name: '상세 접기 ▴', exact: true }).click()
      await page.getByRole('button', { name: '상세 펼치기 ▾', exact: true }).click()
      await page.getByRole('button', { name: '목록으로', exact: true }).click()
      await page.locator('.facility-list-panel').waitFor()
    }
    console.log(`PASS map ${path} ${width}`)
  }
  await writeFile(`${output}/${mapOnly ? 'map-final-results' : 'results'}.json`, JSON.stringify({ checks, errors }, null, 2))
  assert.deepEqual(errors, [])
  console.log(`PASS ${checks.length} checks, no runtime errors`)
} finally { await browser.close(); await server?.close() }
