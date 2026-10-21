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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const go = (path) => page.goto('http://localhost:8282' + path)
  await go('/c-map')
  await page.locator('.customer-menu-link').filter({ hasText: 'About us' }).hover()
  assert.equal(await page.locator('.customer-submenu:visible').count(), 0)
  await page.locator('.customer-menu-link').filter({ hasText: 'About us' }).click()
  await page.waitForURL('**/info/company')
  await page.locator('.header-download').click()
  await page.waitForURL('**/info/app-guide#install')
  assert.equal(await page.locator('.header-alert-link svg').count(), 1)
  await page.locator('.header-mypage').click()
  await page.waitForURL('**/my-home')
  assert.equal(await page.locator('.mypage-sidebar nav a').count(), 2)
  assert.equal(await page.locator('.page-my-home').count(), 0)
  await page.locator('.mypage-sidebar').getByRole('link', { name: '문의', exact: true }).click()
  await page.locator('.guest-inquiry-form').waitFor()
  await go('/my-account')
  await page.waitForURL('**/my-alerts')
  assert.equal(await page.locator('#f-name').count(), 0)
  for (const width of [1440, 1280, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const path of ['/', '/my-home', '/my-inquiries']) {
      await go(path)
      await page.locator('.customer-header').waitFor()
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
        `${path} overflows at ${width}`,
      )
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.route('**/api/customers/login', (route) =>
    route.fulfill({ json: { success: true, data: { id: 7, name: '테스트 회원' } } }),
  )
  await go('/login')
  await page.locator('input[autocomplete=username]').fill('member')
  await page.locator('input[autocomplete=current-password]').fill('test-password')
  await page.locator('.auth-page button[type=submit]').click()
  await page.waitForURL('http://localhost:8282/')
  await page.locator('.header-mypage').click()
  await page.waitForURL('**/my-home')
  await page.locator('.mypage-sidebar nav a').first().waitFor()
  assert.equal(await page.locator('.mypage-sidebar nav a').count(), 6)
  await page
    .locator('.mypage-sidebar')
    .getByRole('link', { name: '계정 설정', exact: true })
    .click()
  await page.locator('#f-name').waitFor()
  assert.equal(await page.locator('.customer-header:visible').count(), 1)
  assert.equal(await page.locator('.page-my-account .side:visible').count(), 0)
  await page.locator('#t-pw').click()
  await page.locator('#p0').waitFor({ state: 'visible' })
  await page.locator('#t-push').click()
  await page.locator('#m').waitFor({ state: 'visible' })
  assert.deepEqual(errors, [])
  console.log(
    'PASS header links/download/SVG bell; guest access and protected settings; member sidebar/tabs; responsive widths; no runtime errors',
  )
} finally {
  await browser.close()
  await server?.close()
}
