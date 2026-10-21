import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ server: { host: '127.0.0.1', port: 8294, strictPort: true } })
await server.listen()
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const go = (path) => page.goto('http://127.0.0.1:8294' + path)
try {
  await go('/signup')
  await page
    .locator('.customer-main-nav')
    .getByRole('link', { name: 'About us', exact: true })
    .click()
  await page.locator('.customer-section-sidebar nav a').last().click()
  await page.locator('.app-guide-hero').waitFor()
  await go('/signup')
  assert.equal(await page.getByRole('button', { name: '인증번호 받기', exact: true }).count(), 0)
  await page.getByLabel('휴대폰 가운데 4자리').fill('1234')
  await page.getByLabel('휴대폰 마지막 4자리').evaluate((el) => {
    if (document.activeElement !== el) throw Error('Phone focus did not advance')
  })
  await page.getByLabel('휴대폰 마지막 4자리').fill('5678')
  await page.getByRole('button', { name: '인증번호 받기', exact: true }).click()
  await page.getByPlaceholder('인증번호 6자리').waitFor()
  await page.getByLabel('휴대폰 가운데 4자리').fill('123')
  assert.equal(await page.getByPlaceholder('인증번호 6자리').count(), 0)
  await page.getByLabel('이메일 도메인 선택').selectOption('custom')
  await page.getByLabel('이메일 도메인', { exact: true }).fill('example.com')
  await page.getByLabel('아이디', { exact: true }).fill('tester')
  await page.getByRole('button', { name: '중복 확인', exact: true }).click()
  assert.match(await page.getByRole('status').innerText(), /API/)
  await go('/c-map')
  const map = await page.locator('.mapw').boundingBox(),
    list = await page.locator('aside[aria-label="지하차도 목록"]').boundingBox()
  assert(list.x > map.x + map.width - 1)
  await page.locator('.it').first().click()
  const detail = await page.locator('.swapped-detail').boundingBox()
  assert.equal(Math.round(detail.x), Math.round(list.x))
  assert(await page.locator('#w').innerText())
  await page.getByRole('button', { name: '목록으로', exact: true }).click()
  await page.locator('#lst').waitFor({ state: 'visible' })
  await go('/info/weather')
  await page.waitForURL('**/c-map')
  await page.route('**/api/underpasses**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          items: [
            {
              id: 1,
              name: '초량1지하차도',
              roadAddress: '부산광역시 동구',
              latitude: 35.12,
              longitude: 129.04,
              currentStatus: 'NORMAL',
              currentRiskLevel: 'SAFE',
            },
          ],
          totalPages: 1,
        },
      },
    }),
  )
  await page.route('**/api/weather?**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          condition: '맑음',
          temperature: 21,
          humidity: 55,
          rainfall: 0,
          observedAt: new Date().toISOString(),
        },
      },
    }),
  )
  await go('/c-live-map')
  await page.getByRole('button', { name: '초량1지하차도', exact: true }).click()
  await page.getByRole('region', { name: '지하차도 인근 날씨' }).getByText(/21°C/).waitFor()
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const path of ['/signup', '/c-map', '/info/company', '/c-live-map']) {
      await go(path)
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
        `${path} overflows at ${width}`,
      )
    }
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS: full navigation, signup fields, phone focus, sidebar, weather, redirects, responsive widths, runtime errors',
  )
} finally {
  await browser.close()
  await server.close()
}
