import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
let server
try {
  await fetch('http://localhost:8282')
} catch {
  server = await createServer({ configLoader: 'runner' })
  await server.listen()
}
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.addInitScript(() => sessionStorage.setItem('routel-member-preview', '1'))
  await page.goto('http://localhost:8282/customer-app/screen-5')
  const handle = page.locator('.mobile-sheet-handle'),
    map = page.locator('.meeting-mobile-map')
  await handle.waitFor()
  assert.equal(await handle.getAttribute('aria-expanded'), 'false')
  const initial = await map.boundingBox()
  assert(initial.height > 650)
  const rect = await handle.boundingBox()
  await page.mouse.move(rect.x + rect.width / 2, rect.y + 30)
  await page.mouse.down()
  await page.mouse.move(rect.x + rect.width / 2, rect.y - 260, { steps: 15 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  assert.equal(await handle.getAttribute('aria-expanded'), 'true')
  assert.equal((await map.boundingBox()).height, initial.height)
  assert.equal(await page.locator('.customer-app-nav svg').count(), 3)
  await page.locator('.map-facility-search input').fill('\uCD08\uB7C9')
  assert.equal(await page.locator('.mobile-facility-list button').count(), 2)
  await page.locator('.mobile-facility-list button').first().click()
  assert((await page.locator('.mobile-sheet-detail h2').textContent()).includes('\uCD08\uB7C9'))
  await page.locator('.map-facility-search input').fill('no-such-underpass')
  assert.equal(await page.locator('.mobile-facility-list button').count(), 0)
  await page.locator('.map-facility-search input').fill('')
  assert.equal(await page.locator('.mobile-facility-list button').count(), 49)
  await page.locator('.mobile-facility-list button').first().click()
  await page.locator('.mobile-sheet-detail').waitFor()
  assert(await page.locator('.mobile-sheet-detail button').first().isVisible())
  const expanded = await handle.boundingBox()
  await page.mouse.move(expanded.x + expanded.width / 2, expanded.y + 30)
  await page.mouse.down()
  await page.mouse.move(expanded.x + expanded.width / 2, expanded.y + 280, { steps: 15 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  assert.equal(await handle.getAttribute('aria-expanded'), 'false')
  await handle.click()
  assert.equal(await handle.getAttribute('aria-expanded'), 'true')
  assert(await page.locator('.ph').evaluate((el) => el.scrollHeight <= el.clientHeight + 1))
  await handle.click()
  assert.equal(await page.locator('.map-status-legend span').count(), 5)
  await page.route('**/api/navigation/weather?*', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          temperature: 21,
          humidity: 60,
          rainfall: 0,
          condition: 'Clear',
          observedAt: '2026-10-15T10:00:00+09:00',
        },
      },
    }),
  )
  await page.locator('.app-weather-toggle').click()
  await page.locator('.app-weather-temperature').waitFor()
  const card = await page.locator('.app-weather-card').boundingBox()
  assert(card.height < initial.height * 0.4)
  assert(await handle.isVisible())
  assert.equal((await map.boundingBox()).height, initial.height)
  const header = await page.locator('.ph > .ah').boundingBox()
  const bell = await page.locator('.ah .app-bell').boundingBox()
  await page.goto('http://localhost:8282/customer-app/screen-7')
  const routeHeader = await page.locator('.ph > .ah').boundingBox()
  assert.equal(await page.locator('.customer-app-nav svg').count(), 3)
  const routeBell = await page.locator('.ah .app-bell').boundingBox()
  assert.equal(routeHeader.height, header.height)
  assert.equal(routeBell.x, bell.x)
  await page.locator('.bd').evaluate((el) => (el.scrollTop = 200))
  assert.equal((await page.locator('.ph > .ah').boundingBox()).y, header.y)
  await page.goto('http://localhost:8282/customer-app/screen-13')
  await page.locator('.customer-app-nav').waitFor()
  assert.equal(await page.locator('.customer-app-nav svg').count(), 3)
  assert.equal((await page.locator('.ah .app-bell').boundingBox()).x, bell.x)
  await page.goto('http://localhost:8282/c-map')
  await page.locator('.mtop').waitFor()
  assert.equal(await page.locator('.mtop > .pill').count(), 1)
  console.log(
    'PASS: full-height initial map, swipe up/down, click toggle, facility detail, stable map, no page scrolling',
  )
} finally {
  await browser.close()
  await server?.close()
}
