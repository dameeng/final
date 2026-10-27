import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const facility = { id: 1, name: '감천지하차도', regionId: 11, regionName: '사하구', roadAddress: '부산광역시 사하구', latitude: 35.0864125, longitude: 128.9967656, heightM: 4.7, lengthM: 964, widthM: 10, lanes: 4, safetyGrade: 'A', riverDistM: 1514.7, seaDistM: 347.2, earlyBlock: false, floodHistoryCount: 0, currentWaterCm: 0.1, currentStatus: 'NORMAL', currentRiskLevel: 'SAFE', riskScore: 0, currentRiskScore: 0, remainingCount: 0, pendingReviewCount: 0 }
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let data = []
    if (path === '/api/managers/me') data = { id: 1, name: '관리자', role: 'REGIONAL_ADMIN', regions: [{ id: 11, name: '사하구' }] }
    else if (path === '/api/customers/me') data = null
    else if (path === '/api/regions') data = [{ id: 11, name: '사하구' }]
    else if (path === '/api/underpasses') data = { items: [facility], page: 1, totalItems: 1, totalPages: 1 }
    else if (path === '/api/underpasses/1') data = facility
    await route.fulfill({ json: { success: true, data } })
  })
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/fac-list`)
    await page.locator('.row-open').first().waitFor()
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()))
    await page.locator('.row-open').first().click()
    const drawer = page.locator('dialog.restored-summary-drawer[open]')
    const drawerBox = await drawer.boundingBox()
    assert(drawerBox.x >= 0 && drawerBox.x + drawerBox.width <= width + 1, 'Drawer stays inside viewport')
    await expect(drawer.locator('.facility-summary-group')).toHaveCount(4)
    assert.deepEqual(await drawer.locator('.facility-summary-group h3').allTextContents(), ['위치', '시설 제원', '안전 정보', '차량 현황'])
    const labels = await drawer.locator('.facility-summary-groups dt').allTextContents()
    for (const label of ['시설명', '통제 상태', '위험 단계', '위험 점수', '현재 위험 점수']) assert(!labels.includes(label))
    await expect(drawer.locator('.restored-summary-overview')).toContainText('0점')
    await expect(drawer.locator('.facility-summary-groups')).toContainText('사하구')
    const coordinates = drawer.locator('.facility-coordinates')
    assert.equal(await coordinates.getAttribute('open'), null)
    await coordinates.locator('summary').click()
    await expect(coordinates).toContainText('35.0864125')
    await expect(coordinates).toContainText('128.9967656')
    await coordinates.locator('summary').click()
    await expect(drawer.locator('dt').filter({ hasText: '하천 거리' }).locator('..')).toContainText('1514.7m')
    await expect(drawer.locator('dt').filter({ hasText: '선제 차단 대상' }).locator('..')).toContainText('대상 아님')
    await expect(drawer.locator('dt').filter({ hasText: '과거 침수 횟수' }).locator('..')).toContainText('0')
    assert(await drawer.locator('.facility-summary-groups').evaluate(el => el.scrollWidth <= el.clientWidth + 1))
    await expect(drawer.getByRole('link', { name: '상세보기', exact: true })).toBeVisible()
    const quick = await drawer.locator('.facility-drawer-quick>button,.facility-drawer-quick>a').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect()
      return { y: box.y, width: box.width }
    }))
    assert.equal(quick.length, 2)
    assert(Math.abs(quick[0].y - quick[1].y) < 1 && Math.abs(quick[0].width - quick[1].width) < 1, 'CCTV shortcuts share one row: ' + JSON.stringify(quick))
    const more = drawer.locator('.facility-drawer-more')
    assert.equal(await more.getAttribute('open'), null)
    await expect(more.getByRole('button', { name: '수정', exact: true })).toBeHidden()
    await more.locator('summary').click()
    await expect(more.getByRole('button', { name: '수정', exact: true })).toBeVisible()
    assert(await more.locator('.facility-action-grid').evaluate(element => element.scrollWidth <= element.clientWidth + 1))
    await more.locator('summary').click()
    if (width === 390) {
      await drawer.evaluate(element => element.scrollTop = 0)
      await page.screenshot({ path: 'test-results/facility-drawer-compact-preview.png' })
    }
    console.log('PASS compact facility drawer, no duplicate fields, names, zero/false and footer', width)
  }
  assert.deepEqual(errors, [])
} finally { await browser.close(); await server.close() }
