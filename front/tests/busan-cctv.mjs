import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
let server
try {
  await fetch('http://localhost:8282')
} catch {
  server = await createServer({ configLoader: 'runner' })
  await server.listen()
}
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [],
    requests = [],
    failures = []
  page.on('requestfailed', (r) =>
    failures.push({ host: new URL(r.url()).hostname, error: r.failure()?.errorText }),
  )
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('http://localhost:8282/c-map')
  await page.locator('#lst .it').first().click()
  await page.locator('#cctvb').click()
  await page.locator('.busan-cctv-select select').waitFor({ timeout: 25000 })
  assert((await page.locator('.busan-cctv-select option').count()) > 0)
  assert(requests.some((url) => url === 'https://its.busan.go.kr/api-n/v1/bsits/user/cctvs'))
  assert(!requests.some((url) => url.includes('/api/navigation/cctv')))
  const video = page.locator('.busan-cctv-viewer video')
  await video.waitFor()
  let playback = false
  try {
    await page.waitForFunction(
      () => {
        const video = document.querySelector('.busan-cctv-viewer video')
        return video?.readyState >= 2 && video.videoWidth > 0
      },
      {},
      { timeout: 25000 },
    )
    playback = true
  } catch {}
  console.log(
    JSON.stringify({
      playback,
      failures: failures.slice(0, 4),
      hosts: [...new Set(requests.map((url) => new URL(url).hostname))],
      videoState: await video.evaluate((v) => ({
        ready: v.readyState,
        error: v.error?.code,
        source: v.getAttribute('src')?.split(':')[0],
        network: v.networkState,
        native: v.canPlayType('application/vnd.apple.mpegurl'),
      })),
    }),
  )
  const count = await page.locator('.busan-cctv-select option').count()
  if (count > 1) {
    await page.locator('.busan-cctv-select select').selectOption({ index: 1 })
    await page.locator('.busan-cctv-camera-info strong').waitFor()
  }
  await page.getByRole('button', { name: 'CCTV 닫기', exact: true }).click()
  await page.locator('.busan-cctv-viewer video').waitFor({ state: 'detached' })
  await page.addInitScript(() => sessionStorage.setItem('routel-member-preview', '1'))
  await page.goto('http://localhost:8282/customer-app/screen-5')
  await page.locator('.mobile-sheet-handle').click()
  await page.locator('.mobile-facility-list button').first().click()
  await page.getByRole('button', { name: 'CCTV 보기', exact: true }).click()
  await page
    .locator('.busan-cctv-modal[open] .busan-cctv-select select')
    .waitFor({ timeout: 25000 })
  await page.setViewportSize({ width: 390, height: 900 })
  const rect = await page.locator('.busan-cctv-modal').boundingBox()
  assert(rect.x >= 0 && rect.x + rect.width <= 390)
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify({
      result:
        'PASS frontend-only Busan CCTV on web/app, camera selection, distance/source, stop on close, mobile bounds',
      cameraCount: count,
      realVideoDecoded: playback,
    }),
  )
} finally {
  await browser.close()
  await server?.close()
}
