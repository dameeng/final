import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  let manager = true
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    let data = { items: [], page: 1, totalItems: 0, totalPages: 1 }
    if (path === '/api/managers/me') data = manager ? { id: 1, name: '관리자', role: 'REGIONAL_ADMIN', regions: [] } : null
    else if (path === '/api/customers/me') data = manager ? null : { id: 2, name: '고객', phone: '01012345678' }
    else if (path === '/api/regions' || path.includes('/dashboard/')) data = []
    return route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  const appearance = locator => locator.evaluate(element => {
    const style = getComputedStyle(element), rect = element.getBoundingClientRect()
    return { background: style.backgroundColor, image: style.backgroundImage, color: style.color, decoration: style.textDecorationLine, shadow: style.boxShadow, x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  async function checkHover(locator, enabled = true) {
    await locator.scrollIntoViewIfNeeded()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(180)
    const before = await appearance(locator)
    await locator.hover({ force: true })
    await page.waitForTimeout(180)
    const after = await appearance(locator)
    if (enabled) assert.notDeepEqual([after.background, after.image, after.color], [before.background, before.image, before.color], 'Enabled control changes color')
    else assert.deepEqual([after.background, after.image, after.color], [before.background, before.image, before.color], 'Disabled control keeps its color')
    for (const key of ['x', 'y', 'width', 'height']) assert.equal(after[key], before[key], 'Hover does not change ' + key)
    if (enabled) { assert.equal(after.decoration, 'none', 'No hover underline'); assert.equal(after.shadow, 'none', 'No hover shadow or inset border') }
  }
  for (const path of (process.env.HOME_HOVER_ONLY ? [] : ['/admin-profile', '/admin-app/screen-14', '/my-home', '/customer-app/account/settings'])) {
    manager = path.startsWith('/admin')
    await page.goto(base + path)
    const actual = page.locator(manager ? '.account-actions>div>button:visible' : '.account-service button:visible').first()
    await actual.waitFor()
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()))
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
      await checkHover(actual)
      if (path === '/admin-app/screen-14') await checkHover(page.locator('.app-more-menu>a').first())
      await page.evaluate(() => {
        const host = document.createElement('div')
        host.id = 'hover-probes'
        host.style.cssText = 'position:fixed;left:20px;top:180px;z-index:9999;display:grid;gap:6px;background:white;padding:10px'
        host.innerHTML = '<button>Default</button><button class="primary">Primary</button><button class="danger">Danger</button><button aria-pressed="true">Selected</button><a href="#" class="btn">Button link</a><a href="#">Plain text link</a><button disabled>Disabled</button><button aria-disabled="true">ARIA disabled</button>'
        document.querySelector('#app').append(host)
      })
      const probes = page.locator('#hover-probes').locator('button,a')
      for (let index = 0; index < 8; index++) await checkHover(probes.nth(index), index < 5)
      await page.locator('#hover-probes').evaluate(element => element.remove())
    }
    console.log('PASS hover color, selected/primary/danger/link, disabled and fixed geometry in both themes', path)
  }
  manager=false
  await page.goto(base+'/')
  await page.locator('.home-hero .home-button-primary').waitFor()
  for(const theme of ['light','dark']) {
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
    for(const button of await page.locator('.home-button').all()) {
      await checkHover(button)
      const style=await appearance(button)
      assert.notEqual(style.background,'rgba(0, 0, 0, 0)','Home button keeps visible background on hover')
      if(await button.evaluate(el=>el.id==='home-underpass-cta')) {
        assert.equal(style.color,await button.evaluate(el=>getComputedStyle(el).borderTopColor),'Closing link uses matching blue text and border on hover')
      } else if(await button.evaluate(el=>el.classList.contains('primary'))) assert.equal(style.color,'rgb(255, 255, 255)','Primary button keeps white text on blue background')
    }
  }
  console.log('PASS home buttons remain visible on hover in both themes')
} finally { await browser.close(); await server.close() }
