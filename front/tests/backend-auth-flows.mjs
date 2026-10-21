import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const b = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
try {
  const p = await b.newPage({ viewport: { width: 390, height: 900 } }),
    calls = [],
    errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  await p.route('**/api/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname,
      body = request.postDataJSON()
    calls.push({ path, method: request.method(), body })
    let data = null
    if (['/check-login-id', '/check-phone', '/check-email'].some((suffix) => path.endsWith(suffix)))
      data = { available: true }
    else if (path.endsWith('/login'))
      data = {
        id: 7,
        name: '관리자',
        role: 'REGIONAL_ADMIN',
        regions: [{ id: 1, name: '부산 동구' }],
      }
    else if (path.endsWith('/me'))
      data = {
        id: 7,
        name: '관리자',
        role: 'REGIONAL_ADMIN',
        regions: [{ id: 1, name: '부산 동구' }],
      }
    else if (path.includes('/dashboard/'))
      data = path.endsWith('facility-kpi') ? { facilityCount: 0 } : []
    else if (path === '/api/underpasses')
      data = { items: [], page: 1, totalItems: 0, totalPages: 0 }
    await route.fulfill({ json: { success: true, data } })
  })
  await p.goto('http://localhost:8282/signup')
  await p.getByLabel('휴대전화', { exact: true }).fill('01012345678')
  await p.getByRole('button', { name: '다음', exact: true }).click()
  await p.getByLabel('인증번호', { exact: true }).fill('123456')
  await p.getByRole('button', { name: '다음', exact: true }).click()
  await p.getByLabel('아이디', { exact: true }).fill('customer1')
  await p.getByLabel('비밀번호', { exact: true }).fill('Password1!')
  await p.getByLabel('비밀번호 확인', { exact: true }).fill('Password1!')
  await p.getByLabel('이름', { exact: true }).fill('홍고객')
  await p.getByLabel('생년월일 연도', { exact: true }).selectOption('1990')
  await p.getByLabel('생년월일 월', { exact: true }).selectOption('1')
  await p.getByLabel('생년월일 일', { exact: true }).selectOption('1')
  await p.getByRole('button', { name: '가입 신청', exact: true }).click()
  await p.getByRole('status').filter({ hasText: '완료' }).waitFor()
  assert(
    calls.some(
      (c) =>
        c.path === '/api/customers/signup' &&
        c.body.phone === '01012345678' &&
        c.body.email === null,
    ),
  )
  await p.goto('http://localhost:8282/admin-signup')
  await p.getByLabel('이름', { exact: true }).fill('김관리')
  await p.getByLabel('생년월일 연도', { exact: true }).selectOption('1990')
  await p.getByLabel('생년월일 월', { exact: true }).selectOption('1')
  await p.getByLabel('생년월일 일', { exact: true }).selectOption('1')
  await p.getByLabel('휴대전화', { exact: true }).fill('01011112222')
  await p.getByRole('button', { name: '다음', exact: true }).click()
  await p.getByLabel('인증번호', { exact: true }).fill('123456')
  await p.getByRole('button', { name: '다음', exact: true }).click()
  await p.getByLabel('아이디', { exact: true }).fill('manager1')
  await p.getByLabel('비밀번호', { exact: true }).fill('Password1!')
  await p.getByLabel('비밀번호 확인', { exact: true }).fill('Password1!')
  await p.getByRole('button', { name: '가입 신청', exact: true }).click()
  await p.getByRole('status').filter({ hasText: '접수' }).waitFor()
  assert(
    calls.some((c) => c.path === '/api/managers/signup/employee-check' && c.body.name === '김관리'),
  )
  assert(
    calls.some(
      (c) =>
        c.path === '/api/managers/signup/phone-code/verify' &&
        Object.keys(c.body).join(',') === 'code',
    ),
  )
  await p.goto('http://localhost:8282/admin-password-reset')
  await p.getByLabel('아이디', { exact: true }).fill('manager1')
  await p.getByLabel('휴대전화', { exact: true }).fill('01011112222')
  await p.getByRole('button', { name: '다음', exact: true }).click()
  await p.getByLabel('인증번호', { exact: true }).fill('123456')
  await p.getByRole('button', { name: '다음', exact: true }).click()
  await p.getByLabel('새 비밀번호', { exact: true }).fill('NewPassword1!')
  await p.getByLabel('새 비밀번호 확인', { exact: true }).fill('NewPassword1!')
  await p.getByRole('button', { name: '비밀번호 변경', exact: true }).click()
  await p.waitForURL('**/admin-login')
  assert(
    calls.some(
      (c) =>
        c.path === '/api/managers/password-reset/confirm' && c.body.newPassword === 'NewPassword1!',
    ),
  )
  await p.goto('http://localhost:8282/admin-app/screen-1')
  await p.getByLabel('아이디', { exact: true }).fill('manager1')
  await p.getByLabel('비밀번호', { exact: true }).fill('NewPassword1!')
  await p.getByRole('button', { name: '로그인', exact: true }).click()
  await p.waitForURL('**/admin-app/screen-3')
  assert((await p.locator('.service-mobile,.mobile-page').first().boundingBox()).width <= 430)
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
  assert.deepEqual(errors, [])
  console.log(
    'PASS customer phone verification/signup with optional email; manager employee/phone/signup; password reset phases; mobile manager login without legacy interception',
  )
} finally {
  await b.close()
}
