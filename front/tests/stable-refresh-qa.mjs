import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'

// Local, mocked responses only: never writes to the application API.
const base = process.env.QA_BASE || 'http://localhost:8282'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const results = []
const facility = { id: 1, name: 'QA Facility', regionId: 11, assignedRegionId: 11, regionName: 'QA Region', latitude: 35.1, longitude: 129.03, currentStatus: 'NORMAL', currentRiskLevel: 'SAFE', riskScore: 12.3 }
const records = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, equipId: i + 1, name: `QA Equipment ${i + 1}`, type: 'CCTV', underpassId: 1, underpassName: facility.name, cautionMin: 40, dangerMin: 70, level: 'SAFE', createdAt: '2026-11-02T10:00:00' }))
const transits = records.slice(0, 10).map(row => ({ ...row, displayCarNum: `12A${1000 + row.id}`, status: 'EXITED', entryAt: '2026-11-01T10:00:00', exitAt: '2026-11-01T10:01:00' }))
const alerts = records.slice(0, 10).map(row => ({ id: row.id, title: `QA Notice ${row.id}`, body: 'QA message', read: false, category: 'NOTICE', createdAt: row.createdAt }))
const pageData = items => ({ items, page: 1, size: items.length || 10, totalItems: items.length, totalPages: 1 })
const reportData = () => ({ generatedAt: '2026-11-02T10:00:00', summary: { levelCounts: { safe: 12 }, previousLevelCounts: { safe: 12 }, byType: [{ type: 'CCTV', total: 12, safe: 12, caution: 0, danger: 0, noData: 0 }], recommended: records, newEvents: [], openEvents: [], actions: [], stale: [] } })

async function setup({ customer = false, width = 1366, height = 768 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
  const page = await context.newPage(), errors = [], calls = [], gates = new Map(), overrides = new Map()
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget { close() {} }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    localStorage.setItem('routel-handover-hide:1:REGIONAL_ADMIN', today)
  })
  await page.route('https://**/*', route => route.abort())
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    assert.equal(req.method(), 'GET', `No API writes during QA: ${path}`)
    calls.push(path)
    const gate = gates.get(path)
    if (gate) { gate.hits++; await gate.promise }
    if (gate?.failure) return route.fulfill({ status: 503, json: { success: false, message: 'QA refresh unavailable' } })
    let data = pageData([])
    if (path === '/api/managers/me') data = customer ? null : { id: 1, name: 'QA Manager', role: 'REGIONAL_ADMIN', regions: [{ id: 11, name: 'QA Region' }] }
    else if (path === '/api/customers/me') data = customer ? { id: 2, name: 'QA Customer' } : null
    else if (path === '/api/regions') data = [{ id: 11, name: 'QA Region' }]
    else if (path === '/api/underpasses') data = pageData([facility])
    else if (/^\/api\/underpasses\/\d+$/.test(path)) data = { ...facility, id: Number(path.split('/').at(-1)) }
    else if (path.endsWith('/risk-scores') || path.endsWith('/risk-forecast') || path.endsWith('/thresholds') && !path.startsWith('/api/pm')) data = []
    else if (path.endsWith('/cameras')) data = []
    else if (path === '/api/underpasses/transits') data = pageData(transits)
    else if (path === '/api/pm/thresholds') data = pageData(records.slice(0, 10))
    else if (path === '/api/dashboard/risk-scores/latest') data = records.map(row => ({ ...row, riskScore: 12.3, predictedAt: row.createdAt }))
    else if (path === '/api/dashboard/region-status') data = [{ regionName: 'QA Region', normalCount: 1, blockedCount: 0 }]
    else if (path === '/api/pm/reports/daily') data = reportData()
    else if (/\/notifications$/.test(path)) data = pageData(alerts.slice(0, Number(url.searchParams.get('size') || 10)))
    else if (path.endsWith('/unread-count')) data = { total: 10, byCategory: { NOTICE: 10 } }
    else if (path.endsWith('/device-tokens')) data = [{ id: 1, platform: 'WEB', active: true }]
    else if (path === '/api/weather' || path === '/api/navigation/weather') data = { temperature: 15.2, humidity: 60, rainfall: 0.1, condition: 'Clear', observedAt: new Date().toISOString(), hourly: [] }
    else if (path === '/api/demo/scenarios/current') data = { running: false, elapsedSec: 0, totalSec: 170 }
    if (overrides.has(path)) data = overrides.get(path)
    return route.fulfill({ json: { success: true, data } })
  })
  function hold(path, failure = false) {
    assert(!gates.has(path), `Gate already exists: ${path}`)
    let release
    const gate = { hits: 0, failure, promise: new Promise(resolve => { release = resolve }) }
    gates.set(path, gate)
    return { started: () => expect.poll(() => gate.hits).toBeGreaterThan(0), release: () => { gates.delete(path); release() } }
  }
  async function goto(path, selector) {
    await page.goto(base + path)
    await page.locator(selector).first().waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(120)
  }
  return { page, context, errors, calls, hold, overrides, goto }
}
const sse = (page, name, data = {}) => page.evaluate(({ name, data }) => window.dispatchEvent(new CustomEvent('routel-backend-event', { detail: { name, data } })), { name, data })
const event = (page, name) => page.evaluate(name => window.dispatchEvent(new Event(name)), name)

