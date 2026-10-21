import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { port: 0, strictPort: false },
})
await server.listen()
const base = server.resolvedUrls.local[0]
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const initial of [null, 'manager', 'customer']) {
    const page = await browser.newPage()
    let session = initial
    await page.route('**/api/**', (r) => {
      const path = new URL(r.request().url()).pathname
      let data = []
      if (path === '/api/customers/me')
        data = session === 'customer' ? { id: 2, name: '고객' } : null
      if (path === '/api/managers/me')
        data =
          session === 'manager'
            ? { id: 1, name: '관리자', role: 'REGIONAL_ADMIN', regions: [] }
            : null
      if (path === '/api/customers/login') {
        session = 'customer'
        data = { id: 2, name: '고객' }
      }
      if (path === '/api/auth/logout') {
        session = null
        data = null
      }
      return r.fulfill({ json: { success: true, data } })
    })
    await page.goto(base)
    const nav = page.locator('.customer-member-nav')
    for (const width of [1440, 390, 360]) {
      await page.setViewportSize({ width, height: 844 })
      assert.equal(
        await nav.getByRole('link', { name: '마이페이지', exact: true }).count(),
        session === 'customer' ? 1 : 0,
      )
      assert.equal(
        await nav.getByRole('link', { name: '로그인', exact: true }).count(),
        session === 'customer' ? 0 : 1,
      )
      assert.equal(
        await nav.getByRole('link', { name: '회원가입', exact: true }).count(),
        session === 'customer' ? 0 : 1,
      )
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      )
    }
    if (initial === null) {
      await nav.getByRole('link', { name: '로그인', exact: true }).click()
      await page.getByLabel('아이디', { exact: true }).fill('tester')
      await page.getByLabel('비밀번호', { exact: true }).fill('password')
      await page.locator('.auth-service button[type=submit]').click()
      await page.waitForURL(base)
      await nav.getByRole('link', { name: '마이페이지', exact: true }).waitFor()
      await nav.getByRole('button', { name: '로그아웃', exact: true }).click()
      await nav.getByRole('link', { name: '회원가입', exact: true }).waitFor()
      assert.equal(await nav.getByRole('link', { name: '마이페이지', exact: true }).count(), 0)
    }
    await page.close()
  }
  console.log('PASS guest/manager/customer header, login/logout transitions, mobile widths')
} finally {
  await browser.close()
  await server.close()
}
