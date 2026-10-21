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
  await page.goto('http://localhost:8282/c-map')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.locator('#lst .it').nth(2).click()
    const name = await page.locator('#n').innerText()
    await page.locator('#cctvb').click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ state: 'visible' })
    assert.match(await dialog.getByRole('heading').innerText(), new RegExp(name))
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden')
    const rect = await dialog.boundingBox()
    assert(rect.width <= width - 32 && rect.x >= 0)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    await page.locator('#cctvb').evaluate((el) => {
      if (document.activeElement !== el) throw Error('Focus was not restored')
    })
    await page.locator('#cctvb').click()
    await page.getByRole('button', { name: 'CCTV 닫기' }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.locator('#cctvb').click()
    await page.mouse.click(2, 2)
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '목록으로', exact: true }).click()
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS CCTV facility title, modal backdrop, scroll lock, Escape, close button, outside click, focus return, desktop/mobile widths',
  )
} finally {
  await browser.close()
  await server?.close()
}
