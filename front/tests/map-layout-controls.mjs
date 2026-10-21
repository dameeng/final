import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
let server
try {
  await fetch('http://localhost:8282')
} catch {
  server = await createServer({ configLoader: 'runner' })
  await server.listen()
}
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
try {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } }),
    errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  for (const path of [
    '/admin-dashboard',
    '/c-map',
    '/customer-app/screen-5',
    '/admin-app/screen-3',
  ]) {
    await p.addInitScript(() =>
      localStorage.setItem(
        'routel-handover-hide:guest:regional',
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date()),
      ),
    )
    await p.goto('http://localhost:8282' + path)
    await p.locator('.map-status-legend').waitFor()
    assert.equal(await p.locator('.map-status-legend span').count(), 5)
    if (path.includes('-app/')) assert((await p.locator('.mobile-page').boundingBox()).width <= 430)
    if (path === '/admin-dashboard') {
      const map = await p.locator('.map-body').boundingBox(),
        panel = await p.locator('.selp').boundingBox()
      assert(Math.abs(panel.y - map.y - 16) < 2)
      assert(Math.abs(map.x + map.width - panel.x - panel.width - 16) < 2)
      await p.locator('#menu-btn').click()
      const side = await p.locator('.side').boundingBox()
      assert.equal(Math.round(side.width), 360)
      const rows = await p
        .locator('.side-bot a')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top))
      assert(rows.every((top, index) => index === 0 || top > rows[index - 1]))
      await p.locator('#menu-close').click()
      const item = p.locator('.grid-stack-item[gs-id="summary"]')
      assert(await item.evaluate((el) => el.classList.contains('ui-resizable-disabled')))
    }
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS mobile width, five map legend states, 360px sidebar, vertical links, fixed widget sizes, no runtime errors',
  )
} finally {
  await browser.close()
  await server?.close()
}
