import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const base = process.env.QA_BASE || 'http://localhost:8282'
try {
  for (const component of ['MapWeatherWidget', 'c-weather']) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' })
    const page = await context.newPage(), errors = []
    let block, release, requests = 0, fail = false, temperature = 15.2
    page.on('pageerror', error => errors.push(error.message))
    await page.route('https://**/*', route => route.abort())
    await page.route('**/__refresh-harness', route => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body><div id="qa"></div></body></html>' }))
    await page.route('**/api/**', async route => {
      assert.equal(route.request().method(), 'GET')
      const path = new URL(route.request().url()).pathname
      let data = { items: [], totalItems: 0, totalPages: 1 }
      if (path === '/api/weather' || path === '/api/navigation/weather') {
        requests++
        if (block) await block
        if (fail) return route.fulfill({ status: 503, json: { success: false, message: 'QA weather unavailable' } })
        data = { temperature, humidity: 60, rainfall: 0.1, condition: 'Clear', observedAt: new Date().toISOString() }
      }
      return route.fulfill({ json: { success: true, data } })
    })
    await page.goto(base + '/__refresh-harness')
    await page.evaluate(async name => {
      const path = `/src/${name === 'c-weather' ? 'pages' : 'components'}/${name}.vue`
      const source = await fetch(path).then(response => response.text())
      const vuePath = source.match(/from "([^\"]*\/vue\.js[^\"]*)"/)[1]
      const { createApp, h } = await import(vuePath)
      const [{ default: component }, { default: icon }] = await Promise.all([import(path), import('/src/components/UiIcon.vue')])
      window.__qaApp = createApp({ render: () => h('div', { class: 'page-c-map' }, [h(component)]) })
      window.__qaApp.component('UiIcon', icon).mount('#qa')
    }, component)
    const widget = component === 'MapWeatherWidget'
    if (widget) await page.locator('.map-weather-marker').click()
    const selector = widget ? '.map-weather-overview' : '.weather-current'
    await expect(page.locator(selector)).toContainText('15.2')
    await page.evaluate(() => document.fonts.ready)
    const trigger = async (lat = 35.1796) => {
      await page.evaluate(({ widget, lat }) => {
        if (widget) document.querySelector('.page-c-map').dispatchEvent(new CustomEvent('map-weather-location', { detail: { lat, lng: 129.0756, name: 'QA Location' } }))
        else {
          const now = Date.now()
          Date.now = () => now + 65000
          window.dispatchEvent(new CustomEvent('routel-backend-event', { detail: { name: 'connected', data: {} } }))
        }
      }, { widget, lat })
    }
    const original = await page.locator(selector).elementHandle()
    const before = await page.locator(selector).evaluate(el => el.getBoundingClientRect().height)
    block = new Promise(resolve => { release = resolve })
    const start = requests
    await trigger()
    await expect.poll(() => requests).toBeGreaterThan(start)
    assert(await original.evaluate(el => el.isConnected))
    assert.equal(await page.locator(selector).evaluate(el => el.getBoundingClientRect().height), before)
    await expect(page.locator(widget ? '#map-weather-detail' : '.weather-current')).not.toContainText(widget ? '\ub0a0\uc528\ub97c \ud655\uc778\ud558\uace0' : '\uc870\ud68c \uc911')
    if (widget) {
      const current = requests
      await trigger(); await trigger()
      await page.waitForTimeout(80)
      assert.equal(requests, current, 'Same-location in-flight requests are deduplicated')
    }
    temperature = 16.7; block = null; release()
    await expect(page.locator(selector)).toContainText('16.7')
    assert(await original.evaluate(el => el.isConnected))
    fail = true
    await trigger()
    await expect(page.getByText('QA weather unavailable', { exact: false }).first()).toBeVisible()
    await expect(page.locator(selector)).toContainText('16.7')
    if (widget) {
      fail = false
      block = new Promise(resolve => { release = resolve })
      const start = requests
      await trigger(35.2)
      await expect.poll(() => requests).toBeGreaterThan(start)
      await expect(page.locator('.map-weather-overview')).toHaveCount(0)
      await expect(page.locator('.map-weather-marker')).not.toContainText('16.7')
      temperature = 20.1; block = null; release()
      await expect(page.locator('.map-weather-overview')).toContainText('20.1')
    }
    await page.evaluate(() => window.__qaApp.unmount())
    assert.deepEqual(errors, [])
    console.log(`PASS ${component}: retained weather, stable height, updated values, explicit stale failure${widget ? ', same-location deduplication, new-location reset' : ''}`)
    await context.close()
  }
} finally { await browser.close() }
