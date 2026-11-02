import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

// Test-only postcode iframe and signup API responses; no SMS or account is created.
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const sdk = `window.kakao = window.kakao || {};
window.kakao.Postcode = class {
  constructor(options) { this.options = options }
  embed(host) {
    window.qaPostcodeSizes = [...(window.qaPostcodeSizes || []), { width: host.clientWidth, height: host.clientHeight }];
    const frame = document.createElement('iframe');
    frame.title = 'QA 우편번호 검색';
    frame.style.cssText = 'display:block;border:0;width:100%;height:100%';
    frame.srcdoc = '<html lang="ko"><body style="margin:0;padding:16px;box-sizing:border-box;font:16px sans-serif"><label>주소 검색<input aria-label="주소 검색" placeholder="도로명·건물명 입력"></label><button type="button">QA 주소 선택</button></body></html>';
    frame.onload = () => frame.contentDocument.querySelector('button').onclick = () => this.options.oncomplete({ zonecode: '12345', roadAddress: 'QA 테스트 도로 123' });
    host.append(frame);
  }
};`
try {
  const page = await browser.newPage(), errors = []
  page.setDefaultTimeout(60000)
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => { window.EventSource = class extends EventTarget { close() {} } })
  let scriptMode = 'ready', releaseScript = null
  await page.route('**/postcode/prod/postcode.v2.js', async route => {
    if (scriptMode === 'delayed') await new Promise(resolve => { releaseScript = resolve })
    if (scriptMode === 'failed') { await route.abort(); return }
    await route.fulfill({ contentType: 'text/javascript', body: sdk })
  })
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    let data = null
    if (path.includes('/check-')) data = { available: true }
    if (path.endsWith('/phone-code/send')) data = { expiresInSeconds: 180, resendAfterSeconds: 60 }
    return route.fulfill({ json: { success: true, data } })
  })
  async function signup(path = 'signup') {
    await page.goto(server.resolvedUrls.local[0] + path, { waitUntil: 'domcontentloaded' })
    if (path.startsWith('customer-app')) await page.getByRole('button', { name: '문자 인증', exact: true }).click()
    for (const [i, text] of ['010', '1234', '5678'].entries())
      await page.locator('.auth-field-phone .phone-input input').nth(i).fill(text)
    await page.locator('.auth-field-phone .duplicate-check').click()
    await page.locator('.auth-service > form > .auth-buttons button:enabled').click()
    await page.locator('.auth-field-code input').first().fill('123456')
    await page.locator('.auth-service > form > .auth-buttons button:enabled').click()
    await page.locator('.postcode-search-button').waitFor()
  }
  async function geometry() {
    const size = await page.locator('.postcode-search-host').evaluate(host => {
      const box = host.getBoundingClientRect(), frame = host.querySelector('iframe')?.getBoundingClientRect()
      return { width: box.width, height: box.height, frameHeight: frame?.height, overflow: document.documentElement.scrollWidth > innerWidth + 1 }
    })
    assert(size.width >= 280 && size.height >= 200 && size.frameHeight >= 200, JSON.stringify(size))
    assert.equal(size.overflow, false)
    assert((await page.evaluate(() => window.qaPostcodeSizes.at(-1).height)) >= 200, 'Host has a size before SDK embed, including cached SDK on app pages')
    return size
  }
  await mkdir('test-results', { recursive: true })
  for (const path of ['signup', 'customer-app/screen-2']) {
    for (const theme of ['light', 'dark']) {
      await page.addInitScript(theme => localStorage.setItem('routel-theme', theme), theme)
      for (const [width, height] of [[1366, 768], [390, 844], [360, 640], [844, 390]]) {
        await page.setViewportSize({ width, height })
        await signup(path)
        await page.locator('.postcode-search-button').click()
        await expect(page.frameLocator('iframe[title="QA 우편번호 검색"]').getByLabel('주소 검색')).toBeVisible()
        const size = await geometry()
        if (width === 390) await page.screenshot({ path: `test-results/postcode-${path === 'signup' ? 'web' : 'app'}-${theme}.png` })
        await page.frameLocator('iframe[title="QA 우편번호 검색"]').getByRole('button', { name: 'QA 주소 선택' }).click()
        await expect(page.getByLabel('우편번호', { exact: true })).toHaveValue('12345')
        await expect(page.getByLabel('도로명 주소', { exact: true })).toHaveValue('QA 테스트 도로 123')
        await expect(page.getByLabel('상세 주소', { exact: true })).toBeFocused()
        await page.locator('.postcode-search-button').click() // SDK is now cached.
        await expect(page.frameLocator('iframe[title="QA 우편번호 검색"]').getByLabel('주소 검색')).toBeVisible()
        await geometry()
        await page.locator('.postcode-search-dialog').getByRole('button', { name: '닫기', exact: true }).click()
        await expect(page.locator('.postcode-search-button')).toBeFocused()
        console.log('PASS postcode', path, theme, `${width}x${height}`, size)
      }
    }
  }
  scriptMode = 'delayed'
  await page.setViewportSize({ width: 390, height: 844 })
  await signup()
  await page.locator('.postcode-search-button').click()
  await expect(page.locator('.postcode-search-dialog [role=status]')).toBeVisible()
  await expect.poll(() => !!releaseScript).toBe(true)
  await page.locator('.postcode-search-dialog').getByRole('button', { name: '닫기', exact: true }).click()
  releaseScript()
  await expect(page.locator('.postcode-search-dialog')).not.toBeVisible()
  await page.locator('.postcode-search-button').click()
  await expect(page.frameLocator('iframe[title="QA 우편번호 검색"]').getByLabel('주소 검색')).toBeVisible()
  await geometry()
  await page.keyboard.press('Escape')
  await expect(page.locator('.postcode-search-dialog')).not.toBeVisible()
  scriptMode = 'failed'
  await signup()
  await page.locator('.postcode-search-button').click()
  await expect(page.locator('.postcode-search-dialog [role=alert]')).toContainText('주소 검색을 불러오지 못했습니다.')
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
  await server.close()
}