async function retained(test, selector, path, trigger, { failure = false } = {}) {
  const { page } = test
  await page.evaluate(selector => {
    const node = document.querySelector(selector)
    assertNode(node)
    function assertNode(value) { if (!value) throw new Error('Missing refresh target') }
    window.__refreshTarget = node
    const ancestors = []
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(el).overflowY)) {
        el.scrollTop = Math.min(120, el.scrollHeight - el.clientHeight)
        ancestors.push(el)
      }
    }
    window.scrollTo(0, Math.max(0, document.documentElement.scrollHeight - innerHeight - 24))
    window.__scrollAncestors = ancestors
  }, selector)
  await page.waitForTimeout(80)
  const snapshot = () => page.evaluate(selector => ({ same: window.__refreshTarget === document.querySelector(selector) && window.__refreshTarget.isConnected, top: window.__refreshTarget.getBoundingClientRect().top, y: scrollY, height: document.documentElement.scrollHeight, nested: window.__scrollAncestors.map(el => el.scrollTop) }), selector)
  const before = await snapshot()
  const gate = test.hold(path, failure)
  await trigger()
  await gate.started()
  await page.waitForTimeout(80)
  const during = await snapshot()
  assert(during.same, `${selector} retains its DOM during refresh`)
  assert.equal(during.y, before.y, `${selector} window scroll during refresh`)
  assert.deepEqual(during.nested, before.nested, `${selector} nested scroll during refresh`)
  assert.equal(during.height, before.height, `${selector} document height during refresh`)
  await page.evaluate(() => { scrollBy(0, -20); for (const el of window.__scrollAncestors) el.scrollTop = Math.max(0, el.scrollTop - 20) })
  const moved = await snapshot()
  gate.release()
  await expect.poll(() => page.evaluate(selector => document.querySelector(selector) === window.__refreshTarget, selector)).toBe(true)
  await page.waitForTimeout(450)
  const after = await snapshot()
  assert(after.same, `${selector} retains its DOM after refresh`)
  if (failure) {
    // Browser anchoring can increase scrollY when a stale-data notice is inserted above.
    assert(after.y === moved.y || Math.abs(after.top - moved.top) <= 1, `${selector} keeps the reading position on failure: ${JSON.stringify({ moved, after })}`)
    assert(await page.getByText('QA refresh unavailable', { exact: false }).first().count())
  } else {
    assert.equal(after.y, moved.y, `${selector} respects user scroll while pending`)
    assert.deepEqual(after.nested, moved.nested, `${selector} retains nested scroll after refresh`)
  }
  results.push({ selector, before: before.y, during: during.y, after: after.y, failure })
  console.log('PASS retained', selector, failure ? 'failed refresh' : 'successful refresh', `${before.y}/${during.y}/${after.y}`)
}

