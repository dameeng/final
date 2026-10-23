import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdir } from 'node:fs/promises'

// A fresh browser with fixture identity/facility data; only public CCTV is live.
const server = process.env.TUNNEL_QA_ORIGIN ? null : await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false, watch: null } })
await server?.listen()
const origin = process.env.TUNNEL_QA_ORIGIN || `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
await page.addInitScript(() => { localStorage.setItem('routel-session-kind', 'manager'); document.documentElement.dataset.theme = 'light' })
await page.route(origin + '/api/**', route => {
  const path = new URL(route.request().url()).pathname
  let data = []
  if (path === '/api/managers/me') data = { id: 7, name: '검증 관리자', role: 'REGIONAL_ADMIN', regions: [{ id: 1, name: '부산광역시' }] }
  if (path === '/api/underpasses/1') data = { id: 1, name: '부산 시설', currentRiskLevel: 'SAFE', currentStatus: 'NORMAL' }
  return route.fulfill({ json: { success: true, data } })
})
await mkdir('tests/design-preview/tunnel-cctv', { recursive: true })
try {
  await page.goto(origin + (process.env.TUNNEL_QA_FIXTURE ? '/tests/tunnel-cctv-fixture.html' : '/fac-detail?id=1'), { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('.tunnel-cctv-trigger').click()
  await page.locator('.tunnel-cctv-modal video').waitFor({ timeout: 25000 })
  await page.waitForFunction(() => {
    const video = document.querySelector('.tunnel-cctv-modal video')
    return video?.readyState >= 2 && video.videoWidth > 0
  }, {}, { timeout: 30000 })
  await page.waitForTimeout(2000)
  console.log(JSON.stringify(await page.locator('.tunnel-cctv-modal').evaluate(node => {
    const video = node.querySelector('video')
    return { title: node.querySelector('h3')?.textContent, options: node.querySelectorAll('option').length, readyState: video.readyState, videoWidth: video.videoWidth, videoHeight: video.videoHeight, currentTime: video.currentTime, paused: video.paused, modalWidth: node.getBoundingClientRect().width, overflow: node.scrollWidth > node.clientWidth }
  })))
  await page.screenshot({ path: 'tests/design-preview/tunnel-cctv/live-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'tests/design-preview/tunnel-cctv/live-mobile.png' })
} catch (error) {
  console.log(JSON.stringify({ error: error.message.replace(/https?:\/\/\S+/g, '[redacted]'), ui: await page.locator('.tunnel-cctv-modal').innerText().catch(() => '') }))
  await page.screenshot({ path: 'tests/design-preview/tunnel-cctv/live-error.png' })
  process.exitCode = 1
} finally {
  await browser.close()
  await server?.close()
}
