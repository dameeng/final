import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const requests = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname
    requests.push({ path, underpass: url.searchParams.get('underpassId') })
    let data = { items: [], page: 1, totalItems: 0, totalPages: 1 }
    if (path === '/api/managers/me') data = { id: 1, name: '관리자', role: 'REGIONAL_ADMIN', regions: [] }
    else if (path === '/api/customers/me') data = null
    else if (path === '/api/regions') data = []
    else if (path === '/api/underpasses') data = { ...data, items: [{ id: 7, name: '감천지하차도' }] }
    return route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const [resource, title] of Object.entries({ reviews: '번호판 판별 대기', transits: '입출구 로그', ocr: 'OCR 인식 기록' })) {
    await page.goto(`${base}/admin-app/${resource}?underpassId=7`)
    await expect(page.locator('.manager-app-titlebar strong')).toHaveText(title)
    await expect(page.locator('.service-heading h1')).toHaveText(title)
    await expect(page.locator('.service-tabs,.resource-shortcuts')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '새로고침', exact: true })).toHaveCount(0)
    await expect(page.locator('.service-heading')).toBeHidden()
    assert.equal(new URL(page.url()).searchParams.get('underpassId'), '7')
  }
  assert(requests.some(request => request.path === '/api/plate-logs' && request.underpass === '7'))
  assert(requests.some(request => request.path === '/api/underpasses/transits' && request.underpass === '7'))
  await page.goto(base + '/admin-app/menu')
  for (const [resource, title] of Object.entries({ reviews: '번호판 판별 대기', transits: '입출구 로그', ocr: 'OCR 인식 기록' })) {
    await expect(page.locator(`a[href="/admin-app/${resource}"]`)).toContainText(title)
  }
  assert.deepEqual(errors, [])
  console.log('PASS independent vehicle record pages, consistent menu/header/title names and retained facility filters')
} finally { await browser.close(); await server.close() }
