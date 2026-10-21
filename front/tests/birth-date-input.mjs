import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
let browser
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage(),
    calls = [],
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    calls.push({ path, body: route.request().postDataJSON() })
    return route.fulfill({
      json: {
        success: true,
        data: path.includes('/check-')
          ? { available: true }
          : /\/(send|employee-check)$/.test(path)
            ? { expiresInSeconds: 180, resendAfterSeconds: 60 }
            : null,
      },
    })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  await page.goto(base + '/admin-signup')
  const year = page.getByLabel('생년월일 연도', { exact: true }),
    month = page.getByLabel('생년월일 월', { exact: true }),
    day = page.getByLabel('생년월일 일', { exact: true })
  await year.selectOption('2000')
  await month.selectOption('2')
  assert.equal(await day.locator('option').count(), 30)
  await day.selectOption('29')
  await year.selectOption('2001')
  assert.equal(await day.inputValue(), '')
  assert.equal(await day.locator('option').count(), 29)
  await month.selectOption('1')
  await day.selectOption('31')
  await month.selectOption('4')
  assert.equal(await day.inputValue(), '')
  assert.equal(await day.locator('option').count(), 31)
  const today = await page.evaluate(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date())
    return Object.fromEntries(parts.map((p) => [p.type, Number(p.value)]))
  })
  await year.selectOption(String(today.year))
  await month.selectOption(String(today.month))
  assert.equal(await month.locator('option').count(), today.month + 1)
  assert.equal(await day.locator('option').count(), today.day + 1)
  await page.getByLabel('이름', { exact: true }).fill('김관리')
  await page.getByLabel('휴대전화', { exact: true }).fill('01012345678')
  const before = calls.filter((c) => c.path.endsWith('/employee-check')).length
  await page.getByRole('button', { name: '다음', exact: true }).click()
  assert.equal(calls.filter((c) => c.path.endsWith('/employee-check')).length, before)
  await year.selectOption('1990')
  await month.selectOption('1')
  await day.selectOption('2')
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    )
  }
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByLabel('인증번호', { exact: true }).waitFor()
  assert(calls.some((c) => c.path.endsWith('/employee-check') && c.body.birthDate === '1990-01-02'))
  await page.goto(base + '/signup')
  await page.getByLabel('휴대전화', { exact: true }).fill('01012345678')
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByLabel('인증번호', { exact: true }).fill('123456')
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByRole('button', { name: '가입 신청', exact: true }).waitFor()
  assert.equal(await page.locator('.verification-timing').count(), 0)
  await page.getByLabel('아이디', { exact: true }).fill('birthday_test')
  await page.getByLabel('이름', { exact: true }).fill('홍고객')
  await page.getByLabel('비밀번호', { exact: true }).fill('Password1!')
  await page.getByLabel('비밀번호 확인', { exact: true }).fill('Password1!')
  await year.selectOption('2000')
  await month.selectOption('2')
  await day.selectOption('29')
  await page.getByRole('button', { name: '가입 신청', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '회원가입이 완료' }).waitFor()
  assert(calls.some((c) => c.path === '/api/customers/signup' && c.body.birthDate === '2000-02-29'))
  assert.deepEqual(errors, [])
  console.log(
    'PASS leap years, month lengths, future dates, required selection, ISO date payloads, hidden signup countdown and mobile layout',
  )
} finally {
  await browser?.close()
  await server.close()
}
