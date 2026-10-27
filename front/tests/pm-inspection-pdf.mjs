import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const requests = [], errors = []
  let invalidPdf = false
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => window.testCanShare !== false })
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      window.sharedPdf = { name: data.files[0].name, type: data.files[0].type, size: data.files[0].size }
    } })
  })
  const equipment = { equipId: 15, name: 'D-15-1', type: 'DISPLAY', underpassId: 7, underpassName: '초량지하차도', score: 82, level: 'DANGER', openEventId: 8, openEventStatus: 'CHECK_NEEDED' }
  const event = { eventId: 8, equipId: 15, name: 'D-15-1', underpassId: 7, underpassName: '초량지하차도', status: 'CHECK_NEEDED', triggerType: 'DANGER_ENTRY', createdAt: '2026-10-27T12:00:00' }
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname
    requests.push({ path, query: Object.fromEntries(url.searchParams), method: route.request().method() })
    if (path === '/api/pm/reports/daily/pdf') return invalidPdf
      ? route.fulfill({ json: { success: true, data: {} } })
      : route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF' })
    let data = { items: [], page: 1, totalItems: 0, totalPages: 1 }
    if (path === '/api/managers/me') data = { id: 1, name: '관리자', role: 'REGIONAL_ADMIN', regions: [{ id: 1, name: '동구' }] }
    else if (path === '/api/customers/me') data = null
    else if (path === '/api/pm/equipments/15') data = { equipment, detail: { features: [], extra: {} }, cautionMin: 45, dangerMin: 70, topCauses: [], recentActions: [] }
    else if (path === '/api/pm/equipments') data = { ...data, items: [equipment], totalItems: 1 }
    else if (path === '/api/pm/events') data = { ...data, items: [event], totalItems: 1 }
    else if (path.endsWith('/scores')) data = []
    else if (path.endsWith('/thresholds')) data = { history: [] }
    else if (path.endsWith('/sensor-trend')) data = { column: url.searchParams.get('column'), points: [], band: null }
    else if (path === '/api/regions') data = []
    else if (path === '/api/pm/reports/daily') data = { date: url.searchParams.get('date'), generatedAt: '2026-10-27T13:00:00', summary: { newEventCount: 1, openEventCount: 1, actionCount: 2, openEvents: [event] } }
    return route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const [detailPath, reportPath] of [['/pm-equipment-detail?id=15', '/pm-inspection'], ['/admin-app/screen-10?id=15', '/admin-app/inspection']]) {
    invalidPdf = false
    await page.goto(base + detailPath)
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()))
    await expect(page.locator('.pm-detail-actions').getByRole('link', { name: '목록으로 가기', exact: true })).toHaveAttribute('href', detailPath.startsWith('/admin-app/') ? '/admin-app/screen-9' : '/pm-equipment')
    await expect(page.locator('.pm-detail-actions').getByRole('link', { name: '확인 필요', exact: true })).toHaveCount(0)
    await page.locator('.pm-inspection-card').getByRole('link', { name: '확인 필요', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(reportPath + '\\?id=15&eventId=8'))
    await expect(page.locator('.inspection-target h2')).toContainText('D-15-1')
    await expect(page.locator('.inspection-counts')).toContainText('2')
    const date = await page.locator('.inspection-date input').inputValue()
    assert(requests.some(request => request.path === '/api/pm/reports/daily' && request.query.underpassId === '7' && request.query.date === date))
    await page.getByRole('button', { name: 'PDF 만들기', exact: true }).click()
    await expect(page.getByRole('link', { name: 'PDF 열기' })).toHaveAttribute('href', /^blob:/)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'PDF 저장', exact: true }).click()
    assert((await download).suggestedFilename().includes(date))
    await page.getByRole('button', { name: 'PDF 공유', exact: true }).click()
    assert.equal(await page.evaluate(() => window.sharedPdf.type), 'application/pdf')
    const previous = new Date(date + 'T00:00:00Z'); previous.setUTCDate(previous.getUTCDate() - 1)
    await page.locator('.inspection-date input').fill(previous.toISOString().slice(0, 10))
    await expect(page.getByRole('link', { name: 'PDF 열기' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'PDF 만들기', exact: true })).toBeEnabled()
    invalidPdf = true
    await page.getByRole('button', { name: 'PDF 만들기', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('PDF 문서 응답')
    await expect(page.getByRole('link', { name: 'PDF 열기' })).toHaveCount(0)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    console.log('PASS confirmation navigation, scoped PDF generation, download/share, date invalidation and MIME failure', reportPath)
  }
  invalidPdf = false
  await page.goto(base + '/admin-app/inspection?id=15&eventId=8')
  await page.evaluate(() => { window.testCanShare = false })
  await page.getByRole('button', { name: 'PDF 만들기', exact: true }).click()
  await expect(page.getByRole('button', { name: 'PDF 공유', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'PDF 저장', exact: true })).toBeEnabled()
  assert(!requests.some(request => request.method === 'POST' || request.method === 'PATCH'), 'Opening and exporting reports does not change inspection state')
  assert.deepEqual(errors, [])
} finally { await browser.close(); await server.close() }
