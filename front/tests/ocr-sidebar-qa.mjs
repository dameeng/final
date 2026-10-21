import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  base = server.resolvedUrls.local[0]
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    calls = [],
    errors = []
  let manager = true
  let rows = [
    {
      id: 11,
      underpassId: 1,
      underpassName: '중앙 지하차도',
      cameraId: 5,
      detectedNum: '12가3456',
      correctedNum: null,
      confidence: 0.76,
      recognitionStatus: 'LOW_CONFIDENCE',
      reviewStatus: 'PENDING',
      imagePath: 'ocr/11.svg',
      detectedAt: '2026-10-21T12:00:00',
      reviewDeadline: '2099-01-01T00:00:00',
    },
    {
      id: 12,
      underpassId: 1,
      underpassName: '중앙 지하차도',
      detectedNum: '34나5678',
      correctedNum: '34나5679',
      confidence: 0.98,
      recognitionStatus: 'SUCCESS',
      reviewStatus: 'CONFIRMED',
      reviewedBy: 7,
      reviewedAt: '2026-10-21T12:01:00',
      detectedAt: '2026-10-21T11:59:00',
    },
  ]
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    window.sources = []
    window.EventSource = class extends EventTarget {
      constructor() {
        super()
        window.sources.push(this)
      }
      close() {
        this.closed = true
      }
    }
  })
  await page.route('**/api/**', async (r) => {
    const u = new URL(r.request().url()),
      path = u.pathname
    calls.push({ path, query: u.search, method: r.request().method() })
    if (path.startsWith('/api/uploads/'))
      return r.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><rect width="240" height="80" fill="white"/><text x="30" y="50">12A3456</text></svg>',
      })
    let data = []
    if (path === '/api/customers/me') data = null
    if (path === '/api/managers/me')
      data = manager
        ? {
            id: 7,
            name: '관리자',
            role: 'REGIONAL_ADMIN',
            regions: [{ id: 1, name: '부산광역시' }],
          }
        : null
    if (path === '/api/regions') data = [{ id: 1, name: '부산광역시' }]
    if (path === '/api/underpasses')
      data = { items: [{ id: 1, name: '중앙 지하차도' }], totalItems: 1, totalPages: 1, page: 1 }
    if (path === '/api/plate-logs') {
      const items = rows.filter((row) =>
        ['reviewStatus', 'recognitionStatus'].every(
          (key) => !u.searchParams.get(key) || row[key] === u.searchParams.get(key),
        ),
      )
      data = { items, page: 1, totalItems: items.length, totalPages: 1 }
    }
    return r.fulfill({ json: { success: true, data } })
  })
  await page.goto(base + 'admin-data/ocr')
  await page.locator('.service-table tbody tr').nth(1).waitFor()
  assert.equal(await page.locator('h1').innerText(), 'OCR 인식 기록')
  assert.equal(
    await page.getByRole('navigation', { name: '업무 구분', exact: true }).locator('a').count(),
    2,
    'OCR only keeps its recognition/review tabs',
  )
  assert.equal(
    await page
      .getByRole('navigation', { name: '관련 업무 바로가기', exact: true })
      .locator('a')
      .count(),
    1,
    'transit is a compact contextual link',
  )
  assert(
    !new URLSearchParams(calls.filter((c) => c.path === '/api/plate-logs').at(-1).query).has(
      'reviewStatus',
    ),
    'OCR defaults to every processing status',
  )
  await page.getByRole('button', { name: '상세 보기', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('.ocr-record').waitFor()
  assert.equal(
    await dialog.locator('.ocr-image img').getAttribute('src'),
    '/api/uploads/ocr/11.svg',
  )
  assert((await dialog.innerText()).includes('12가3456'))
  assert(
    !calls.some((c) => /^\/api\/plate-logs\/\d+$/.test(c.path)),
    'no unsupported OCR detail endpoint',
  )
  await dialog.getByRole('link', { name: '이 시설의 수동 판별 대기 보기 →' }).click()
  await page.waitForURL('**/verify?**')
  await page.locator('.restored-review-grid').waitFor()
  assert(
    calls.some(
      (c) =>
        c.path === '/api/plate-logs' &&
        c.query.includes('reviewStatus=PENDING') &&
        c.query.includes('underpassId=1'),
    ),
  )
  await page.goto(base + 'admin-data/ocr')
  await page.getByLabel('인식 상태', { exact: true }).selectOption('SUCCESS')
  await page.getByRole('button', { name: '조회', exact: true }).click()
  await page.waitForTimeout(200)
  assert.equal(await page.locator('.service-table tbody tr').count(), 1)
  await page.getByLabel('인식 상태', { exact: true }).selectOption('')
  await page.getByRole('button', { name: '조회', exact: true }).click()
  await page.waitForTimeout(200)
  const before = calls.filter((c) => c.path === '/api/plate-logs').length
  rows = [
    ...rows,
    {
      id: 13,
      underpassName: '새 시설',
      detectedNum: '56다7890',
      recognitionStatus: 'FAIL',
      reviewStatus: 'NONE',
    },
  ]
  await page.evaluate(() =>
    window.sources
      .filter((s) => !s.closed)
      .at(-1)
      .dispatchEvent(
        new MessageEvent('data-changed', {
          data: JSON.stringify({ resource: 'plate-log', id: 13 }),
        }),
      ),
  )
  await page.waitForTimeout(500)
  assert(calls.filter((c) => c.path === '/api/plate-logs').length > before)
  assert.equal(await page.locator('.service-table tbody tr').count(), 3)
  let baseline
  for (const path of ['admin-data/ocr', 'pm-equipment', 'pm-queue', 'fac-list']) {
    await page.goto(base + path)
    await page.locator('#menu-btn,button[aria-label="관리자 메뉴 열기"]').first().click()
    const side = page.locator('aside.side')
    await side.waitFor({ state: 'visible' })
    const menu = await side
      .locator('.admin-sidebar-groups')
      .evaluate((el) => ({
        groups: [...el.querySelectorAll('summary')].map((e) => e.textContent),
        links: [...el.querySelectorAll('a')].map((e) => [e.textContent, e.getAttribute('href')]),
      }))
    if (baseline) assert.deepEqual(menu, baseline)
    else baseline = menu
    assert.deepEqual(menu.groups, [
      '지하차도 관리',
      '예지보전',
      'OCR·차량',
      '안전 대응',
      '고객·지원',
      '운영·설정',
    ])
    assert.equal(await side.locator('a[aria-current=page]').count(), 1)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + 'admin-data/ocr')
  await page.locator('h1').waitFor()
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
    'mobile table scroll stays inside the page',
  )
  await page.goto(base + 'admin-data/ocr?underpassId=1&carNum=12')
  await page
    .getByRole('navigation', { name: '업무 구분', exact: true })
    .getByRole('link', { name: '번호판 판별', exact: true })
    .click()
  await page.waitForURL('**/verify?**')
  assert(new URL(page.url()).searchParams.get('underpassId') === '1')
  assert(new URL(page.url()).searchParams.get('carNum') === '12')
  manager = false
  await page.goto(base + 'admin-data/ocr')
  await page.waitForURL('**/admin-login?**')
  assert(!calls.some((c) => c.method !== 'GET'))
  assert.deepEqual(errors, [])
  console.log(
    'PASS OCR: all statuses, original image/details, scoped manual review, filters, SSE refresh, shared sidebar classification/active links, mobile, manager authorization',
  )
} finally {
  await browser.close()
  await server.close()
}