try {
  {
    const test = await setup(), { page } = test
    const gate = test.hold('/api/underpasses/transits', true)
    await test.goto('/admin-data/transits', '.record-page-heading')
    await gate.started()
    await expect(page.locator('.service-table')).toHaveCount(0)
    await expect(page.locator('.record-empty-state')).toHaveCount(0)
    gate.release()
    await expect(page.getByText('QA refresh unavailable', { exact: false }).first()).toBeVisible()
    await expect(page.locator('.service-table')).toHaveCount(0)
    await expect(page.locator('.record-empty-state')).toHaveCount(0)
    await sse(page, 'transit-update', { underpassId: 1 })
    await page.locator('.service-table').waitFor()
    console.log('PASS first load: loading and failure are distinct from a successful empty response; subsequent refresh recovers')
    await test.context.close()
  }
  // Shared resource lists: first load, live refresh, manual refresh, failure, query changes and empty state.
  for (const [width, height, theme] of [[1366, 768, 'light'], [1920, 1080, 'dark']]) {
    const test = await setup({ width, height }), { page } = test
    await test.goto('/admin-data/transits', '.record-page-heading')
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
    await page.locator('.service-table tbody tr').first().waitFor()
    await retained(test, '.service-table', '/api/underpasses/transits', () => sse(page, 'transit-update', { underpassId: 1 }))
    await retained(test, '.service-table', '/api/underpasses/transits', () => page.getByRole('button', { name: '\uc0c8\ub85c\uace0\uce68', exact: true }).evaluate(el => el.click()))
    await retained(test, '.service-table', '/api/underpasses/transits', () => sse(page, 'transit-update', { underpassId: 1 }), { failure: true })
    await retained(test, '.service-table', '/api/underpasses/transits', () => sse(page, 'transit-update', { underpassId: 1 }), { failure: true })
    const gate = test.hold('/api/underpasses/transits')
    await page.locator('.service-filters input[type=text]').first().fill('NEW')
    await page.locator('.service-filters').evaluate(el => el.requestSubmit())
    await gate.started()
    await expect(page.locator('.service-table')).toHaveCount(0)
    gate.release()
    await page.locator('.service-table').waitFor()
    test.overrides.set('/api/underpasses/transits', pageData([]))
    await sse(page, 'transit-update', { underpassId: 1 })
    await expect(page.locator('.record-empty-state')).toBeVisible()
    await retained(test, '.record-empty-state', '/api/underpasses/transits', () => sse(page, 'transit-update', { underpassId: 1 }))
    assert.deepEqual(test.errors, [])
    await test.context.close()
  }

  // PM settings and report tables use the existing SSE / refresh callbacks.
  for (const [path, selector, api, name, data] of [
    ['/pm-settings', '.pm-settings-table', '/api/pm/thresholds', 'data-changed', { resource: 'pm-threshold' }],
    ['/admin-reports?report=scores', '.service-table', '/api/dashboard/risk-scores/latest', 'transit-update', { underpassId: 1 }],
  ]) {
    const test = await setup(path.includes('admin-app') ? { width: 390, height: 844 } : {}), { page } = test
    await test.goto(path, selector)
    await retained(test, selector, api, () => sse(page, name, data))
    await retained(test, selector, api, () => sse(page, name, data), { failure: true })
    if (path.startsWith('/pm-settings')) {
      const gate = test.hold(api)
      await page.locator('.service-filters select').nth(1).selectOption('PUMP')
      await gate.started()
      await expect(page.locator(selector)).toHaveCount(0)
      gate.release()
      await page.locator(selector).waitFor()
    }
    assert.deepEqual(test.errors, [])
    await test.context.close()
  }

  // Daily report: retain the active record page, clamp on shrink, reset on date change.
  for (const path of ['/pm-daily', '/admin-app/pm-daily']) {
    const test = await setup(path.includes('admin-app') ? { width: 390, height: 844 } : {}), { page } = test
    const mobile = path.includes('admin-app')
    const selector = mobile ? '.daily-section' : '.daily-web-grid .service-table'
    await test.goto(path, selector)
    const pager = page.locator(mobile ? '.daily-section .app-number-pagination' : '.daily-web-grid .service-pagination').first()
    await pager.locator('button').last().click()
    await expect(page.locator(selector).first()).toContainText('QA Equipment 6')
    await retained(test, selector, '/api/pm/reports/daily', () => sse(page, 'pm-update'))
    await expect(page.locator(selector).first()).toContainText('QA Equipment 6')
    await retained(test, selector, '/api/pm/reports/daily', () => page.locator('.service-filters').evaluate(el => el.requestSubmit()))
    const gate = test.hold('/api/pm/reports/daily')
    await page.locator('input[type=date]').fill('2026-10-30')
    await gate.started()
    await expect(page.locator(selector)).toHaveCount(0)
    gate.release()
    await expect(page.locator(selector).first()).toContainText('QA Equipment 1')
    if (!mobile) {
      await pager.locator('button').last().click()
      test.overrides.set('/api/pm/reports/daily', { ...reportData(), summary: { ...reportData().summary, recommended: records.slice(0, 3) } })
      await sse(page, 'pm-update')
      await expect(page.locator(selector)).toContainText('QA Equipment 1')
      await expect(pager).toHaveCount(0)
    }
    assert.deepEqual(test.errors, [])
    await test.context.close()
  }

  for (const path of ['/my-alerts', '/customer-app/screen-12']) {
    const test = await setup({ customer: true, ...(path.includes('customer-app') ? { width: 390, height: 844 } : {}) }), { page } = test
    await test.goto(path, '.notification-center-list')
    await retained(test, '.notification-center-list', '/api/customers/me/notifications', () => sse(page, 'notification-read-change'))
    await retained(test, '.notification-center-list', '/api/customers/me/notifications', () => sse(page, 'notification-read-change'), { failure: true })
    const gate = test.hold('/api/customers/me/notifications')
    await page.locator('.notification-category-tabs button, .notification-center-tabs button').last().click()
    await gate.started()
    await expect(page.locator('.notification-center-list')).toHaveCount(0)
    gate.release()
    await page.locator('.notification-center-list').waitFor()
    assert.deepEqual(test.errors, [])
    await test.context.close()
  }

  for (const [path, selector] of [['/fac-detail?id=1', '.restored-overview-grid'], ['/admin-app/screen-5?id=1', '.app-facility-summary']]) {
    const test = await setup(), { page } = test
    await test.goto(path, selector)
    await retained(test, selector, '/api/underpasses/1', () => sse(page, 'data-changed', { resource: 'underpass' }))
    assert.deepEqual(test.errors, [])
    await test.context.close()
  }

  // Notification popup and device list keep their DOM, including nested scroll.
  {
    const test = await setup(), { page } = test
    await test.goto('/admin-profile', '.manager-push-devices ul')
    await retained(test, '.manager-push-devices ul', '/api/managers/me/device-tokens', () => event(page, 'routel:push-device-updated'))
    await retained(test, '.manager-push-devices ul', '/api/managers/me/device-tokens', () => event(page, 'routel:push-device-updated'), { failure: true })
    await page.locator('.notification-bell button').first().click()
    await page.locator('.notification-popup-body ul').waitFor()
    await retained(test, '.notification-popup-body ul', '/api/managers/me/notifications', () => sse(page, 'connected'))
    await retained(test, '.notification-popup-body ul', '/api/managers/me/notifications', () => sse(page, 'connected'), { failure: true })
    assert.deepEqual(test.errors, [])
    await test.context.close()
  }
  console.log('PASS stable refresh:', JSON.stringify(results, null, 2))
} finally { await browser.close() }
