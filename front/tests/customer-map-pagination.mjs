import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
const base = `http://127.0.0.1:${server.httpServer.address().port}`
let browser
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 390, height: 1000 } }),
    errors = []
  const districts = ['해운대구', '동구', '기장군']
  let count = 45
  const rows = Array.from({ length: 45 }, (_, i) => ({
    id: i + 1,
    name: `지하차도 ${String(i + 1).padStart(2, '0')}`,
    regionName: districts[Math.floor(i / 15)],
    roadAddress: `부산광역시 ${districts[Math.floor(i / 15)]} 테스트로 ${i + 1}`,
    latitude: 35.1 + i * 0.001,
    longitude: 129.1,
    currentStatus: 'NORMAL',
    currentRiskLevel: '안전',
  }))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/v2/maps/sdk.js*', (r) => r.abort())
  await page.route('**/api/**', (r) => {
    const path = new URL(r.request().url()).pathname
    const data =
      path === '/api/underpasses'
        ? { items: rows.slice(0, count), page: 1, totalPages: 1, totalItems: count }
        : /^\/api\/underpasses\/\d+$/.test(path)
          ? rows[Number(path.split('/').at(-1)) - 1]
          : path.endsWith('/risk-scores')
            ? []
            : null
    return r.fulfill({ json: { success: true, data } })
  })
  await page.goto(base + '/c-map')
  const list = page.locator('.facility-list-panel'),
    items = list.locator('.lst .it'),
    nav = list.getByRole('navigation', { name: '지하차도 목록 페이지' })
  await items.first().waitFor()
  const select = list.getByRole('combobox', { name: '부산 구·군 선택' })
  assert.equal(await select.locator('option').count(), 17)
  assert.equal(await select.locator('option').first().innerText(), '부산 전체')
  assert.equal(await items.count(), 5)
  assert((await nav.innerText()).includes('1 / 9 페이지 · 총 45곳'))
  assert(await nav.getByRole('button', { name: '이전', exact: true }).isDisabled())
  const canvas = await page.locator('.customer-map-canvas').elementHandle()
  await nav.getByRole('button', { name: '다음', exact: true }).click()
  assert((await items.first().innerText()).includes('지하차도 06'))
  assert.equal(
    await nav.getByRole('button', { name: '2페이지', exact: true }).getAttribute('aria-current'),
    'page',
  )
  assert(await canvas.evaluate((el) => el.isConnected))
  await items.first().click()
  await page.locator('.swapped-detail .nm').waitFor()
  await page.getByRole('button', { name: '목록으로', exact: true }).click()
  assert((await nav.innerText()).includes('2 / 9'))
  for (let i = 0; i < 7; i++) await nav.getByRole('button', { name: '다음', exact: true }).click()
  assert((await nav.innerText()).includes('9 / 9'))
  assert(await nav.getByRole('button', { name: '다음', exact: true }).isDisabled())
  assert((await items.first().innerText()).includes('지하차도 41'))
  await select.selectOption('해운대구')
  assert((await nav.innerText()).includes('1 / 3 페이지 · 총 15곳'))
  assert((await items.allInnerTexts()).every((text) => text.includes('해운대구')))
  await nav.getByRole('button', { name: '3페이지', exact: true }).click()
  await select.selectOption('동구')
  assert((await nav.innerText()).includes('1 / 3'))
  assert((await items.allInnerTexts()).every((text) => text.includes('동구')))
  await select.selectOption('기장군')
  assert((await items.allInnerTexts()).every((text) => text.includes('기장군')))
  await select.selectOption('금정구')
  assert.equal(await items.count(), 0)
  assert.equal(await nav.count(), 0)
  await list.getByText('조회 조건에 맞는 지하차도가 없습니다.').waitFor()
  await select.selectOption('')
  await nav.getByRole('button', { name: '5페이지', exact: true }).click()
  await list.getByRole('searchbox', { name: '검색', exact: true }).fill('지하차도 01')
  assert.equal(await items.count(), 1)
  assert((await nav.innerText()).includes('1 / 1 페이지 · 총 1곳'))
  await list.getByRole('searchbox', { name: '검색', exact: true }).fill('')
  await nav.getByRole('button', { name: '5페이지', exact: true }).click()
  count = 6
  await list.getByRole('button', { name: '새로고침', exact: true }).click()
  await page.waitForFunction(() =>
    document.querySelector('.customer-list-pagination')?.textContent.includes('총 6곳'),
  )
  assert((await nav.innerText()).includes('2 / 2'))
  assert.equal(await items.count(), 1)
  for (const width of [1900, 1280, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
      `overflow ${width}`,
    )
    assert(await nav.isVisible())
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS 45 facilities/9 pages, page boundaries, 16 Busan districts, filter resets, detail return, refresh clamp, responsive layout',
  )
} finally {
  await browser?.close()
  await server.close()
}
