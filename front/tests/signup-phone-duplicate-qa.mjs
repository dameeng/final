import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage(), calls = [], errors = []
  let response = 'available', pending = null
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget { close() {} }
  })
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    calls.push({ path, method: req.method(), body: req.postData() })
    let data = null
    if (path === '/api/customers/check-phone') {
      const mode = response
      if (mode.startsWith('delayed')) await new Promise(resolve => { pending = resolve })
      if (mode.endsWith('error')) {
        await route.fulfill({ status: 503, json: { success: false, message: '중복 확인 요청 실패' } })
        return
      }
      data = { available: mode !== 'unavailable' }
    }
    if (path.endsWith('/phone-code/send') || path.endsWith('/signup/employee-check') ||
        path.endsWith('/password-reset/request'))
      data = { expiresInSeconds: 180, resendAfterSeconds: 60 }
    await route.fulfill({ json: { success: true, data } })
  })
  const base = server.resolvedUrls.local[0]
  const next = page.locator('.auth-service > form > .auth-buttons button[type=submit]')
  const duplicate = page.locator('.auth-field-phone .duplicate-check')
  const last = page.getByLabel('휴대전화 마지막 자리', { exact: true })
  const phoneRequests = () => calls.filter(c => c.path === '/api/customers/check-phone').length
  const sends = () => calls.filter(c => c.path === '/api/customers/phone-code/send').length
  async function fillPhone() {
    await page.getByLabel('휴대전화 앞자리', { exact: true }).fill('010')
    await page.getByLabel('휴대전화 가운데 자리', { exact: true }).fill('1234')
    await last.fill('5678')
  }
  async function check() {
    await duplicate.click()
    await expect(page.locator('.auth-field-phone [role=status]')).toHaveText('사용 가능합니다.')
    await expect(next).toBeEnabled()
  }

  for (const theme of ['light', 'dark']) {
    await page.addInitScript(value => localStorage.setItem('routel-theme', value), theme)
    for (const width of [1920, 1366, 390]) {
      await page.setViewportSize({ width, height: width === 1366 ? 768 : 900 })
      await page.goto(base + 'signup')
      await fillPhone()
      await expect(next).toBeDisabled()
      const count = phoneRequests(), sent = sends()
      // A submitted form must also be guarded, independently of the disabled button.
      await page.locator('.auth-service > form').dispatchEvent('submit')
      await expect(page.getByRole('alert')).toHaveText('휴대전화 중복 확인을 완료해 주세요.')
      await last.press('Enter')
      assert.equal(phoneRequests(), count, 'Next does not automatically check duplicates')
      assert.equal(sends(), sent, 'unchecked phone never sends SMS')
      const a = await duplicate.boundingBox(), b = await next.boundingBox()
      assert(Math.abs(b.y - a.y - a.height - 12) < 1, `12px button gap at ${width}/${theme}`)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      await check()
      await last.fill('5679')
      await expect(next).toBeDisabled()
      await expect(page.locator('.auth-field-phone [role=status]')).toHaveCount(0)
      await last.fill('5678')
      await expect(next).toBeDisabled() // returning to an old value still needs a new check
      await check()
      if (theme === 'dark' && width === 1366) {
        await mkdir('test-results', { recursive: true })
        await page.screenshot({ path: 'test-results/signup-phone-duplicate-dark.png', fullPage: true })
      }
      const checkedCount = phoneRequests()
      await next.click()
      await expect(page.getByLabel('인증번호', { exact: true })).toBeVisible()
      assert.equal(sends(), sent + 1)
      assert.equal(phoneRequests(), checkedCount, 'Next reuses the explicit check')
    }
  }

  await page.goto(base + 'signup')
  await fillPhone()
  response = 'unavailable'
  await duplicate.click()
  await expect(page.locator('.auth-field-phone [role=status]')).toContainText('이미 등록')
  await expect(next).toBeDisabled()
  response = 'error'
  await duplicate.click()
  await expect(page.locator('.auth-field-phone [role=status]')).toHaveText('중복 확인 요청 실패')
  await expect(next).toBeDisabled()

  for (const mode of ['delayed-available', 'delayed-error']) {
    response = mode
    pending = null
    await duplicate.click()
    await expect.poll(() => !!pending).toBe(true)
    await expect(next).toBeDisabled()
    await last.fill(mode === 'delayed-available' ? '6789' : '7890')
    pending()
    await expect(duplicate).toHaveText('중복 확인')
    await expect(page.locator('.auth-field-phone [role=status]')).toHaveCount(0)
    await expect(next).toBeDisabled()
  }
  response = 'available'
  await check()
  await page.getByLabel('휴대전화 국가번호').selectOption('+1')
  await expect(next).toBeDisabled()
  await check()

  // The same SMS requirement applies to the mobile customer route.
  await page.goto(base + 'customer-app/screen-2')
  await fillPhone()
  await expect(next).toBeEnabled() // existing PASS preview is the mobile default
  await page.getByRole('button', { name: '문자 인증', exact: true }).click()
  await expect(next).toBeDisabled()
  await check()
  await next.click()
  await expect(page.getByLabel('인증번호', { exact: true })).toBeVisible()

  // Shared component routes must keep their existing first-step behavior.
  await page.goto(base + 'password-reset')
  await page.getByLabel('아이디', { exact: true }).fill('customer')
  await fillPhone()
  await expect(next).toBeEnabled()
  await next.click()
  await expect(page.getByLabel('인증번호', { exact: true })).toBeVisible()
  assert(calls.some(c => c.path === '/api/customers/password-reset/request'))
  await page.goto(base + 'admin-signup')
  await page.getByLabel('이름', { exact: true }).fill('관리자')
  await page.getByLabel('생년월일 연도', { exact: true }).fill('1990')
  await page.getByLabel('생년월일 월', { exact: true }).fill('1')
  await page.getByLabel('생년월일 일', { exact: true }).fill('1')
  await fillPhone()
  await expect(next).toBeEnabled()
  await next.click()
  await expect(page.getByLabel('인증번호', { exact: true })).toBeVisible()
  assert(calls.some(c => c.path === '/api/managers/signup/employee-check'))
  assert.deepEqual(errors, [])
  console.log('PASS explicit phone check, submit/Enter guard, edits/country/old-value invalidation, unavailable/failed/stale responses, SMS send, web/mobile, light/dark, 12px gap, shared reset/admin routes')
} finally {
  await browser.close()
  await server.close()
}
