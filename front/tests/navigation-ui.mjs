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
  const page = await browser.newPage({ viewport: { width: 390, height: 1000 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => sessionStorage.setItem('routel-member-preview', '1'))
  await page.goto('http://localhost:8282/customer-app/screen-7')
  await page.locator('.directions-form button[type=submit],.directions-form .btn.p').click()
  await page.locator('.directions-results').waitFor({ timeout: 45000 })
  assert.match(await page.locator('.directions-results>button').first().innerText(), /km/)
  await page.locator('.directions-results summary').click()
  assert((await page.locator('.directions-results li').count()) > 0)
  await page.waitForFunction(
    () =>
      !document
        .querySelector('.directions-local-info [role=status]')
        ?.textContent.includes('조회 중'),
    {},
    { timeout: 40000 },
  )
  await page.locator('.directions-weather').waitFor()
  assert.match(await page.locator('.directions-weather').innerText(), /기상청/)
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
  )
  const input = page.locator('.directions-form label').nth(1).locator('input')
  await input.fill('부산 기장 철마삼거리')
  await page.locator('.directions-form .btn.p').click()
  await page.locator('.directions-camera-list button').first().waitFor({ timeout: 45000 })
  const count = await page.locator('.directions-camera-list button').count()
  await page.locator('.directions-camera-list button').first().click()
  await page.locator('.directions-camera-player video').waitFor()
  await page.screenshot({ path: 'tests/navigation-preview.png', fullPage: true })
  await page.goto('http://localhost:8282/customer-app/screen-5')
  await page.waitForFunction(() => document.querySelector('.real-map-host'))
  const nestedSvgRule = await page.evaluate(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const div = document.createElement('div')
    div.append(svg)
    document.querySelector('.real-map-host').append(div)
    const position = getComputedStyle(svg).position
    div.remove()
    return position
  })
  assert.equal(nestedSvgRule, 'static')
  assert.deepEqual(errors, [])
  console.log(
    'PASS real directions with SDK place fallback; polyline/guides; live KMA; ITS cameras ' +
      count +
      '; HLS player; mobile width; SDK SVG no stretching',
  )
} finally {
  await browser.close()
  await server?.close()
}
