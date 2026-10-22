import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage()
  await page.addInitScript(() => {
    window.OTPCredential = class {}
    Object.defineProperty(navigator.credentials, 'get', { configurable: true, value: (options) => {
      window.smsOptions = options
      return new Promise(resolve => { window.receiveSms = code => resolve({ code }) })
    } })
  })
  await page.route('**/api/**', r => r.fulfill({ json: { success: true, data: r.request().url().includes('/check-') ? { available: true } : null } }))
  await page.goto(server.resolvedUrls.local[0] + 'signup')
  const phone = page.locator('.phone-input input')
  for (const [i, part] of ['010', '1234', '5678'].entries()) await phone.nth(i).fill(part)
  await page.getByRole('button', { name: '다음', exact: true }).click()
  const inputs = page.locator('.verification-code-input input')
  await inputs.first().waitFor()
  await page.waitForFunction(() => !document.querySelector('.verification-code-input input')?.disabled)
  assert.equal(await inputs.count(), 6)
  await inputs.first().pressSequentially('123456')
  assert.deepEqual(await inputs.evaluateAll(els => els.map(el => el.value)), ['1','2','3','4','5','6'])
  assert.equal(await inputs.nth(5).evaluate(el => el === document.activeElement), true)
  await inputs.nth(5).press('Backspace')
  await inputs.nth(5).press('Backspace')
  assert.equal(await inputs.nth(4).evaluate(el => el === document.activeElement), true)
  assert.equal(await inputs.nth(4).inputValue(), '')
  await inputs.first().evaluate(el => {
    const data = new DataTransfer(); data.setData('text/plain', '654321')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  assert.deepEqual(await inputs.evaluateAll(els => els.map(el => el.value)), ['6','5','4','3','2','1'])
  await inputs.first().fill('abc')
  assert.equal(await inputs.first().inputValue(), '')
  assert.equal(await inputs.first().evaluate(el => el.checkValidity()), false)
  await page.evaluate(() => window.receiveSms('987654'))
  await page.waitForFunction(() => document.querySelector('.verification-code-input input')?.value === '9')
  assert.deepEqual(await inputs.evaluateAll(els => els.map(el => el.value)), ['9','8','7','6','5','4'])
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
  }
  await page.goto(server.resolvedUrls.local[0] + 'login')
  await page.route('**/api/dev/sms/last?*', route => route.fulfill({ json:{success:true,data:{phone:'01012345678',code:'246810'}} }))
  await page.goto(server.resolvedUrls.local[0] + 'signup')
  for (const [i, part] of ['010','1234','5678'].entries()) await page.locator('.phone-input input').nth(i).fill(part)
  await page.getByRole('button',{name:'다음',exact:true}).click()
  await page.getByText('개발용 인증번호를 자동으로 입력했습니다.',{exact:true}).waitFor()
  assert.deepEqual(await page.locator('.verification-code-input input').evaluateAll(els => els.map(el => el.value)),['2','4','6','8','1','0'])
  console.log('PASS six code boxes, auto advance, backspace, paste, digits only, SMS autofill and responsive layout')
} finally {
  await browser.close()
  await server.close()
}
