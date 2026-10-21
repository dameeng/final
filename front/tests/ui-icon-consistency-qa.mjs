import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage()
  let manager = false
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget {
      close() {}
    }
  })
  await page.route('**/api/**', (r) => {
    const path = new URL(r.request().url()).pathname
    let data = []
    if (path === '/api/customers/me') data = manager ? null : { id: 1, name: 'Customer' }
    if (path === '/api/managers/me')
      data = manager ? { id: 2, role: 'REGIONAL_ADMIN', name: 'Manager', regions: [] } : null
    if (path.endsWith('/unread-count')) data = { total: 3 }
    if (path.includes('/underpasses/') && !/cameras|risk-/.test(path))
      data = { id: 1, name: 'Facility', currentStatus: 'NORMAL', currentRiskLevel: 'SAFE' }
    if (path.endsWith('/notifications')) data = { items: [], totalItems: 0, totalPages: 1, page: 1 }
    return r.fulfill({ json: { success: true, data } })
  })
  await page.route('**/maps/sdk.js*', (r) => r.abort())
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  const routes = [
    ['/login', false],
    ['/signup', false],
    ['/c-notice', false],
    ['/my-alerts', false],
    ['/customer-app/screen-5', false],
    ['/customer-app/screen-7', false],
    ['/customer-app/screen-12', false],
    ['/customer-app/screen-13', false],
    ['/customer-app/notices', false],
    ['/admin-data/manager-notifications', true],
    ['/fac-list', true],
    ['/admin-app/screen-2', true],
    ['/admin-app/screen-3', true],
    ['/admin-app/screen-9', true],
    ['/admin-app/screen-14', true],
    ['/admin-app/ocr', true],
    ['/admin-app/notifications', true],
  ]
  let controls = 0
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const [url, role] of routes) {
      manager = role
      await page.goto(base + url)
      await page.locator('.ui-icon:visible').first().waitFor()
      await page.waitForTimeout(120)
      const geometry = await page
        .locator('.ui-icon, .customer-app-nav svg, .admin-app-bottom-nav svg')
        .evaluateAll((icons) =>
          icons
            .filter((svg) => svg.getBoundingClientRect().width > 0)
            .map((svg) => {
              const r = svg.getBoundingClientRect(),
                parent = svg.parentElement,
                p = parent.getBoundingClientRect()
              const nav = !!svg.closest('.customer-app-nav,.admin-app-bottom-nav')
              const label = nav ? parent.querySelector('span') : null
              const labelStyle = label ? getComputedStyle(label) : null
              return {
                width: r.width,
                height: r.height,
                nav,
                labelHeight: label?.getBoundingClientRect().height,
                labelFont: labelStyle?.fontSize,
                labelPadding: labelStyle?.padding,
                labelFlexGrow: labelStyle?.flexGrow,
                parentWidth: p.width,
                parentHeight: p.height,
                x: r.x + r.width / 2 - p.x - p.width / 2,
                y: r.y + r.height / 2 - p.y - p.height / 2,
              }
            }),
        )
      for (const icon of geometry) {
        assert.equal(icon.width, 24, url)
        assert.equal(icon.height, 24, url)
        assert(Math.abs(icon.x) < 1, `${url}: horizontal alignment`)
        if (!icon.nav) {
          assert.equal(icon.parentWidth, 40, url)
          assert.equal(icon.parentHeight, 40, url)
          assert(Math.abs(icon.y) < 1, `${url}: vertical alignment`)
        } else {
          assert.equal(icon.labelHeight, 16, `${url}: legacy label CSS must not push the icon`)
          assert.equal(icon.labelFont, '12px', url)
          assert.equal(icon.labelPadding, '0px', url)
          assert.equal(icon.labelFlexGrow, '0', url)
        }
        controls++
      }
      const theme = page.getByRole('button', { name: /라이트·다크/ }).first()
      if (await theme.count()) {
        const before = await theme.boundingBox()
        await theme.click()
        assert.deepEqual(
          await theme.boundingBox(),
          before,
          `${url}: toggling does not resize or shift the control`,
        )
      }
    }
  }
  console.log(
    `PASS ${controls} icons across 17 routes and mobile/desktop: preserved icon/control sizes, fixed navigation labels, centered alignment and stable clicked state`,
  )
} finally {
  await browser.close()
  await server.close()
}
