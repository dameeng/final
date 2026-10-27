import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort:false } })
await server.listen()
const { matchesKoreanSearch }=await server.ssrLoadModule('/src/utils/korean-search.ts')
for(const [text,query,expected] of [['감천지하차도','ㄱㅊ',true],['감천지하차도','감ㅊ',true],['초량지하차도 부산 동구','ㅊㄹ ㄷㄱ',true],['까치길','ㄲㅊ',true],['감천지하차도','ㄴㄱ',false],['CCTV (1)','cctv (1)',true],['감천지하차도','[',false],['감천지하차도','ᄀᄎ',true]]) assert.equal(matchesKoreanSearch(text,query),expected,`${text}: ${query}`)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = [], requests = []
  let longPages = false
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    requests.push(path + url.search)
    let data = { items: [], page: 1, totalItems: 0, totalPages: 1 }
    if (path === '/api/managers/me') data = { id: 1, name: '관리자', role: 'REGIONAL_ADMIN', regions: [] }
    else if (path === '/api/customers/me') data = null
    else if (path === '/api/underpasses') data = { ...data, items: [
      { id: 1, name: '초량지하차도', regionName: '동구', roadAddress: '중앙대로', currentRiskLevel: 'SAFE' },
      { id: 2, name: '감천지하차도', regionName: '사하구', roadAddress: '감천로', currentRiskLevel: 'SAFE' },
    ] }
    else if (path === '/api/its-vms') data = [
      { id: 11, name: '근접 전광판', spec: '2단10열', dist: 100, zone: 'NEAR' },
      { id: 12, name: '원거리 전광판', spec: '2단10열', dist: 999, zone: 'FAR' },
    ]
    else if (/^\/api\/display\/vms\/\d+\/pages$/.test(path)) data = Array.from({ length: longPages ? 40 : 1 }, (_, index) => ({ id: index + 1, pageNo: index + 1, content: '안전운전 하세요', manual: false, defaultPage: true }))
    else if (path === '/api/display/presets' || path === '/api/regions') data = []
    await route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  let sidebarOrigin
  for (const resource of ['cameras', 'thresholds', 'display']) {
    await page.goto(base + '/admin-data/' + resource)
    const sidebar = page.locator('.my-underpass-list'), main = page.locator('.underpass-split-main')
    await expect(sidebar.locator('li')).toHaveCount(2)
    const box=await sidebar.boundingBox()
    if(!sidebarOrigin) sidebarOrigin={x:box.x,y:box.y,width:box.width}
    else assert.deepEqual({x:box.x,y:box.y,width:box.width},sidebarOrigin,'Camera, threshold and display lists use the same origin and width')
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()))
    await expect(main.locator('form.service-filters')).toHaveCount(0)
    await expect(main.locator('input[type=search]')).toHaveCount(0)
    const search = sidebar.getByRole('searchbox', { name: '담당 지하차도 검색' })
    await search.fill('ㄱㅊ')
    await expect(sidebar.locator('li')).toHaveCount(1)
    await expect(sidebar.locator('li')).toContainText('감천지하차도')
    await search.fill('초ㄹ')
    await expect(sidebar.locator('li')).toHaveCount(1)
    await expect(sidebar.locator('li')).toContainText('초량지하차도')
    await search.fill('동구')
    await expect(sidebar.locator('li')).toHaveCount(1)
    await sidebar.getByRole('button', { name: /초량지하차도/ }).click()
    await expect(page).toHaveURL(/underpassId=1/)
    await expect(search).toHaveValue('동구')
    await expect(sidebar.getByRole('button', { name: /초량지하차도/ })).toHaveAttribute('aria-pressed', 'true')
    await search.fill('없는 시설')
    await expect(sidebar.getByText('검색 결과가 없습니다.')).toBeVisible()
    await search.fill('감천로')
    await expect(sidebar.locator('li')).toHaveCount(1)
    await search.fill('감천 지하차도 사하구')
    await search.press('Enter')
    await expect(sidebar.locator('li')).toHaveCount(1)
    await expect(sidebar.getByRole('status')).toContainText('검색 결과 1곳')
    await sidebar.getByRole('button', { name: '검색', exact: true }).click()
    await expect(sidebar.locator('li')).toHaveCount(1)
    await search.fill('')
    await expect(sidebar.locator('li')).toHaveCount(2)
    await page.setViewportSize({ width: 390, height: 844 })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.setViewportSize({ width: 1440, height: 1000 })
    console.log('PASS sidebar name/region/address search, selection, empty/reset and mobile', resource)
  }
  assert(requests.some(path => path.includes('/underpasses/1/cameras')))
  assert(requests.some(path => path.startsWith('/api/its-vms?underpassId=1')))
  for (const height of [760, 1000]) {
    await page.setViewportSize({ width: 1600, height })
    for (const long of [false, true]) {
      longPages = long
      await page.goto(base + '/admin-data/display?underpassId=1')
      const panel = page.locator('.underpass-vms'), sidebar = page.locator('.my-underpass-list')
      await panel.locator('.vms-main').waitFor()
      await expect(panel.locator('.vms-main tbody tr').first()).toContainText('안전운전')
      const left = await sidebar.boundingBox(), right = await panel.boundingBox()
      assert(Math.abs(left.y - right.y) < 1, 'Both panels start together')
      assert(Math.abs(left.height - right.height) < 1, 'Both panels share one height')
      if (long) assert(await panel.locator('.vms-main').evaluate(element => element.scrollHeight > element.clientHeight), 'Long VMS content scrolls inside its panel')
      console.log('PASS aligned panel heights and internal scrolling', height, long ? '40 pages' : '1 page')
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
  await server.close()
}
