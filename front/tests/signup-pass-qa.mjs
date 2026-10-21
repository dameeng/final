import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  base = server.resolvedUrls.local[0]
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    calls = [],
    errors = []
  let signedIn = false
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget {
      close() {}
    }
  })
  await page.route('**/api/**', (r) => {
    const request = r.request(),
      path = new URL(request.url()).pathname
    calls.push({ path, method: request.method() })
    let data = []
    if (path === '/api/managers/me') data = null
    if (path === '/api/customers/me')
      data = signedIn ? { id: 1, name: '고객', loginId: 'customer' } : null
    if (path === '/api/customers/login') {
      signedIn = true
      data = { id: 1, name: '고객' }
    }
    if (path.includes('/check-')) data = { available: true }
    if (path.includes('/phone-code/send')) data = { expiresInSeconds: 180, resendAfterSeconds: 60 }
    return r.fulfill({ json: { success: true, data } })
  })
  await page.goto(base + 'customer-app/screen-1')
  await page.getByRole('heading', { name: '고객 로그인' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'PASS로 로그인', exact: true }).count(), 0)
  await page.getByLabel('아이디', { exact: true }).fill('customer')
  await page.getByLabel('비밀번호', { exact: true }).fill('Password1!')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await page.waitForURL('**/customer-app/screen-5')
  assert(
    calls.some((c) => c.path === '/api/customers/login' && c.method === 'POST'),
    'existing real login remains in use',
  )
  signedIn = false
  await page.goto(base + 'customer-app/screen-2')
  const phone = page.getByRole('group', { name: '휴대전화', exact: true })
  for (const [i, value] of ['010', '1234', '5678'].entries())
    await phone.locator('input').nth(i).fill(value)
  const before = calls.filter((c) => c.method === 'POST').length
  await page.getByRole('button', { name: 'PASS로 본인인증', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'PASS 회원가입 본인인증' })
  await dialog.waitFor()
  assert(await dialog.getByRole('button', { name: 'PASS 인증 요청', exact: true }).isDisabled())
  await dialog.getByRole('button', { name: 'KT', exact: true }).click()
  await dialog.getByLabel('PASS 이름', { exact: true }).fill('홍길동')
  await dialog.getByLabel('생년월일 연도', { exact: true }).selectOption('1995')
  await dialog.getByLabel('생년월일 월', { exact: true }).selectOption('3')
  await dialog.getByLabel('생년월일 일', { exact: true }).selectOption('12')
  await dialog.getByLabel('필수 항목 전체 동의', { exact: true }).check()
  await dialog.getByRole('button', { name: 'PASS 인증 요청', exact: true }).click()
  await dialog.getByRole('button', { name: '인증 완료 확인', exact: true }).click()
  await dialog.getByRole('button', { name: '회원가입 계속하기', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await page.getByLabel('이름', { exact: true }).inputValue(), '홍길동')
  assert.equal(
    calls.filter((c) => c.method === 'POST').length,
    before,
    'PASS preview does not send fake verification to the backend',
  )
  await page.getByLabel('아이디', { exact: true }).fill('pass-demo')
  await page.getByLabel('비밀번호', { exact: true }).fill('Password1!')
  await page.getByLabel('비밀번호 확인', { exact: true }).fill('Password1!')
  await page.getByRole('button', { name: '가입 신청', exact: true }).click()
  await page.getByText(/실제 계정은 생성되지 않았습니다/).waitFor()
  assert.equal(
    calls.filter((c) => c.method === 'POST').length,
    before,
    'demo never creates an account or logs in',
  )
  await page.goto(base + 'customer-app/screen-2')
  for (const [i, value] of ['011', '2345', '6789'].entries())
    await phone.locator('input').nth(i).fill(value)
  await page.getByRole('button', { name: '문자 인증', exact: true }).click()
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByLabel('인증번호', { exact: true }).waitFor()
  assert(
    calls.some((c) => c.path === '/api/customers/phone-code/send' && c.method === 'POST'),
    'existing SMS verification stays available',
  )
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS signup PASS: original password login, signup-only preview, carrier/identity/consent/wait/completion, field handoff, no fake backend auth/signup, real SMS path, mobile',
  )
} finally {
  await browser.close()
  await server.close()
}
