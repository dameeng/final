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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    streams = []
  await page.route('**/api/**', (r) => {
    const path = new URL(r.request().url()).pathname
    let data = []
    if (path === '/api/customers/me') data = null
    if (path === '/api/managers/me')
      data = { id: 7, name: 'Manager', role: 'REGIONAL_ADMIN', regions: [{ id: 1, name: 'Busan' }] }
    if (path === '/api/underpasses/1')
      data = { id: 1, name: 'Test facility', currentRiskLevel: 'SAFE', currentStatus: 'NORMAL' }
    if (path.endsWith('/cameras'))
      data = [
        { id: 196, cameraRole: 'APPROACH_LPR', streamUrl: 'https://video.test/196.m3u8' },
        { id: 197, cameraRole: 'FINAL_LPR', streamUrl: 'https://video.test/197.m3u8' },
        { id: 200, cameraRole: 'CCTV' },
      ]
    return r.fulfill({ json: { success: true, data } })
  })
  await page.route('https://video.test/**', (r) => {
    streams.push(r.request().url())
    return r.fulfill({ status: 404, body: '' })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const url of ['/fac-detail?id=1&tab=cctv', '/admin-app/screen-5?id=1']) {
    streams.length = 0
    await page.goto(base + url)
    const viewer = page.locator('.facility-cctv-viewer')
    await viewer.locator('video').waitFor()
    await page.waitForFunction(() => document.querySelector('video')?.getAttribute('src'))
    assert.equal(await page.locator('video').count(), 1)
    assert(
      streams.every((url) => url.includes('/196.')),
      'unselected streams never requested',
    )
    await page.evaluate(() => {
      window.previousVideo = document.querySelector('video')
    })
    await viewer.locator('select').selectOption('197')
    await page.waitForFunction(() => document.querySelector('video') !== window.previousVideo)
    assert.equal(await page.locator('video').count(), 1)
    assert.equal(
      await page.evaluate(() => window.previousVideo.getAttribute('src')),
      null,
      'previous playback is released',
    )
    assert.match(await viewer.locator('a').first().getAttribute('href'), /ocr\?underpassId=1/)
    await viewer.locator('select').selectOption('200')
    assert.equal(await page.locator('video').count(), 0)
    assert.equal(await viewer.locator('a').count(), 1)
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
  }
  console.log(
    'PASS web/app single selected CCTV, no parallel stream requests, old player cleanup, facility OCR link and mobile width',
  )
} finally {
  await browser.close()
  await server.close()
}
