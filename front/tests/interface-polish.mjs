import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

// Representative production page families; no real backend writes are performed.
const routes = [
  '/fac-list', '/fac-new', '/fac-detail?id=1', '/admin-data/ocr', '/admin-data/reviews',
  '/admin-data/notices', '/admin-data/inquiries', '/admin-reports?report=timeline',
  '/pm-equipment', '/pm-equipment-detail?id=P-01', '/pm-history', '/jurisdiction-contacts',
  '/admin-profile', '/admin-login', '/admin-data/thresholds',
  '/admin-app/screen-3', '/admin-app/screen-4', '/admin-app/ocr', '/admin-app/screen-9',
  '/admin-app/history', '/admin-app/notifications', '/admin-app/screen-14',
  '/', '/c-notice', '/my-home', '/info/app-guide', '/customer-app/notices',
  '/customer-app/account/profile',
]
const narrowRoutes = ['/fac-list', '/fac-new', '/admin-app/notifications', '/customer-app/account/profile']
const output = 'tests/design-preview/interface-polish'
const cssNames = ['admin-interface.css', 'overlay-polish.css', 'interface-motion.css']
const baselineMode = process.argv.includes('--baseline')
const pmPreview = process.argv.includes('--pm-preview')
const badgesOnly = process.argv.includes('--badges-only') || pmPreview
const countersOnly = process.argv.includes('--counters-only')
const results = [], overlays = [], errors = [], requests = []
await mkdir(output, { recursive: true })
const server = process.env.INTERFACE_QA_ORIGIN ? null : await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server?.listen()
const origin = process.env.INTERFACE_QA_ORIGIN || `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch({ channel: 'msedge', headless: true })

const facilities = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, name: `부산 시설 ${i + 1}`, regionId: 1, regionName: '부산광역시', roadAddress: '부산광역시 중구 중앙대로', latitude: 35.104 + i * .001, longitude: 129.03 + i * .001, currentStatus: 'NORMAL', currentRiskLevel: i % 3 === 0 ? 'SAFE' : i % 3 === 1 ? 'WARNING' : 'DANGER', currentRiskScore: 20 + i * 2, riskScore: 20 + i * 2, currentWaterCm: 8, rainfallMm: 2, remainingCount: 2, pendingReviewCount: 1, manageable: true }))
const records = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, title: `시설 안전 점검 및 서비스 안내 ${i + 1}`, name: `부산 시설 ${i + 1}`, question: '지하차도 정보를 확인하는 방법은 무엇인가요?', answer: '지하차도 현황에서 시설을 선택해 확인할 수 있습니다.', content: '시설별 안전 상태와 운영 정보를 확인해 주세요.', body: '시설별 안전 상태와 운영 정보를 확인해 주세요.', category: 'NOTICE', status: 'PENDING', read: false, important: i === 0, viewCount: 23 - i, underpassId: i % 3 + 1, underpassName: `부산 시설 ${i % 3 + 1}`, detectedNum: '123가4567', recognitionStatus: 'SUCCESS', reviewStatus: 'PENDING', confidence: .99, createdAt: '2026-10-23T12:00:00', detectedAt: '2026-10-23T12:00:00' }))

try {
  const page = await browser.newPage()
  page.setDefaultTimeout(12000)
  page.setDefaultNavigationTimeout(30000)
  page.on('pageerror', error => errors.push({ path: new URL(page.url()).pathname, message: error.message }))
  await page.addInitScript(() => {
    const manager = /^\/(?:admin|fac-|pm-|cs-|bot-|jurisdiction-contacts)/.test(location.pathname)
    localStorage.setItem('routel-session-kind', manager ? 'manager' : 'customer')
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    sessionStorage.setItem('routel-handover-seen:7:REGIONAL_ADMIN:0', today)
  })
  // The same Kakao fixture as water-dashboard.mjs, including current viewport APIs.
  const fixture = (await readFile('tests/manager-map-overlay.mjs', 'utf8')).replaceAll('\r\n', '\n')
  const start = fixture.indexOf('await page.addInitScript(') + 'await page.addInitScript('.length
  const end = fixture.indexOf('\n  })\n  const rows', start) + 4
  assert(start > 0 && end > start)
  const mapSource = fixture.slice(start, end).replaceAll("options.title.includes('Facility 1')", "options.title.startsWith('부산 시설 1 ·')").replaceAll("options.title.includes('Facility 2')", "options.title.startsWith('부산 시설 2 ·')")
  await page.addInitScript({ content: '(' + mapSource + ')();' + `
    window.kakao.maps.Map.prototype.getBounds=function(){return {contain:()=>true}};
    window.kakao.maps.Map.prototype.getProjection=function(){return {containerPointFromCoords:point=>({x:(point.lng-129)*10000,y:(35.2-point.lat)*10000})}};
    window.kakao.maps.LatLng.prototype.getLat=function(){return this.lat};
    window.kakao.maps.LatLng.prototype.getLng=function(){return this.lng};
    window.kakao.maps.event.preventMap=()=>{};
    window.kakao.maps.CustomOverlay=class {constructor(options){this.content=options.content;this.setMap(options.map)}setMap(map){this.content?.remove();if(map)map.host.append(this.content)}};
  ` })
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname
    requests.push({ path, search: url.search, method: route.request().method() })
    const paginate = items => {
      const size = Number(url.searchParams.get('size') || 10), current = Number(url.searchParams.get('page') || 1)
      return { items: items.slice((current - 1) * size, current * size), page: current, size, totalItems: items.length, totalPages: Math.ceil(items.length / size) }
    }
    let data = []
    if (path === '/api/managers/me') data = { id: 7, name: '부산 관리자', loginId: 'manager', phone: '01000000000', email: 'manager@example.test', role: 'REGIONAL_ADMIN', regions: [{ id: 1, name: '부산광역시' }] }
    else if (path === '/api/customers/me') data = { id: 8, name: '김사용', loginId: 'customer', phone: '01000000000', email: 'customer@example.test', emergency: '01000000001', zipcode: '48900', roadAddress: '부산광역시 중구 중앙대로', detailAddress: '101호' }
    else if (path.endsWith('unread-count')) data = { count: 0, total: 0, byCategory: {} }
    else if (path === '/api/regions') data = [{ id: 1, name: '부산광역시' }]
    else if (path === '/api/underpasses') data = paginate(facilities)
    else if (/^\/api\/underpasses\/\d+$/.test(path)) data = facilities.find(row => row.id === Number(path.split('/').at(-1)))
    else if (path.endsWith('/risk-scores')) data = Array.from({ length: 12 }, (_, i) => ({ riskScore: 20 + i * 2, rainfallMm: 2, predictedAt: new Date(Date.now() - (11 - i) * 900000).toISOString() }))
    else if (path === '/api/dashboard/facility-kpi') data = { facilityCount: 23, blockedCount: 0, dangerLevelCount: 2, pendingReviewCount: 4, remainingCount: 3, alertsToday: 0 }
    else if (path === '/api/dashboard/region-risk-level') data = [{ regionName: '부산광역시', safeCount: 15, warningCount: 6, dangerCount: 2 }]
    else if (path === '/api/dashboard/timeline') data = records.map((row, i) => ({ ...row, eventType: i % 2 ? 'RISK_LEVEL_DOWN' : 'RISK_LEVEL_UP', riskLevel: i % 2 ? 'SAFE' : 'WARNING' }))
    else if (path === '/api/dashboard/risk-margin') data = facilities.slice(0, 5).map((row, i) => ({ underpassId: row.id, underpassName: row.name, riskScore: 65 - i * 8, margin: 5 + i * 8 }))
    else if (path === '/api/weather' || path === '/api/navigation/weather') data = { temperature: 18, rainfall: 0, humidity: 60, condition: '맑음', observedAt: new Date().toISOString() }
    else if (['/api/notices', '/api/faqs', '/api/plate-logs', '/api/inquiries', '/api/managers/me/notifications', '/api/customers/me/notifications', '/api/customers/me/inquiries', '/api/customers/me/alerts'].includes(path)) data = paginate(records)
    else if (/^\/api\/(?:notices|inquiries|plate-logs)\/\d+$/.test(path)) data = records.find(row => row.id === Number(path.split('/').at(-1)))
    return route.fulfill({ json: { success: true, data } })
  })

  async function open(path, width) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(origin + path, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.querySelector('#app')?.textContent.trim().length > 30)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(220)
    assert.equal(new URL(page.url()).pathname, new URL(path, origin).pathname, `${path}: route must not redirect to login`)
    const handover = page.locator('dialog.admin-handover[open]')
    if (await handover.count()) await handover.getByRole('button', { name: '확인하고 닫기', exact: true }).click()
  }
  async function theme(value) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value }, value)
    await page.waitForTimeout(200)
  }
  async function snapshot() {
    return page.evaluate(({ cssNames, baselineMode }) => {
      const freeze = document.createElement('style')
      freeze.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'
      document.head.append(freeze)
      const visible = node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden' && Number(getComputedStyle(node).opacity) !== 0
      const sheets = [...document.querySelectorAll('style[data-vite-dev-id]')].filter(node => cssNames.some(name => node.dataset.viteDevId.endsWith('/' + name)))
      if (!baselineMode && sheets.length < 3) throw new Error('All three interface polish stylesheets must be loaded')
      const selectors = 'main,.backend-header,.manager-app-header,.manager-app-titlebar,.manager-app-brandbar,.manager-app-bottom-nav,.admin-app-bottom-nav,.service-workspace,.customer-page-body'
      const nodes = [...document.querySelectorAll(selectors)].filter(node => visible(node) && !node.closest('dialog,.customer-notification-popup,.manager-map-panel') && !(node.tagName === 'MAIN' && node.parentElement.closest('main')))
      const geometry = () => nodes.map(node => {
        const box = node.getBoundingClientRect(), style = getComputedStyle(node)
        return { node: node.tagName + '.' + String(node.className), x: box.x, y: box.y, width: box.width, height: box.height, display: style.display, position: style.position, flexDirection: style.flexDirection, gridAutoFlow: style.gridAutoFlow }
      })
      const enabled = geometry()
      sheets.forEach(node => { node.sheet.disabled = true })
      const previous = geometry()
      sheets.forEach(node => { node.sheet.disabled = false })
      const differences = enabled.flatMap((node, index) => {
        const properties = ['x', 'y', 'width', 'display', 'position', 'flexDirection', 'gridAutoFlow']
        if (/header|titlebar|brandbar|bottom-nav/.test(node.node)) properties.push('height')
        const changes = properties.filter(key => typeof node[key] === 'number' ? Math.abs(node[key] - previous[index][key]) > 1 : node[key] !== previous[index][key])
        return changes.length ? [{ node: node.node, changes, enabled: node, previous: previous[index] }] : []
      })
      const label = node => {
        const clone = node.cloneNode(true)
        // Notification counters intentionally float outside an icon button's box;
        // they are separate badges, not clipped button labels.
        clone.querySelectorAll('.count,.header-alert-count,[aria-hidden="true"]').forEach(child => child.remove())
        return clone.textContent.trim()
      }
      const controls = [...document.querySelectorAll('button,a.btn')].filter(node => visible(node) && !node.matches('.test-map-marker') && label(node))
      const clipped = controls.filter(node => node.clientHeight > 20 && (node.scrollHeight > node.clientHeight + 3 || node.scrollWidth > node.clientWidth + 3)).map(node => ({ text: label(node), class: node.className, width: node.clientWidth, height: node.clientHeight, scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight }))
      const canvas = document.createElement('canvas'), context = canvas.getContext('2d')
      canvas.width = canvas.height = 1
      const color = value => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data] }
      const composite = (foreground, background) => foreground.slice(0, 3).map((channel, index) => channel * foreground[3] / 255 + background[index] * (1 - foreground[3] / 255))
      const luminance = rgb => rgb.map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0)
      const contrast = [...document.querySelectorAll('main h1,main h2,main th,main td,main .sub,main .service-readonly,.customer-page-body h1')].filter(node => visible(node) && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim())).slice(0, 24).flatMap(node => {
        const ancestors = []; let current = node
        while (current) { ancestors.unshift(current); current = current.parentElement }
        if (ancestors.some(ancestor => getComputedStyle(ancestor).backgroundImage !== 'none' || Number(getComputedStyle(ancestor).opacity) < 1)) return []
        let background = [255, 255, 255]
        for (const ancestor of ancestors) background = composite(color(getComputedStyle(ancestor).backgroundColor), background)
        const style = getComputedStyle(node), foreground = composite(color(style.color), background)
        const light = luminance(foreground), dark = luminance(background), ratio = (Math.max(light, dark) + .05) / (Math.min(light, dark) + .05)
        return [{ text: node.textContent.trim().slice(0, 70), ratio: Math.round(ratio * 100) / 100, minimum: parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700 ? 3 : 4.5 }]
      })
      const result = { geometry: enabled, differences, overflow: document.documentElement.scrollWidth > innerWidth + 1, clipped, controls: controls.length, contrast, fontLoaded: [...document.fonts].some(face => face.family.replaceAll('"', '').replaceAll("'", '') === 'Pretendard' && face.status === 'loaded') }
      freeze.remove()
      return result
    }, { cssNames, baselineMode })
  }

  for (const width of badgesOnly || countersOnly ? [] : [390, 1440, 320, 768]) {
    for (const path of width === 390 || width === 1440 ? routes : narrowRoutes) {
      await open(path, width)
      for (const mode of ['light', 'dark']) {
        await theme(mode)
        const check = await snapshot()
        results.push({ path, width, theme: mode, ...check })
        assert(check.fontLoaded, `${path}: the local Pretendard font must load`)
        if ([390, 1440].includes(width) && ['/fac-list', '/fac-new', '/pm-equipment', '/admin-app/notifications', '/admin-profile', '/', '/my-home'].includes(path)) {
          await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('.backend-main,.page,.app-service-content').forEach(node => { node.scrollTop = 0 }) })
          await page.waitForTimeout(200)
          await page.screenshot({ path: `${output}/${baselineMode ? 'before' : 'after'}-${path.replaceAll('/', '_')}-${width}-${mode}.png` })
        }
        console.log(`CHECK ${path} ${width}px ${mode}`)
      }
    }
  }

  if (!baselineMode && !badgesOnly && !countersOnly) {
    // Preserve list paging and a real existing filter without submitting mutations.
    await open('/admin-data/notices', 1440)
    const pager = page.locator('.service-pagination')
    await pager.getByRole('button', { name: '다음', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.service-pagination')?.textContent.includes('2 /'))
    assert.equal(await page.locator('.service-table tbody tr').count(), 10)
    await open('/fac-list', 1440)
    const safe = page.getByRole('group', { name: '위험 단계' }).getByRole('button', { name: '안전', exact: true })
    await safe.click()
    assert.equal(await safe.getAttribute('aria-pressed'), 'true')
    await page.waitForFunction(() => [...document.querySelectorAll('.restored-facilities tbody .badge')].every(node => node.textContent.includes('안전')))

    // Four real overlay families, two themes each. Padding and the facility title
    // row are authorized changes, so only viewport bounds and usability are checked.
    for (const kind of ['service-modal', 'legacy-dialog', 'notification', 'map-detail']) {
      const path = kind === 'service-modal' ? '/admin-data/notices' : kind === 'legacy-dialog' ? '/pm-equipment-detail?id=P-01' : kind === 'notification' ? '/my-home' : '/admin-dashboard'
      const width = kind === 'service-modal' || kind === 'notification' ? 390 : 1440
      await open(path, width)
      for (const mode of ['light', 'dark']) {
        await theme(mode)
        let overlay, trigger
        if (kind === 'service-modal') {
          trigger = page.getByRole('button', { name: '새로 등록', exact: true })
          await trigger.click()
          overlay = page.locator('dialog.service-modal[open]')
        } else if (kind === 'legacy-dialog') {
          trigger = page.locator('#d-reg')
          await trigger.click()
          overlay = page.locator('dialog#reg[open]')
        } else if (kind === 'notification') {
          trigger = page.locator('.notification-bell>button').first()
          await trigger.click()
          overlay = page.getByRole('dialog', { name: '최근 알림', exact: true })
        } else {
          await page.locator('.test-map-marker').filter({ hasText: /^부산 시설 1(?:\s*·|$)/ }).first().click()
          overlay = page.getByRole('region', { name: '선택 시설', exact: true })
          await overlay.locator('.manager-facility-heading').waitFor()
          const title = overlay.locator('.manager-facility-heading>strong'), toggle = overlay.locator('.manager-detail-toggle')
          const titleBox = await title.boundingBox(), toggleBox = await toggle.boundingBox()
          assert(toggleBox.x >= titleBox.x + titleBox.width - 1 && Math.abs((titleBox.y + titleBox.height / 2) - (toggleBox.y + toggleBox.height / 2)) <= 8, 'Facility collapse control must sit to the right of the facility name')
          await toggle.focus()
          await page.keyboard.press('Enter')
          assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
          assert.equal(await overlay.locator('#manager-map-panel-body').isVisible(), false)
          await page.keyboard.press('Enter')
          assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
          assert(await overlay.locator('#manager-map-panel-body').isVisible())
        }
        await overlay.waitFor()
        await page.waitForTimeout(200)
        const box = await overlay.boundingBox()
        if (kind === 'map-detail') {
          const stage = await page.locator('.manager-map-stage').boundingBox()
          assert(box.x >= stage.x - 1 && box.y >= stage.y - 1 && box.x + box.width <= stage.x + stage.width + 1 && box.y + box.height <= stage.y + stage.height + 1, 'Facility panel must stay inside its map')
        } else assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= 901, `${kind}: overlay must fit its viewport`)
        await overlay.screenshot({ path: `${output}/${kind}-${mode}.png` })
        if (kind === 'map-detail') await overlay.getByRole('button', { name: '시설 선택 해제', exact: true }).click()
        else {
          await page.keyboard.press('Escape')
          await overlay.waitFor({ state: 'hidden' })
          if (kind === 'notification') assert(await trigger.evaluate(node => document.activeElement === node), 'Escape must return notification focus to its trigger')
          await trigger.click()
          await overlay.waitFor()
          await overlay.getByRole('button', { name: kind === 'notification' ? '알림 창 닫기' : '닫기', exact: true }).click()
          await overlay.waitFor({ state: 'hidden' })
        }
        if (kind === 'legacy-dialog') {
          const bell = page.locator('#bell-btn'), popup = page.locator('#bell-pop')
          await bell.click()
          await popup.waitFor({ state: 'visible' })
          await page.waitForTimeout(200)
          const readAll = popup.getByRole('button', { name: '모두 읽음', exact: true })
          const paint = await readAll.evaluate(node => {
            const style = getComputedStyle(node)
            const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number)
            const light = value => rgb(value).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0)
            const foreground = light(style.color), background = light(style.backgroundColor)
            return { color: style.color, background: style.backgroundColor, ratio: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) }
          })
          assert(paint.ratio >= 4.5, `${mode}: legacy notification action must stay readable against its own surface`)
          const bounds = await popup.boundingBox()
          assert(bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= 901, 'Legacy notification popup must fit inside the viewport')
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
          await popup.screenshot({ path: `${output}/legacy-notification-${mode}.png` })
          await bell.click()
          await popup.waitFor({ state: 'hidden' })
          assert.equal(await bell.getAttribute('aria-expanded'), 'false')
        }
        overlays.push({ kind, path, width, theme: mode, bounds: box })
        console.log(`PASS ${kind} ${mode}`)
      }
    }
    for (const path of ['/', '/c-notice', '/customer-app/account/profile', '/admin-profile']) {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await open(path, 390)
      const moving = await page.evaluate(() => [...document.querySelectorAll('#app *,body>.customer-notification-popup')].flatMap(node => {
        const style = getComputedStyle(node)
        return style.animationName !== 'none' && style.animationDuration.split(',').some(value => parseFloat(value) > .001) ? [{ node: node.tagName + '.' + String(node.className), animation: style.animationName, duration: style.animationDuration }] : []
      }))
      assert.deepEqual(moving, [], `${path}: reduced motion must stop decorative animation`)
    }
  }
  if (badgesOnly) {
    for (const width of pmPreview ? [1440] : [390, 1440]) for (const path of pmPreview ? ['/pm-equipment'] : ['/fac-list', '/pm-equipment']) {
      await open(path, width)
      await theme('dark')
      const check = await snapshot()
      const badges = await page.evaluate(() => [...document.querySelectorAll('.badge.safe,.badge.warn,.badge.danger,.risk-level-badge')].filter(node => node.getClientRects().length).map(node => {
        const style = getComputedStyle(node)
        const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number)
        const light = value => rgb(value).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0)
        const foreground = light(style.color), background = light(style.backgroundColor)
        return { label: node.textContent.trim(), class: node.className, color: style.color, background: style.backgroundColor, ratio: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) }
      }))
      if (path === '/pm-equipment') {
        const counter = await page.locator('#bell-count').evaluate(node => ({ position: getComputedStyle(node).position, overflow: getComputedStyle(node.parentElement).overflow, x: node.getBoundingClientRect().x, right: node.getBoundingClientRect().right, viewport: innerWidth }))
        assert.equal(counter.position, 'absolute', 'Legacy notification count must remain a separate floating badge')
        assert.equal(counter.overflow, 'visible', 'The icon button must not clip its floating notification count')
        assert(counter.x >= 0 && counter.right <= counter.viewport, 'Floating notification count must remain inside the viewport')
      }
      assert(badges.length, `${path}: real status badges must render`)
      results.push({ path, width, theme: 'dark', ...check, badges })
      await page.waitForTimeout(200)
      await page.screenshot({ path: `${output}/badge-final-${path.replaceAll('/', '_')}-${width}-dark.png` })
      if (path === '/pm-equipment' && width === 1440) {
        await theme('light')
        await page.screenshot({ path: `${output}/badge-final-_pm-equipment-1440-light.png` })
      }
      console.log(`CHECK updated badges ${path} ${width}px`)
    }
  }
  if (countersOnly) {
    for (const width of [390, 1440]) for (const path of ['/pm-equipment', '/pm-equipment-detail?id=P-01', '/pm-history']) {
      await open(path, width)
      for (const mode of ['light', 'dark']) {
        await theme(mode)
        const check = await snapshot()
        const counter = await page.locator('#bell-count').evaluate(node => {
          const rect = element => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height } }
          const bounds = rect(node), button = node.parentElement, user = document.querySelector('.hdr .user'), userBounds = user?.getClientRects().length ? rect(user) : null
          const clippedBy = []
          let ancestor = button
          while (ancestor) {
            const style = getComputedStyle(ancestor), box = rect(ancestor)
            if (/hidden|clip|auto|scroll/.test(style.overflowX) && (bounds.x < box.x - 1 || bounds.right > box.right + 1) || /hidden|clip|auto|scroll/.test(style.overflowY) && (bounds.y < box.y - 1 || bounds.bottom > box.bottom + 1)) clippedBy.push({ node: ancestor.tagName + '.' + String(ancestor.className), box, overflowX: style.overflowX, overflowY: style.overflowY })
            ancestor = ancestor.parentElement
          }
          const intersectsUser = userBounds && Math.min(bounds.right, userBounds.right) > Math.max(bounds.x, userBounds.x) && Math.min(bounds.bottom, userBounds.bottom) > Math.max(bounds.y, userBounds.y)
          return { position: getComputedStyle(node).position, overflow: getComputedStyle(button).overflow, bounds, userBounds, intersectsUser: Boolean(intersectsUser), clippedBy, viewportWidth: innerWidth }
        })
        assert.equal(counter.position, 'absolute')
        assert.equal(counter.overflow, 'visible')
        assert.deepEqual(counter.clippedBy, [], `${path} ${width}px: notification count must not be clipped by an ancestor`)
        assert.equal(counter.intersectsUser, false, `${path} ${width}px: notification count must not overlap the manager name`)
        assert(counter.bounds.x >= 0 && counter.bounds.right <= width, 'Notification count must fit the viewport')
        results.push({ path, width, theme: mode, ...check, counter })
        await page.locator('.wire-page>.hdr').screenshot({ path: `${output}/counter-${path.replaceAll('/', '_').replaceAll('?', '_').replaceAll('=', '_')}-${width}-${mode}.png` })
        console.log(`PASS floating counter ${path} ${width}px ${mode}`)
      }
    }
  }
  const summary = { checks: results.length, overlayChecks: overlays.length, results, overlays, errors, mutations: requests.filter(request => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) }
  await writeFile(`${output}/${pmPreview ? 'pm-preview-results' : countersOnly ? 'counter-results' : badgesOnly ? 'badge-results' : baselineMode ? 'baseline' : 'results'}.json`, JSON.stringify(summary, null, 2))
  assert.equal(results.length, pmPreview ? 1 : countersOnly ? 12 : badgesOnly ? 4 : 128)
  assert.deepEqual(errors, [], 'Pages must not throw runtime errors')
  assert.deepEqual(results.filter(row => row.differences.length), [], 'New CSS must preserve page and pane positions')
  assert.deepEqual(results.filter(row => row.overflow), [], 'Pages must not overflow horizontally')
  assert.deepEqual(results.filter(row => row.clipped.length), [], 'Visible button labels must remain unclipped')
  if (badgesOnly) assert.deepEqual(results.flatMap(row => row.badges.filter(badge => badge.ratio < 4.5).map(badge => ({ path: row.path, width: row.width, ...badge }))), [], 'Updated status badges must meet 4.5:1 text contrast')
  assert.deepEqual(results.flatMap(row => row.theme === 'dark' ? row.contrast.filter(sample => sample.ratio + .05 < sample.minimum).map(sample => ({ path: row.path, width: row.width, ...sample })) : []), [], 'Sampled dark-mode body text must remain readable')
  if (countersOnly) {
    const recorded = JSON.parse(await readFile(`${output}/results.json`, 'utf8'))
    const key = row => `${row.path}:${row.width}:${row.theme}`
    const replacements = new Map(results.map(row => [key(row), row]))
    const reviewed = { ...recorded, results: recorded.results.map(row => replacements.get(key(row)) || row), review: { reason: 'The original label check counted a separately positioned notification badge as button text. The twelve affected conditions were rerun with separate counter clipping/overlap checks; the original results file is retained.', repeatedConditions: results.length, originalCounterFindings: recorded.results.filter(row => replacements.has(key(row))).map(row => ({ path: row.path, width: row.width, theme: row.theme, clipped: row.clipped })) } }
    assert.deepEqual(reviewed.results.filter(row => row.clipped.length || row.overflow || row.differences.length), [], 'The reviewed 128 conditions must have no clipping, page overflow or layout changes')
    assert.deepEqual(reviewed.errors, [])
    await writeFile(`${output}/reviewed-results.json`, JSON.stringify(reviewed, null, 2))
  }
  console.log(JSON.stringify({ checks: results.length, overlayChecks: overlays.length, runtimeErrors: errors.length }, null, 2))
} finally {
  await browser.close()
  await server?.close()
}
