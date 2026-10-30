import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { matchesRisk } from '../src/services/backendCatalog.ts'
import { compareFacilityPriority } from '../src/utils/facility-priority.ts'

// Control stays in the danger filter after sensor risk recovers, and is excluded
// from warning/safe filters. The raw risk still applies to operating facilities.
for (const risk of ['SAFE', 'WARNING', 'DANGER', undefined]) {
  assert.equal(matchesRisk(risk, 'DANGER', true), true)
  assert.equal(matchesRisk(risk, 'WARNING', true), false)
  assert.equal(matchesRisk(risk, 'SAFE', true), false)
  assert.equal(matchesRisk(risk, '', true), true)
}
assert.equal(matchesRisk('SAFE', 'DANGER'), false)
assert.equal(matchesRisk('WARNING', 'WARNING'), true)
assert.equal(matchesRisk('SAFE', 'SAFE'), true)
assert.equal(matchesRisk('ALERT', 'DANGER'), true)

const fixtures = [
  ['통제안전', 'SAFE', 'BLOCKED'], ['통제주의', 'WARNING', 'BLOCKED'],
  ['통제미확인', null, 'BLOCKED'], ['통제위험', 'DANGER', 'BLOCKED'],
  ['운영위험', 'DANGER', 'NORMAL'], ['운영주의', 'WARNING', 'NORMAL'],
  ['운영안전', 'SAFE', 'NORMAL'],
].map(([name, currentRiskLevel, currentStatus], index) => ({
  id: index + 1, name, currentRiskLevel, currentStatus, riskScore: 0.1,
  regionId: 1, regionName: '동구', remainingCount: 0, pendingReviewCount: 0,
}))
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    let data = { items: [], page: 1, size: 10, totalItems: 0, totalPages: 1 }
    if (url.pathname === '/api/managers/me') data = { id: 1, name: '검증', role: 'REGIONAL_ADMIN', regions: [{ id: 1, name: '동구' }] }
    else if (url.pathname === '/api/regions') data = [{ id: 1, name: '동구' }]
    else if (url.pathname === '/api/underpasses') {
      // Spread controlled facilities across backend pages to catch filtering a
      // single fetched page or double filtering with different criteria.
      const current = Number(url.searchParams.get('page') || 1)
      const source = url.searchParams.get('status') ? fixtures.filter(row => row.currentStatus === url.searchParams.get('status')) : fixtures
      data = { items: current === 1 ? source.slice(0, 2) : source.slice(2), page: current, size: 100, totalItems: source.length, totalPages: 2 }
    }
    await route.fulfill({ json: { data } })
  })
  for (const path of ['/fac-list', '/admin-app/screen-4']) {
    await page.goto('http://localhost:8282' + path)
    const selector = path === '/fac-list' ? '.row-open strong' : '.app-facility-rows>a .g>b'
    const names = () => page.locator(selector).allTextContents().then(rows => rows.map(row => row.trim()).sort())
    await page.locator(selector).first().waitFor()
    const controls = path === '/fac-list' ? '.facility-directory-summary' : '.facility-risk-filters'
    const labels = path === '/fac-list' ? '.facility-summary-copy>span' : '.facility-risk-filters>button>span'
    assert.deepEqual(await page.locator(labels).allTextContents(), ['전체', '안전', '주의', '위험'])
    assert.equal(await page.locator(controls).evaluate(element => element.closest('form') === null), true)
    if (path === '/fac-list') assert.equal(await page.locator('.facility-risk-filters').count(), 0)
    const capacity = path === '/fac-list' ? 10 : 5
    assert.equal((await names()).length, Math.min(7, capacity))
    assert.deepEqual((await page.locator(selector).allTextContents()).map(name => name.trim()), [...fixtures].sort(compareFacilityPriority).slice(0, capacity).map(row => row.name), path + ' risk priority order')
    for (const [label, expected] of [
      ['위험', ['통제안전', '통제주의', '통제미확인', '통제위험', '운영위험']],
      ['주의', ['운영주의']], ['안전', ['운영안전']],
      ['전체', fixtures.map(row => row.name)],
    ]) {
      await page.locator(controls).getByRole('button', { name: new RegExp('^' + label) }).click()
      await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count, { selector, count: Math.min(expected.length, capacity) })
            const collected = await names()
      if (expected.length > capacity) {
        await page.getByRole('button', { name: '다음 페이지', exact: true }).click()
        await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count, { selector, count: expected.length - capacity })
        collected.push(...await names())
      }
      assert.deepEqual(collected.sort(), [...expected].sort(), path + ' ' + label)
    }
    console.log(path + ': danger, warning, safe and all filters passed')
  }
} finally { await browser.close() }
