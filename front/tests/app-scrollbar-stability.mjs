import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage()
  let manager = true
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    let data = { items: [], page: 1, totalItems: 0, totalPages: 1 }
    if (path === '/api/managers/me') data = manager ? { id: 1, name: '김민수', loginId: 'manager01', role: 'REGIONAL_ADMIN', regions: [], phone: '01010010001', email: 'minsu@example.com' } : null
    else if (path === '/api/customers/me') data = manager ? null : { id: 2, name: '고객', phone: '01012345678' }
    else if (path === '/api/regions' || path.includes('/dashboard/')) data = []
    return route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const width of [320, 430, 1200]) {
    await page.setViewportSize({ width, height: 844 })
    for (const path of ['/admin-app/screen-14', '/admin-app/screen-4', '/admin-app/screen-9', '/customer-app/account/profile', '/customer-app/account/cars', '/customer-app/screen-12']) {
      manager = path.startsWith('/admin-app/')
      await page.goto(base + path)
      await page.locator('.app-restored-body').waitFor()
      const geometry = () => page.evaluate(() => {
        const root = document.querySelector('#app>.service-mobile,#app>.manager-app-shell,#app>.customer-app-editorial')
        const body = document.querySelector('.app-restored-body'), probe = body.querySelector('[data-scroll-probe]')
        const rect = element => {
          const box = element.getBoundingClientRect()
          return { x: box.x, y: box.y, width: box.width, height: box.height }
        }
        return { frame: rect(root), body: rect(body), probe: rect(probe), contentWidth: body.clientWidth }
      })
      await page.evaluate(() => {
        const body = document.querySelector('.app-restored-body')
        for (const child of body.children) child.style.display = 'none'
        const probe = document.createElement('div')
        probe.dataset.scrollProbe = ''
        probe.style.cssText = 'height:1px;width:100%;box-sizing:border-box'
        body.append(probe)
      })
      const short = await geometry()
      await page.evaluate(() => {
        const filler = document.createElement('div')
        filler.dataset.scrollFiller = ''
        filler.style.height = '2000px'
        document.querySelector('.app-restored-body').append(filler)
      })
      assert.deepEqual(await geometry(), short, `${width}px ${path}: scrollbar does not change width, position or frame height`)
      await page.evaluate(() => document.querySelector('[data-scroll-filler]').remove())
      assert.deepEqual(await geometry(), short, `${width}px ${path}: removing overflow keeps geometry`)
    }
    manager = true
    await page.goto(base + '/admin-app/screen-14')
    const summary = page.locator('.manager-profile-summary')
    await summary.waitFor()
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()))
    const before = await summary.boundingBox()
    await summary.click()
    await expect(page.locator('details.account-panel')).toHaveAttribute('open', '')
    const after = await summary.boundingBox()
    assert.equal(after.x, before.x)
    assert.equal(after.width, before.width)
  }
  console.log('PASS 18 app/viewport combinations and real profile expansion: fixed width, position and frame height with/without overflow')
} finally { await browser.close(); await server.close() }
