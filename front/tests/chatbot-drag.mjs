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
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  await page.route('**/api/**', (r) => r.fulfill({ json: { success: true, data: null } }))
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/c-notice`)
  const button = page.locator('.public-chat-launcher'),
    dialog = page.locator('.public-chat-dialog')
  const before = await button.boundingBox()
  await page.mouse.move(before.x + 30, before.y + 20)
  await page.mouse.down()
  await page.mouse.move(240, 260, { steps: 10 })
  await page.mouse.up()
  const after = await button.boundingBox()
  assert(Math.abs(after.x - before.x) > 100)
  assert.equal(await dialog.evaluate((el) => el.open), false, 'drag must not open chat')
  await button.click()
  assert.equal(await dialog.evaluate((el) => el.open), false, 'touching mascot reacts without opening chat')
  assert(await button.locator('.chat-mascot-reaction').textContent(), 'mascot responds with a speech bubble')
  assert.match(await button.locator('img').getAttribute('src'),/routel-ru-reaction/,'reaction changes the mascot face')
  const firstReaction=await button.locator('.chat-mascot-reaction').textContent()
  await button.click()
  assert.notEqual(await button.locator('.chat-mascot-reaction').textContent(),firstReaction,'repeated clicks respond immediately')
  const mascotAnimation=await button.locator('img').evaluate(el=>el.getAnimations().length)
  assert(mascotAnimation>0,'mascot shakes on touch')
  const caption=await button.locator('.chat-launcher-caption').boundingBox()
  await page.mouse.click(caption.x+caption.width/2,caption.y+caption.height/2)
  assert.equal(await dialog.evaluate((el) => el.open), true)
  await page.getByRole('button', { name: '챗봇 닫기' }).click()
  await button.focus()
  const keyboardBefore = await button.boundingBox()
  await page.keyboard.press('ArrowRight')
  assert.equal(Math.round((await button.boundingBox()).x - keyboardBefore.x), 10)
  await page.mouse.move(keyboardBefore.x + 30, keyboardBefore.y + 20)
  await page.mouse.down()
  await page.mouse.move(1199, 799, { steps: 5 })
  await page.mouse.up()
  await page.setViewportSize({ width: 390, height: 500 })
  await page.waitForTimeout(100)
  const small = await button.boundingBox()
  assert(
    small.x >= 0 && small.y >= 0 && small.x + small.width <= 390 && small.y + small.height <= 500,
  )
  await button.focus()
  await page.keyboard.press('Enter')
  assert.equal(await dialog.evaluate((el) => el.open), true)
  console.log('PASS drag, click suppression, click to open, keyboard movement and resize bounds')
} finally {
  await browser.close()
  await server.close()
}
