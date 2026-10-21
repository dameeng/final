import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const b = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }),
    errors = []
  p.on('pageerror', (e) => errors.push(e.message))
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
  await p.goto('http://localhost:8282/admin-dashboard')
  await p.locator('.dashboard-fixed-layout').waitFor({ state: 'attached' })
  await p.waitForTimeout(300)
  for (const width of [1440, 768, 390, 360, 1440]) {
    await p.setViewportSize({ width, height: 900 })
    await p.waitForTimeout(250)
    const result = await p.locator('[data-id="summary"]').evaluate((el) => {
      const r = el.getBoundingClientRect()
      return [...el.querySelectorAll('.tile strong')].map((tile) => {
        const t = tile.getBoundingClientRect()
        return t.top >= r.top && t.bottom <= r.bottom + 1
      })
    })
    assert(result.every(Boolean), 'summary clipped at ' + width)
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    )
  }
  await p.goto('http://localhost:8282/info/company')
  await p.locator('.header-download').click()
  await p.waitForURL('**/info/app-guide#install')
  await p.goto('http://localhost:8282/logs?facility=1')
  await p.locator('#tbl').waitFor()
  for (const path of ['/info/company', '/c-map', '/pm-equipment-detail']) {
    await p.setViewportSize({ width: 360, height: 900 })
    await p.goto('http://localhost:8282' + path)
    await p.waitForTimeout(150)
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    )
    if (path.includes('/info/')) {
      for (const link of await p.locator('.customer-main-nav a').all()) {
        const r = await link.boundingBox()
        assert(r.x >= 0 && r.x + r.width <= 360)
      }
    }
  }
  await p.goto('http://localhost:8282/customer-app/screen-5')
  await p.locator('.map-status-legend').waitFor()
  assert.equal(
    await p
      .locator('.map-status-legend i')
      .first()
      .evaluate((el) => getComputedStyle(el).position),
    'static',
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS summary visible across resizing, 360px menus and equipment, logs query, legend layout, no runtime errors',
  )
} finally {
  await b.close()
}
