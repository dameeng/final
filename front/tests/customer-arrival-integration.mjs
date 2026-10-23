import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

// Point this at a built preview. All API requests and SSE traffic are isolated.
const base = process.env.ROUTEL_TEST_PREVIEW || 'http://127.0.0.1:8295'
const captures = 'tests/design-preview/customer-arrival'
await mkdir(captures, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let rows = [{ id: 1, category: 'NOTICE', title: 'Existing notice', body: 'Historical content', read: false, createdAt: '2025-01-01T10:00:00+09:00' }]
  const reads = []
  await page.addInitScript(() => {
    window.streams = []
    window.EventSource = class extends EventTarget {
      constructor() { super(); window.streams.push(this) }
      close() { this.closed = true }
    }
  })
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    let data = []
    if (path === '/api/customers/me') data = { id: 1, name: 'Customer' }
    if (path === '/api/managers/me') data = null
    if (path.endsWith('/notifications')) data = { items: rows, page: 1, size: 5, totalPages: 1, totalItems: rows.length }
    if (path.endsWith('/unread-count')) data = { total: rows.filter(row => !row.read).length, byCategory: { NOTICE: 1, RISK: rows.length - 1 } }
    if (route.request().method() === 'PUT' && /\/\d+\/read$/.test(path)) {
      const id = Number(path.match(/\/(\d+)\/read$/)[1]); reads.push(id)
      rows = rows.map(row => row.id === id ? { ...row, read: true } : row)
    }
    return route.fulfill({ json: { success: true, data } })
  })
  await page.goto(base + '/customer-app/screen-12', { waitUntil: 'domcontentloaded' })
  await page.getByText('Existing notice', { exact: true }).first().waitFor()
  const dialog = page.locator('dialog.customer-arrival-alert')
  assert.equal(await dialog.getAttribute('open'), null)
  const incoming = { id: 321, category: 'RISK', severity: 'DANGER', title: '지하차도 통제 안내', body: '수신한 실제 알림의 본문을 표시합니다.\n현황 화면에서 통제 여부를 확인해 주세요.', read: false, createdAt: new Date().toISOString(), unread: { total: 2, byCategory: { NOTICE: 1, RISK: 1 } } }
  rows.unshift(incoming)
  await page.evaluate(data => window.streams.findLast(stream => !stream.closed).dispatchEvent(new MessageEvent('notification-new', { data: JSON.stringify(data) })), incoming)
  await dialog.locator('h2').getByText(incoming.title, { exact: true }).waitFor()
  assert.equal(await dialog.getAttribute('open'), '')
  assert.equal(await dialog.locator('.arrival-brand').textContent(), 'ROUTEL')
  assert.equal(await dialog.evaluate(el => getComputedStyle(el).borderTopWidth), '5px')
  assert.equal(await dialog.getAttribute('data-tone'), 'danger')
  assert(await page.evaluate(() => document.activeElement?.closest('dialog.customer-arrival-alert') !== null))
  const box = await dialog.boundingBox()
  assert(box.x >= 0 && box.x + box.width <= 390)
  await page.screenshot({ path: `${captures}/light.png`, fullPage: false, animations: 'disabled' })
  await dialog.locator('.arrival-confirm').click()
  await page.waitForFunction(() => !document.querySelector('dialog.customer-arrival-alert').open)
  assert.deepEqual(reads, [321])
  await page.evaluate(data => window.streams.findLast(stream => !stream.closed).dispatchEvent(new MessageEvent('notification-new', { data: JSON.stringify(data) })), incoming)
  assert.equal(await dialog.getAttribute('open'), null)
  await page.getByRole('button', { name: '라이트·다크 전환' }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  const darkIncoming = { ...incoming, id: 322, createdAt: new Date().toISOString() }
  rows.unshift(darkIncoming)
  await page.evaluate(data => window.streams.findLast(stream => !stream.closed).dispatchEvent(new MessageEvent('notification-new', { data: JSON.stringify(data) })), darkIncoming)
  await page.waitForFunction(() => document.querySelector('dialog.customer-arrival-alert')?.open)
  await page.screenshot({ path: `${captures}/dark.png`, fullPage: false, animations: 'disabled' })
  const colors = await dialog.evaluate(el => {
    const css = getComputedStyle(el), body = getComputedStyle(el.querySelector('.arrival-body')), button = getComputedStyle(el.querySelector('.arrival-confirm'))
    return { accent: css.getPropertyValue('--arrival-accent').trim(), background: css.backgroundColor, text: body.color, buttonBackground: button.backgroundColor, buttonText: button.color }
  })
  const luminance = color => {
    const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
      const channel = value / 255
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
    })
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
  }
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05)
  assert.equal(colors.accent, '#ff9aae')
  assert(contrast(colors.text, colors.background) >= 4.5, 'dark body text contrast')
  assert(contrast(colors.buttonText, colors.buttonBackground) >= 4.5, 'dark primary action contrast')
  assert.deepEqual(errors, [])
  console.log('PASS production App integration: shared SSE -> branded alertdialog, 5px severity border, focus/viewport, current-only acknowledgement, duplicate suppression, and dark-mode accent/text/action contrast')
  console.log(`Captures: ${captures}/light.png, ${captures}/dark.png`)
} finally {
  await browser.close()
}
