import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
const base = `http://127.0.0.1:${server.httpServer.address().port}`
let browser
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  const errors = [],
    calls = []
  let rejectSend = false,
    signedIn = false,
    timing = { expiresInSeconds: 180, resendAfterSeconds: 60 }
  page.on('pageerror', (e) => errors.push(e.message))
  await page.clock.install()
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    calls.push({ path, body: route.request().postDataJSON() })
    const send = /\/(send|employee-check|resend|request)$/.test(path)
    if (send && rejectSend)
      return route.fulfill({
        status: 500,
        json: { success: false, message: '발송 실패', data: null },
      })
    let data = path.includes('/check-')
      ? { available: true }
      : send
        ? { ...timing, maskedPhone: '010-****-5678' }
        : null
    if (path === '/api/managers/me' && signedIn)
      data = { id: 7, name: '관리자', role: 'REGIONAL_ADMIN', regions: [] }
    if (path === '/api/plate-logs') {
      const deadline = new Date((await page.evaluate(() => Date.now())) + 45_000).toISOString()
      data = {
        items: [
          { id: 1, reviewStatus: 'PENDING', reviewDeadline: deadline },
          { id: 2, reviewStatus: 'CONFIRMED', reviewDeadline: deadline },
        ],
        totalItems: 2,
        totalPages: 1,
        page: 1,
      }
    }
    if (['/api/regions', '/api/underpasses'].includes(path)) data = []
    await route.fulfill({ json: { success: true, data } })
  })
  for (const path of [
    '/signup',
    '/admin-signup',
    '/customer-app/screen-2',
    '/admin-app/signup',
    '/password-reset',
    '/admin-password-reset',
    '/customer-app/password-reset',
    '/admin-app/password-reset',
  ]) {
    await page.goto(base + path)
    const manager = path.includes('admin'),
      reset = path.includes('password-reset')
    if (reset) await page.getByLabel('아이디', { exact: true }).fill('timer_user')
    if (manager && !reset) {
      await page.getByLabel('이름', { exact: true }).fill('김관리')
      await page.getByLabel('생년월일 연도', { exact: true }).selectOption('1990')
      await page.getByLabel('생년월일 월', { exact: true }).selectOption('1')
      await page.getByLabel('생년월일 일', { exact: true }).selectOption('1')
    }
    await page.getByLabel('휴대전화', { exact: true }).fill('01012345678')
    await page.getByRole('button', { name: '다음', exact: true }).click()
    const timers = page.locator('.verification-timing')
    await timers.getByRole('timer').filter({ hasText: '03:00' }).waitFor()
    let resend = timers.getByRole('button', { name: /인증번호 다시 받기/ })
    assert.equal(await resend.innerText(), '인증번호 다시 받기')
    assert.equal(await timers.getByText(/재발송까지/).count(), 0)
    assert.equal(await timers.getByRole('timer').count(), 1)
    assert(await resend.isDisabled())
    await page.clock.fastForward(60_000)
    assert(await resend.isEnabled())
    assert((await timers.innerText()).includes('02:00'))
    await resend.click()
    await timers.getByRole('timer').filter({ hasText: '03:00' }).waitFor()
    assert(await resend.isDisabled())
    await page.clock.fastForward(180_000)
    await timers.getByRole('status').waitFor()
    assert(await page.getByRole('button', { name: '다음', exact: true }).isDisabled())
    await resend.click()
    await timers.getByRole('timer').filter({ hasText: '03:00' }).waitFor()
    await page.getByLabel('인증번호', { exact: true }).fill('123456')
    await page.getByRole('button', { name: '다음', exact: true }).click()
    if (reset) await timers.getByRole('timer').filter({ hasText: '30:00' }).waitFor()
    else {
      await page.getByRole('button', { name: '가입 신청', exact: true }).waitFor()
      assert.equal(await timers.count(), 0)
    }
    assert.equal(await page.locator('input[type="password"]').count(), 2)
    await page.clock.fastForward(30 * 60_000)
    assert(await page.locator('.auth-buttons button[type="submit"]').isDisabled())
    await page.getByRole('button', { name: '다시 인증하기', exact: true }).click()
    assert(await page.getByRole('button', { name: '다음', exact: true }).isDisabled())
    await timers.getByRole('button', { name: '인증번호 다시 받기', exact: true }).click()
    await timers.getByRole('timer').filter({ hasText: '03:00' }).waitFor()
    assert.equal(await page.getByLabel('인증번호', { exact: true }).inputValue(), '')
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    )
    if (path === '/admin-signup') {
      await page.getByLabel('인증번호', { exact: true }).fill('123456')
      await page.getByRole('button', { name: '다음', exact: true }).click()
      await page.getByLabel('아이디', { exact: true }).fill('timer_manager')
      await page.getByLabel('비밀번호', { exact: true }).fill('Password1!')
      await page.getByLabel('비밀번호 확인', { exact: true }).fill('Password1!')
      await page.getByRole('button', { name: '가입 신청', exact: true }).click()
      await page.getByRole('timer').filter({ hasText: '01:00' }).waitFor()
      await page.clock.fastForward(60_000)
      await page.getByRole('timer').filter({ hasText: '승인 예상 시간이 지났습니다.' }).waitFor()
      assert(
        calls.some((c) => c.path === '/api/managers/signup' && c.body.password === 'Password1!'),
      )
    }
    console.log('PASS', path, 'expiry, cooldown, resend, 30-minute validity, recovery')
  }
  // Server-provided settings take precedence; failed sends never start a timer.
  await page.goto(base + '/signup')
  await page.getByLabel('휴대전화', { exact: true }).fill('01012345678')
  rejectSend = true
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '발송 실패' }).waitFor()
  assert.equal(await page.locator('.verification-timing').count(), 0)
  rejectSend = false
  timing = { expiresInSeconds: 90, resendAfterSeconds: 10 }
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByRole('timer').filter({ hasText: '01:30' }).waitFor()
  await page.clock.fastForward(10_000)
  assert(await page.getByRole('button', { name: '인증번호 다시 받기', exact: true }).isEnabled())
  rejectSend = true
  await page.getByRole('button', { name: '인증번호 다시 받기', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '발송 실패' }).waitFor()
  assert((await page.locator('.verification-timing').innerText()).includes('01:20'))
  signedIn = true
  await page.goto(base + '/admin-data/reviews')
  await page.locator('.deadline-timer').filter({ hasText: '00:45' }).waitFor()
  assert.equal(await page.locator('.deadline-timer').count(), 1)
  await page.clock.fastForward(45_000)
  await page.locator('.deadline-timer').filter({ hasText: '시간 만료' }).waitFor()
  assert(
    calls.some(
      (c) => c.path === '/api/managers/password-reset/request' && c.body.loginId === 'timer_user',
    ),
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS server durations, send/resend failure, approval estimate, review deadline, mobile width, no runtime errors',
  )
} finally {
  await browser?.close()
  await server.close()
}
