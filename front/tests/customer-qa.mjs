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
  const context = await browser.newContext(),
    page = await context.newPage(),
    errors = [],
    calls = []
  let duplicate = false
  page.on('pageerror', (e) => errors.push(e.message))
  await context.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url())
    calls.push(url.pathname)
    let data = {}
    if (url.pathname.includes('/check-')) data = { available: !duplicate }
    else if (url.pathname.endsWith('/login') || url.pathname.endsWith('/me'))
      data = {
        id: 1,
        name: '테스트',
        loginId: 'tester',
        phone: '01012345678',
        email: 'test@example.com',
      }
    else if (url.pathname.endsWith('/device-tokens')) data = []
    else if (url.pathname.endsWith('/inquiries'))
      data = { items: [], page: 1, size: 20, totalItems: 0, totalPages: 0 }
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto('http://localhost:8282/signup')
  await page.getByLabel('휴대전화', { exact: true }).fill('01012345678')
  duplicate = true
  await page.locator('.auth-service button[type=submit]').click()
  await page.locator('.service-error').waitFor()
  assert(!calls.includes('/api/customers/phone-code/send'))
  duplicate = false
  await page.locator('.auth-service button[type=submit]').click()
  await page.getByLabel('인증번호', { exact: true }).fill('123456')
  await page.locator('.auth-service button[type=submit]').click()
  await page.getByRole('heading', { name: '필수 입력사항' }).waitFor()
  assert(await page.getByRole('heading', { name: '선택 입력사항' }).isVisible())
  await page.getByLabel('이메일', { exact: true }).fill('test@example.com')
  await page.locator('.duplicate-check').click()
  await page.waitForTimeout(50)
  assert(calls.includes('/api/customers/check-email'))
  await page.goto('http://localhost:8282/my-inquiries')
  assert.equal(await page.locator('.mypage-sidebar a[href="/my-alerts"]').count(), 0)
  await page.locator('.guest-inquiry-form input').nth(0).fill('reply@example.com')
  await page.locator('.guest-inquiry-form input').nth(1).fill('문의 제목')
  await page.locator('.guest-inquiry-form textarea').fill('문의 내용')
  await page.locator('.guest-inquiry-form button[type=submit]').click()
  await page.locator('.guest-inquiry-dialog[open]').waitFor()
  await page.locator('.guest-inquiry-dialog a').click()
  await page.waitForURL('**/login?next=/my-inquiry-new')
  await page.getByLabel('아이디', { exact: true }).fill('tester')
  await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.locator('.auth-service button[type=submit]').click()
  await page.waitForURL('**/my-inquiry-new')
  await page.locator('.service-modal[open]').waitFor()
  assert.equal(await page.getByLabel('제목', { exact: true }).inputValue(), '문의 제목')
  assert.equal(
    await page.locator('.service-form-fields .required-label').first().innerText(),
    '필수',
  )
  await page.goto('http://localhost:8282/my-home')
  await page.locator('.account-summary').waitFor()
  assert.equal(await page.locator('.account-panel input').count(), 0)
  await page.goto('http://localhost:8282/my-account')
  await page.getByRole('heading', { name: '회원정보 수정' }).waitFor()
  assert.equal(await page.locator('.account-panel summary').count(), 0)
  await page.locator('.account-panel').first().locator('button[type=submit]').click()
  await page.locator('.feedback-toast').waitFor()
  await page.goto('http://localhost:8282/my-withdraw')
  await page.locator('.account-panel[open]').waitFor()
  assert.equal(await page.locator('.account-panel').count(), 1)
  for (const width of [1920, 1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 740 })
    await page.goto('http://localhost:8282/info/faq')
    await page.locator('.faq-category').first().waitFor()
    const sizes = await page
      .locator('.faq-category')
      .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().width))
    assert(sizes.every((s) => s === sizes[0]))
    assert.equal(await page.locator('.section-sidebar-bottom').count(), 0)
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    )
    const blocked = await page
      .locator('.customer-header a,.customer-header button')
      .evaluateAll((es) =>
        es
          .filter(
            (e) =>
              !e.closest('#customer-header-dropdown') &&
              e.getBoundingClientRect().width &&
              getComputedStyle(e).visibility !== 'hidden',
          )
          .filter((e) => {
            const r = e.getBoundingClientRect()
            return !e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
          })
          .map((e) => e.textContent),
      )
    assert.deepEqual(blocked, [], 'header overlap at ' + width)
  }
  await page.locator('.customer-member-nav .customer-logout button').click()
  await page.waitForURL('**/login')
  assert(await page.getByRole('link', { name: '로그인', exact: true }).first().isVisible())
  await context.route('https://**', (route) => route.abort())
  await page.addInitScript(() => localStorage.setItem('routel-theme', 'dark'))
  for (const [width, height] of [
    [1366, 540],
    [844, 390],
    [390, 640],
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto('http://localhost:8282/c-map')
    await page.locator('#lst .it').first().click()
    await page.locator('#cctvb').scrollIntoViewIfNeeded()
    await page.locator('#cctvb').click()
    const modal = page.locator('#pop')
    await modal.waitFor()
    const rect = await modal.boundingBox()
    assert(rect.y >= 0 && rect.y + rect.height <= height)
    const confirm = modal.locator('.cctv-confirm-footer button')
    const r = await confirm.boundingBox()
    assert(r.y >= 0 && r.y + r.height <= height)
    assert(
      await confirm.evaluate((e) => {
        const r = e.getBoundingClientRect()
        return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
      }),
    )
    await confirm.click()
    assert.equal(await modal.evaluate((e) => e.open), false)
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS customer QA: signup requirements/duplicates, guest inquiry resume, separated account pages, save toast/logout, FAQ badges, navigation at six widths, dark CCTV actions at short/landscape/mobile sizes',
  )
} finally {
  await browser.close()
  await server?.close()
}
