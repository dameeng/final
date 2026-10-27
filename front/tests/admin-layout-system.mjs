import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let data = { items: [], page: 1, totalItems: 0, totalPages: 1, size: 10 }
    if (path === '/api/managers/me') data = { id: 1, name: '관리자', role: 'REGIONAL_ADMIN', regions: [] }
    else if (path === '/api/customers/me') data = null
    else if (path === '/api/regions' || path.includes('/dashboard/')) data = []
    else if (path.includes('/assistant/') || path.includes('/chat/') || path.includes('/chatbot/')) {
      await route.fulfill({ status: 503, json: { success: false, message: '테스트 중' } })
      return
    }
    await route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  await page.goto(base + '/fac-list')
  await page.locator('h1').first().waitFor()
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()))
  await page.getByRole('button', { name: '관리자 메뉴 열기' }).click()
  const links = await page.locator('.admin-sidebar-groups a').evaluateAll(elements =>
    elements.map(element => ({ path: element.getAttribute('href'), title: element.textContent.trim() })))
  const rect = locator => locator.evaluate(element => {
    const box = element.getBoundingClientRect()
    return { x: box.x, y: box.y, height: box.height, width: box.width }
  })
  let baseline
  for (const { path, title } of links) {
    await page.goto(base + path)
    const heading = page.locator('h1').first()
    await heading.waitFor()
    assert.equal((await heading.innerText()).trim(), title, path + ' menu and page title')
    const position = await rect(heading)
    if (!baseline) baseline = position
    assert(Math.abs(position.x - baseline.x) < 2, path + ' heading x: ' + JSON.stringify(position))
    assert(Math.abs(position.y - baseline.y) < 2, path + ' heading y: ' + JSON.stringify(position))
    const header = await rect(page.locator('.backend-header,.hdr').first())
    assert.equal(header.height, 64, path + ' header height')
    assert(Math.abs(position.y - header.y - header.height - 24) < 2, path + ' 24px above title')
    assert(await heading.evaluate(element => element.closest('.service-heading,.page-head').getBoundingClientRect().height >= 44), path + ' consistent title row height')
    const headingGap = await heading.evaluate(element => {
      const container = element.closest('.service-heading,.page-head')
      let next = container?.nextElementSibling
      while (next && !next.getClientRects().length) next = next.nextElementSibling
      return container && next ? next.getBoundingClientRect().top - container.getBoundingClientRect().bottom : 0
    })
    assert(headingGap >= -1 && headingGap <= 16, path + ' compact heading gap: ' + headingGap)
    const refresh = page.locator('.service-heading,.page-head').getByRole('button', { name: '새로고침', exact: true })
    if (await refresh.count()) {
      const before = await rect(refresh)
      assert.equal(before.height, 44, path + ' control height')
      if (await refresh.isEnabled()) {
        await refresh.click()
        const after = await rect(refresh)
        assert.deepEqual(after, before, path + ' refresh position stays fixed')
      }
    }
    console.log('PASS title and geometry', path)
  }
  await page.goto(base + '/fac-list')
  const tabs = page.locator('.tabs button')
  if (await tabs.count()) {
    const before = await Promise.all((await tabs.all()).map(rect))
    await tabs.nth(1).click()
    assert.deepEqual(await Promise.all((await tabs.all()).map(rect)), before, 'Selecting a tab preserves all tab positions')
  }
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    for (const path of ['/fac-list', '/pm-equipment', '/pm-queue', '/pm-history', '/admin-data/cameras']) {
      await page.goto(base + path)
      await page.locator('h1').first().waitFor()
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path + ' mobile overflow')
    }
  }
  assert.deepEqual(errors, [])
  console.log('PASS all sidebar page titles, header/title/control positions, refresh, tab selection and mobile widths')
} finally {
  await browser.close()
  await server.close()
}
