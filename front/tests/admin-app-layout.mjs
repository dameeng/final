import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage()
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    let data = { items: [], page: 1, totalPages: 1, totalItems: 0 }
    if (path === '/api/managers/me') data = { id: 1, name: '관리자', role: 'REGIONAL_ADMIN', regions: [] }
    else if (path === '/api/customers/me') data = null
    else if (path === '/api/regions' || path.includes('/dashboard/')) data = []
    return route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    for (const path of [
      '/admin-app/screen-4', '/admin-app/screen-9', '/admin-app/screen-11',
      '/admin-app/history', '/admin-app/notifications', '/admin-app/ocr',
      '/admin-app/reviews', '/admin-app/transits', '/admin-app/screen-14',
    ]) {
      await page.goto(base + path)
      await page.locator('.app-restored-body').waitFor()
      const issues = await page.evaluate(() => {
        const host = document.querySelector('.app-restored-body'), box = host.getBoundingClientRect()
        return [...host.querySelectorAll('button,input,select,a,.pm-engine')]
          .filter(element => element.getClientRects().length &&
            !element.closest('dialog,.service-table-wrap,.pm-results-viewport') &&
            getComputedStyle(element).position !== 'absolute')
          .map(element => ({
            tag: element.tagName, text: (element.textContent || element.getAttribute('aria-label') || '').trim(),
            left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right,
          }))
          .filter(element => element.left < box.left - 1 || element.right > box.right + 1)
      })
      assert.deepEqual(issues, [], `${width}px ${path}: controls stay inside the app`)
      assert(await page.evaluate(() => {
        const box = document.querySelector('.manager-app-shell').getBoundingClientRect()
        return Math.abs((box.left + box.right) / 2 - innerWidth / 2) < 1
      }), `${path}: app stays centered`)
    }
  }
  console.log('PASS 27 app page/viewport combinations: controls fit and app stays centered')
} finally {
  await browser.close()
  await server.close()
}
