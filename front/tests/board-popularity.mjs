import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const requestedPages = []
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), current = Number(url.searchParams.get('page') || 1)
    let data = []
    if (url.pathname === '/api/notices' || url.pathname === '/api/faqs') {
      requestedPages.push(current)
      const notices = url.pathname === '/api/notices'
      const rows = current === 1
        ? [{ id: 1, title: 'Regular 900', question: 'FAQ 10', important: false, viewCount: notices ? 900 : 10 },
           { id: 2, title: 'Important 5', question: 'FAQ 50', important: true, viewCount: notices ? 5 : 50 }]
        : [{ id: 3, title: 'Important 30', question: 'FAQ 1000', important: true, viewCount: notices ? 30 : 1000 },
           { id: 4, title: 'Regular 100', question: 'FAQ 0', important: false, viewCount: notices ? 100 : null }]
      data = { items: rows, page: current, totalPages: 2, totalItems: 4 }
    }
    return route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const path of ['/c-notice', '/customer-app/notices']) {
    await page.goto(base + path)
    await page.locator('.notice-title-button').nth(3).waitFor()
    const titles = await page.locator('.notice-title-button').allTextContents()
    assert.deepEqual(titles.map(title => title.match(/(?:Important|Regular) \d+/)?.[0]),
      ['Important 30', 'Important 5', 'Regular 900', 'Regular 100'])
  }
  for (const path of ['/info/faq', '/customer-app/faq']) {
    await page.goto(base + path)
    await page.locator('.faq-accordion-item summary strong').nth(3).waitFor()
    assert.deepEqual(await page.locator('.faq-accordion-item summary strong').allTextContents(),
      ['FAQ 1000', 'FAQ 50', 'FAQ 10', 'FAQ 0'])
  }
  assert(requestedPages.includes(2), 'Sort includes records beyond the first backend page')
  console.log('PASS notices: importance then views; FAQs: views; web and mobile; complete backend pagination')
} finally {
  await browser?.close()
  await server.close()
}
