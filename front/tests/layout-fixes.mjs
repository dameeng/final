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
  await page.goto('http://localhost:8282/info/app-guide')
  const sidebar = await page.locator('.customer-section-sidebar').boundingBox(),
    hero = await page.locator('.app-guide-hero').boundingBox()
  assert(Math.abs(sidebar.y - hero.y) < 1, 'sidebar and content must align below breadcrumbs')
  await page.goto('http://localhost:8282/c-map')
  await page.locator('#lst .it').first().click()
  await page.locator('#cctvb').scrollIntoViewIfNeeded()
  const before = await page.locator('.mapw').boundingBox(),
    scroll = await page.evaluate(() => scrollY)
  await page.locator('#cctvb').click()
  await page.getByRole('dialog').waitFor({ state: 'visible' })
  const during = await page.locator('.mapw').boundingBox()
  for (const key of ['x', 'y', 'width', 'height'])
    assert(Math.abs(before[key] - during[key]) < 1, 'background shifted: ' + key)
  assert.equal(await page.evaluate(() => scrollY), scroll)
  await page.getByRole('button', { name: 'CCTV 닫기' }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  const after = await page.locator('.mapw').boundingBox()
  assert(Math.abs(after.x - before.x) < 1)
  await page.goto('http://localhost:8282/my-home')
  await page.getByRole('button', { name: '회원 화면 보기', exact: true }).click()
  await page
    .locator('.mypage-sidebar')
    .getByRole('link', { name: '알림 내역', exact: false })
    .click()
  const toggle = page.locator('.page-my-alerts #m')
  await toggle.waitFor()
  const checked = await toggle.evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    width: el.getBoundingClientRect().width,
    color: getComputedStyle(el).backgroundColor,
    text: getComputedStyle(el, '::after').content,
  }))
  assert.equal(checked.height, 28)
  assert.equal(checked.width, 52)
  assert.equal(checked.text, '"ON"')
  await toggle.uncheck()
  await page.waitForFunction(
    (color) =>
      getComputedStyle(document.querySelector('.page-my-alerts #m')).backgroundColor !== color,
    checked.color,
  )
  assert.equal(await toggle.evaluate((el) => getComputedStyle(el, '::after').content), '"OFF"')
  assert.notEqual(
    await toggle.evaluate((el) => getComputedStyle(el).backgroundColor),
    checked.color,
  )
  await page
    .locator('.mypage-sidebar')
    .getByRole('link', { name: '계정 설정', exact: true })
    .click()
  await page.locator('#t-push').click()
  assert.equal(await page.locator('#m').evaluate((el) => el.getBoundingClientRect().height), 28)
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    )
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS sidebar below breadcrumbs; stable CCTV background and scroll; ON/OFF labels/colors/28px switches; mobile overflow; no runtime errors',
  )
} finally {
  await browser.close()
  await server?.close()
}
