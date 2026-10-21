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
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const load = async () => {
    await page.goto('http://localhost:8282/c-map')
    await page.waitForFunction(() => document.querySelector('.preview-map-status')?.hidden)
    await page
      .locator('.real-map-host')
      .getByText(/^[2-8]$/)
      .first()
      .click()
    await page.locator('.cluster-list-panel').waitFor({ state: 'visible' })
  }
  await load()
  const map = await page.locator('.real-map-host').boundingBox()
  await page.mouse.move(map.x + map.width * 0.3, map.y + map.height * 0.3)
  await page.mouse.down()
  await page.mouse.move(map.x + map.width * 0.3 + 130, map.y + map.height * 0.3 + 50, { steps: 12 })
  await page.mouse.up()
  await page.locator('.cluster-list-panel').waitFor({ state: 'hidden' })
  await load()
  await page.getByRole('button', { name: '지도에서 확대', exact: true }).click()
  await page.locator('.cluster-list-panel').waitFor({ state: 'hidden' })
  await page.waitForTimeout(300)
  assert.equal(
    await page
      .locator('.real-map-host')
      .getByText(/^[2-8]$/)
      .count(),
    0,
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS cluster list closes on real map drag; expand zooms Kakao map and separates markers; no runtime errors',
  )
} finally {
  await browser.close()
  await server?.close()
}
