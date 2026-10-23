import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

// This suite permits the newly authorized customer layout changes while checking
// that the map and administrator screens remain entirely outside the new theme.
const customerPaths = ['/', '/info/company', '/info/vision', '/info/app-guide', '/info/its', '/info/kma', '/info/straffic', '/c-notice', '/info/faq', '/login', '/signup', '/password-reset', '/find-id', '/my-home', '/my-alerts', '/my-inquiries', '/my-inquiry-new', '/my-withdraw', '/customer-app/notices', '/customer-app/account/profile', '/customer-app/account/settings']
const protectedPaths = ['/c-map', '/c-live-map', '/customer-app/screen-5', '/admin-dashboard']
const screenshotPaths = ['/', '/info/company', '/info/app-guide', '/info/its', '/c-notice', '/info/faq', '/login', '/my-home', '/customer-app/notices', '/customer-app/account/profile']
const output = 'tests/design-preview/customer-premium'
const results = [], isolation = [], errors = [], assets = new Set()
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const origin = `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch({ channel: 'msedge', headless: true })
await mkdir(output, { recursive: true })
try {
  const page = await browser.newPage()
  page.setDefaultTimeout(12000)
  page.on('pageerror', error => errors.push({ path: new URL(page.url()).pathname, message: error.message }))
  await page.addInitScript(() => {
    localStorage.setItem('routel-session-kind', location.pathname.startsWith('/admin') ? 'manager' : 'customer')
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    sessionStorage.setItem('routel-handover-seen:7:REGIONAL_ADMIN:0', today)
  })
  // Same envelope, one-based pagination and production field names as reference-finish.mjs.
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname
    let data = []
    if (path === '/api/managers/me') data = { id: 7, name: '관리자', role: 'REGIONAL_ADMIN', regions: [] }
    else if (path === '/api/customers/me') data = { id: 8, name: '김사용', loginId: 'customer', phone: '01000000000', email: 'customer@example.test', emergency: '01000000001', zipcode: '48900', roadAddress: '부산광역시 중구 중앙대로', detailAddress: '101호' }
    else if (path.endsWith('unread-count')) data = { count: 0, total: 0, byCategory: {} }
    else if (path.endsWith('facility-kpi')) data = { facilityCount: 23, blockedCount: 1, dangerLevelCount: 2, pendingReviewCount: 4, remainingCount: 3 }
    else if (path === '/api/dashboard/timeline') data = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, underpassId: i % 5 + 1, underpassName: '부산진시장지하차도', eventType: i % 2 ? 'RISK_LEVEL_DOWN' : 'RISK_LEVEL_UP', riskLevel: i % 2 ? 'SAFE' : 'CAUTION', createdAt: '2026-10-23T12:00:00' }))
    else if (path === '/api/dashboard/risk-margin') data = Array.from({ length: 5 }, (_, i) => ({ underpassId: i + 1, underpassName: '부산진시장지하차도', riskScore: 65 - i * 8, margin: 5 + i * 8 }))
    else if (['/api/notices', '/api/faqs', '/api/customers/me/notifications', '/api/customers/me/inquiries', '/api/customers/me/alerts', '/api/inquiries'].includes(path)) {
      const size = Number(url.searchParams.get('size') || 10), current = Number(url.searchParams.get('page') || 1)
      const items = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, title: '시설 안전 점검 및 서비스 운영 안내 ' + (i + 1), question: '안전 정보를 확인하는 방법은 무엇인가요?', answer: '지하차도 현황에서 시설을 선택해 확인해 주세요.', content: '지하차도 현황과 통제 정보를 확인해 주세요.', body: '지하차도 현황과 통제 정보를 확인해 주세요.', category: 'NOTICE', status: 'PENDING', read: true, viewCount: 23 - i, important: i === 0, createdAt: '2026-10-23T12:00:00' }))
      data = { items: items.slice((current - 1) * size, current * size), page: current, size, totalItems: 23, totalPages: Math.ceil(23 / size) }
    }
    return route.fulfill({ json: { success: true, data } })
  })

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of [...customerPaths, ...protectedPaths]) {
      await page.goto(origin + path)
      await page.locator('#app').waitFor()
      await page.waitForTimeout(250)
      await page.evaluate(() => document.fonts.ready)
      assert.equal(new URL(page.url()).pathname, path, `${path} must render the requested route`)
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
        await page.waitForTimeout(180)
        if (protectedPaths.includes(path)) {
          const differences = await page.evaluate(() => {
            const sheets = [...document.querySelectorAll('style[data-vite-dev-id]')].filter(style => /\/(customer-premium|customer-home-premium)\.css$/.test(style.dataset.viteDevId))
            if (!sheets.some(style => style.dataset.viteDevId.endsWith('/customer-premium.css'))) throw new Error('Customer premium stylesheet is missing')
            // Stop existing transitions so enabling a stylesheet cannot make a
            // transient legacy color look like a permanent design difference.
            const freeze = document.createElement('style')
            freeze.textContent = '#app *,#app *::before,#app *::after{transition:none!important;animation:none!important}'
            document.head.append(freeze)
            const nodes = [...document.querySelectorAll('#app,#app *')]
            const properties = ['display', 'position', 'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'padding', 'margin', 'gap', 'gridTemplateColumns', 'flexDirection', 'order', 'overflow', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'borderColor', 'borderWidth', 'borderRadius', 'boxShadow', 'opacity']
            const snapshot = () => nodes.map(node => {
              const style = getComputedStyle(node), rect = node.getBoundingClientRect()
              return [...properties.map(property => style[property]), ...['x', 'y', 'width', 'height'].map(key => Math.round(rect[key] * 100) / 100)]
            })
            const enabled = snapshot()
            sheets.forEach(style => { style.sheet.disabled = true })
            const baseline = snapshot()
            sheets.forEach(style => { style.sheet.disabled = false })
            freeze.remove()
            return nodes.flatMap((node, index) => JSON.stringify(enabled[index]) === JSON.stringify(baseline[index]) ? [] : [{ node: node.tagName + (node.className ? '.' + String(node.className).replaceAll(' ', '.') : ''), properties: enabled[index].flatMap((value, key) => value === baseline[index][key] ? [] : [{ name: properties[key] || ['x', 'y', 'width', 'height'][key - properties.length], enabled: value, baseline: baseline[index][key] }]) }])
          })
          isolation.push({ path, width, theme, differences })
          continue
        }

        const check = await page.evaluate(async () => {
          const rendered = node => {
            const style = getComputedStyle(node)
            return node.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0
          }
          const labels = [...document.querySelectorAll('button,a.btn,a.app-guide-button')].filter(rendered)
          const clipped = labels.filter(node => node.clientHeight > 20 && (node.scrollHeight > node.clientHeight + 3 || node.scrollWidth > node.clientWidth + 3)).map(node => ({ text: node.textContent.trim(), width: node.clientWidth, height: node.clientHeight, scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight })).filter(node => node.text)
          const visibleImages = [...document.images].filter(rendered)
          await Promise.all(visibleImages.map(image => Promise.race([image.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, 4000))])))
          const brokenImages = visibleImages.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.currentSrc || image.src)
          const backgrounds = [...new Set([...document.querySelectorAll('#app *')].filter(rendered).flatMap(node => [...getComputedStyle(node).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => match[1])))].filter(url => !url.startsWith('data:'))
          const root = document.querySelector('.customer-page-body,.app-service-content,main') || document.querySelector('#app')
          const controls = [...document.querySelectorAll('#app a,#app button,#app input,#app select,#app textarea')].filter(rendered).map(node => ({ tag: node.tagName, label: (node.textContent || node.getAttribute('aria-label') || node.getAttribute('placeholder') || '').trim(), href: node.getAttribute('href') }))
          return { overflow: document.documentElement.scrollWidth > innerWidth + 1, clipped, brokenImages, backgrounds, controls, bodyText: root.textContent.trim().length }
        })
        results.push({ path, width, theme, ...check })
        assert(check.bodyText > 20, `${path}: customer page content must render`)
        assert(check.controls.length > 0, `${path}: existing links and controls must remain available`)
        for (const imageUrl of check.backgrounds) {
          const url = new URL(imageUrl, origin).href
          if (!url.startsWith(origin) || assets.has(url)) continue
          const response = await page.request.get(url)
          assert(response.ok() && /^image\//.test(response.headers()['content-type'] || ''), `${path}: background image must load: ${url}`)
          assets.add(url)
        }
        if (path === '/') assert(await page.locator('main a[href="/info/underpasses"],main a[href="/c-map"]').count() > 0, 'Home must retain its map action')
        if (path === '/info/app-guide') {
          assert(await page.locator('main a[href="#install"]').count() > 0, 'App guide must retain installation action')
          assert(await page.locator('main a[href="/customer-app/screen-1"]').count() > 0, 'App guide must retain app access')
        }
        if (['/info/its', '/info/kma', '/info/straffic'].includes(path)) assert(await page.locator('main a[target="_blank"][href^="https://"]').count() > 0, `${path} must retain official site link`)
        if ([390, 1440].includes(width) && screenshotPaths.includes(path)) {
          const handover = page.locator('dialog.admin-handover[open]')
          if (await handover.count()) await handover.getByRole('button', { name: '확인하고 닫기', exact: true }).click()
          await page.evaluate(() => {
            window.scrollTo(0, 0)
            document.querySelectorAll('.backend-main,.page,.app-service-content').forEach(node => { node.scrollTop = 0 })
          })
          await page.waitForTimeout(180)
          await page.screenshot({ path: `${output}/${path.replaceAll('/', '_')}-${width}-${theme}.png`, fullPage: true })
        }
      }
    }
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ checks: results.length, protectedChecks: isolation.length, results, isolation, errors, checkedBackgroundImages: [...assets] }, null, 2))
  assert.deepEqual(errors, [], 'Customer routes must have no runtime errors')
  assert.deepEqual(results.filter(result => result.overflow), [], 'Customer pages must not overflow horizontally')
  assert.deepEqual(results.filter(result => result.clipped.length), [], 'Visible customer controls must not clip labels')
  assert.deepEqual(results.filter(result => result.brokenImages.length), [], 'Customer images must load')
  assert.deepEqual(isolation.filter(result => result.differences.length), [], 'New customer styles must not change protected map or administrator geometry/paint')
  console.log(JSON.stringify({ checks: results.length, protectedChecks: isolation.length, checkedBackgroundImages: assets.size, errors: 0 }, null, 2))
} finally {
  await browser.close()
  await server.close()
}
