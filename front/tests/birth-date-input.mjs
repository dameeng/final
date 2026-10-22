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
  const year = page.getByLabel('생년월일 연도', { exact: true }).first(),
    month = page.getByLabel('생년월일 월', { exact: true }).first(),
    day = page.getByLabel('생년월일 일', { exact: true }).first()
  await year.fill('2000')
  await year.fill('9999')
  const yearList = page.locator('.birth-date-input [role=listbox]').first()
  assert.equal(await yearList.locator('[role=option]').count(),121)
  const inputBounds = await year.boundingBox(), listBounds = await yearList.boundingBox()
  assert(Math.abs(inputBounds.x-listBounds.x)<2)
  assert(Math.abs(inputBounds.width-listBounds.width)<2)
  assert(listBounds.y>=inputBounds.y+inputBounds.height)
  await yearList.getByRole('option',{name:'2000',exact:true}).click()
  assert.equal(await year.inputValue(),'2000')
  await month.fill('2')
  assert.equal(await page.locator('.birth-date-input [role=listbox]').nth(2).locator('[role=option]').count(), 29)
  await day.fill('29')
  await year.fill('2001')
  assert.equal(await day.inputValue(), '')
  assert.equal(await page.locator('.birth-date-input [role=listbox]').nth(2).locator('[role=option]').count(), 28)
  await month.fill('1')
  await day.fill('31')
  await month.fill('4')
  assert.equal(await day.inputValue(), '')
  assert.equal(await page.locator('.birth-date-input [role=listbox]').nth(2).locator('[role=option]').count(), 30)
  const today = await page.evaluate(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date())
    return Object.fromEntries(parts.map((p) => [p.type, Number(p.value)]))
  })
  await year.fill(String(today.year))
  await month.fill(String(today.month))
  assert.equal(await page.locator('.birth-date-input [role=listbox]').nth(1).locator('[role=option]').count(), today.month)
  assert.equal(await page.locator('.birth-date-input [role=listbox]').nth(2).locator('[role=option]').count(), today.day)
  await page.getByLabel('이름', { exact: true }).fill('김관리')
  for (const [i, part] of ['010', '1234', '5678'].entries()) await page.locator('.phone-input input').nth(i).fill(part)
  const before = calls.filter((c) => c.path.endsWith('/employee-check')).length
  await page.getByRole('button', { name: '다음', exact: true }).click()
  assert.equal(calls.filter((c) => c.path.endsWith('/employee-check')).length, before)
  await year.fill('1990')
  await month.fill('1')
  await day.fill('2')
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
  for (const [i, part] of ['010', '1234', '5678'].entries()) await page.locator('.phone-input input').nth(i).fill(part)
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.locator('.verification-code-input input').first().fill('123456')
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByRole('button', { name: '가입 신청', exact: true }).waitFor()
  assert.equal(await page.locator('.verification-timing').count(), 0)
  await page.getByLabel('아이디', { exact: true }).fill('birthday_test')
  await page.getByLabel('이름', { exact: true }).fill('홍고객')
  await page.getByLabel('비밀번호', { exact: true }).fill('Password1!')
  await page.getByLabel('비밀번호 확인', { exact: true }).fill('Password1!')
  await year.fill('2000')
  await month.fill('2')
  await day.fill('29')
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
