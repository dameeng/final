import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
const base = server.resolvedUrls.local[0].replace(/\/$/, '')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const { patchFacility, appendRiskHistory, plateQueueRow } = await server.ssrLoadModule(
    '/src/services/streamUpdates.ts',
  )
  const blocked = { id: 1, currentStatus: 'BLOCKED', riskScore: 10 }
  assert.equal(
    patchFacility(blocked, {
      name: 'risk-update',
      data: { underpassId: 1, riskScore: 90, riskLevel: 'ALERT' },
    }).currentStatus,
    'BLOCKED',
  )
  assert.equal(
    patchFacility(blocked, { name: 'water-update', data: { underpassId: 2, waterCm: 20 } }),
    blocked,
  )
  assert.equal(
    appendRiskHistory([{ predictedAt: '2026-10-21T10:00:00Z', riskScore: 10 }], {
      predictedAt: '2026-10-21T10:00:00Z',
      riskScore: 80,
    })[0].riskScore,
    80,
  )
  const plate = plateQueueRow({ plateLogId: 9, remainingSeconds: 0 }, { imageUrl: '/plate.jpg' })
  assert.equal(plate.reviewStatus, 'PENDING')
  assert.equal(plate.imageUrl, '/plate.jpg')
  assert(
    plate.reviewExpiresAt <= Date.now(),
    'expired countdown stays pending until server completion',
  )
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [],
    calls = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    window.streams = []
    window.EventSource = class extends EventTarget {
      constructor(url, options) {
        super()
        this.url = url
        this.options = options
        window.streams.push(this)
      }
      close() {
        this.closed = true
      }
    }
  })
  let session = 'manager'
  const now = Date.now(),
    time = (offset) => new Date(now + offset * 3600000).toISOString()
  let facilities = ['SAFE', 'WATCH', 'CAUTION', 'ALERT', 'SEVERE'].map((currentRiskLevel, i) => ({
    id: i + 1,
    name: '시설 ' + (i + 1),
    regionId: 1,
    regionName: '부산광역시',
    roadAddress: '부산광역시 중구',
    latitude: 35.1,
    longitude: 129.03,
    currentStatus: 'NORMAL',
    currentRiskLevel,
    manageable: i !== 4,
    riskScore: 20 + i * 15,
    currentRiskScore: 20 + i * 15,
    heightM: 4,
    lengthM: 120,
    widthM: 10,
    lanes: 2,
    safetyGrade: 'B',
    riverDistM: 125,
    seaDistM: 900,
    earlyBlock: true,
    floodHistoryCount: 1,
    currentWaterCm: 3,
  }))
  let notices = [
    {
      id: 1,
      title: '점검 공지',
      content: '공지 본문',
      category: 'MAINTENANCE',
      categoryLabel: '점검',
      important: true,
      viewCount: 4,
      createdAt: time(0),
    },
  ]
  let faqs = [
    {
      id: 1,
      question: '차량 등록 방법',
      answer: '마이페이지 내 차량에서 등록합니다.',
      category: 'VEHICLE',
      sortOrder: 1,
      viewCount: 2,
    },
    {
      id: 2,
      question: '알림 설정',
      answer: '알림 설정에서 변경합니다.',
      category: 'NOTIFICATION',
      sortOrder: 2,
      viewCount: 1,
    },
  ]
  let inquiries = [
    { id: 1, title: '수정 가능 문의', content: '문의 내용', status: 'PENDING' },
    {
      id: 2,
      title: '답변 완료 문의',
      content: '문의 내용',
      status: 'ANSWERED',
      replyContent: '답변',
    },
  ]
  let transits = [
    { id: 10, underpassName: '시설 1', carNum: '12가1234', status: 'REMAINING' },
    { id: 11, underpassName: '시설 1', carNum: '34나5678', status: 'EXITED' },
  ]
  let notifications = [
    {
      id: 1,
      category: 'TASK',
      title: '새 문의 접수',
      body: '문의가 등록되었습니다.',
      read: false,
      createdAt: time(0),
    },
  ]
  const paged = (items) => ({ items, page: 1, size: 20, totalItems: items.length, totalPages: 1 })
  await page.route('**/api/**', async (r) => {
    const req = r.request(),
      u = new URL(req.url()),
      path = u.pathname,
      method = req.method(),
      body = req.postDataJSON?.()
    calls.push({ path, method, body, query: u.search })
    let data = []
    if (path === '/api/customers/me')
      data =
        session === 'customer'
          ? { id: 2, name: '고객', loginId: 'customer', phone: '01012345678' }
          : null
    if (path === '/api/managers/me')
      data =
        session === 'manager'
          ? {
              id: 1,
              name: '관리자',
              role: 'REGIONAL_ADMIN',
              regions: [{ id: 1, name: '부산광역시' }],
            }
          : null
    if (path === '/api/regions') data = [{ id: 1, name: '부산광역시' }]
    if (path === '/api/underpasses') data = paged(facilities)
    if (/^\/api\/underpasses\/\d+$/.test(path)) {
      const id = Number(path.split('/').at(-1))
      if (method === 'PUT')
        facilities = facilities.map((row) => (row.id === id ? { ...row, ...body } : row))
      data = facilities.find((row) => row.id === id)
    }
    if (path.endsWith('/risk-scores'))
      data = [
        { riskScore: 10, predictedAt: time(-1), rainfallMm: 2 },
        { riskScore: 20, predictedAt: time(0), rainfallMm: 3 },
      ]
    if (path.endsWith('/risk-forecast'))
      data = [{ riskScore: 45, targetAt: time(1), rainfallMm: 8, predictedAt: time(0) }]
    if (path === '/api/notices') {
      if (method === 'POST') {
        notices.push({ id: 2, ...body, viewCount: 0 })
        data = notices.at(-1)
      } else
        data = paged(
          notices.filter(
            (row) =>
              !u.searchParams.get('category') || row.category === u.searchParams.get('category'),
          ),
        )
    }
    if (/^\/api\/notices\/\d+$/.test(path))
      data = notices.find((row) => row.id === Number(path.split('/').at(-1)))
    if (path === '/api/faqs')
      data = paged(
        faqs.filter(
          (row) =>
            !u.searchParams.get('keyword') || row.question.includes(u.searchParams.get('keyword')),
        ),
      )
    if (path === '/api/faqs/popular') data = faqs
    if (path === '/api/faqs/order') {
      faqs = body.ids.map((id) => faqs.find((row) => row.id === id))
      data = null
    }
    if (/^\/api\/faqs\/\d+$/.test(path))
      data = faqs.find((row) => row.id === Number(path.split('/').at(-1)))
    if (path === '/api/customers/me/inquiries') data = paged(inquiries)
    if (/^\/api\/customers\/me\/inquiries\/\d+$/.test(path)) {
      const id = Number(path.split('/').at(-1))
      if (method === 'PUT')
        inquiries = inquiries.map((row) => (row.id === id ? { ...row, ...body } : row))
      if (method === 'DELETE') inquiries = inquiries.filter((row) => row.id !== id)
      data = inquiries.find((row) => row.id === id) || null
    }
    if (path === '/api/underpasses/transits') data = paged(transits)
    if (path.endsWith('/transits/10/complete')) {
      transits[0].status = 'EXITED'
      data = transits[0]
    }
    if (path === '/api/managers/me/notifications') data = paged(notifications)
    if (path.endsWith('/notifications/unread-count'))
      data = { total: notifications.filter((row) => !row.read).length, byCategory: { TASK: 1 } }
    if (path.endsWith('/notifications/read-all')) {
      notifications.forEach((row) => (row.read = true))
      data = null
    }
    if (path === '/api/customers')
      data = paged([{ id: 2, name: '고객', loginId: 'customer', phone: '01012345678' }])
    if (path === '/api/weather')
      data = {
        temperature: 18,
        humidity: 70,
        rainfall: 2,
        condition: '비',
        observedAt: time(0),
        hourly: [{ time: '15시', temperature: 18, rainfall: 3 }],
      }
    await r.fulfill({ json: { success: true, data } })
  })

  const emit = (name, data) =>
    page.evaluate(
      ({ name, data }) =>
        window.streams
          .filter((s) => !s.closed)
          .at(-1)
          .dispatchEvent(
            new MessageEvent(name, {
              data: typeof data === 'string' ? data : JSON.stringify(data),
            }),
          ),
      { name, data },
    )
  const count = (path) => calls.filter((c) => c.path === path).length
  await page.goto(base + '/fac-detail?id=1')
  await page.locator('.restored-facility-detail').waitFor()
  await page.waitForTimeout(400)
  assert.equal(await page.evaluate(() => window.streams.filter((s) => !s.closed).length), 1)
  assert.equal(
    await page.evaluate(() => window.streams.filter((s) => !s.closed)[0].url),
    '/api/admin/stream',
  )
  const initial = calls.length
  await emit('risk-update', {
    underpassId: 1,
    riskScore: 87,
    riskLevel: 'ALERT',
    rainfall1hMm: 42,
    predictedAt: time(1),
  })
  await emit('water-update', {
    underpassId: 1,
    waterCm: 19,
    riskLevel: 'ALERT',
    measuredAt: time(1),
  })
  await page.waitForTimeout(350)
  assert((await page.locator('.restored-facility-detail').innerText()).includes('19 cm'))
  assert.equal(calls.length, initial, 'data events update without REST')
  const forecast = count('/api/underpasses/1/risk-forecast'),
    detail = count('/api/underpasses/1')
  await emit('data-changed', { resource: 'risk-forecast', id: 1 })
  await page.waitForTimeout(400)
  assert(count('/api/underpasses/1/risk-forecast') > forecast)
  assert.equal(count('/api/underpasses/1'), detail)
  await emit('connected', 'connected')
  await page.waitForTimeout(600)
  assert(
    count('/api/underpasses/1') > detail,
    'reconnect reloads REST snapshot even with plain connected data',
  )
  await page.evaluate(async () => {
    const { useApp } = await import('/src/stores/app.ts')
    const app = useApp()
    app.account = { ...app.account, regions: [{ id: 2, name: '???' }] }
  })
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(() => window.streams.filter((s) => !s.closed).length), 1)
  assert(await page.evaluate(() => window.streams.some((s) => s.closed)))
  const beforeOld = calls.length
  await page.evaluate(() =>
    window.streams
      .find((s) => s.closed)
      .dispatchEvent(new MessageEvent('connected', { data: '{}' })),
  )
  await page.waitForTimeout(400)
  assert.equal(calls.length, beforeOld, 'stale source ignored')
  await page.goto(base + '/admin-data/facilities')
  await page.locator('.row-open').first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '\uC218\uC815', exact: true }).click()
  await dialog.getByLabel('\uCC28\uB85C\uC218', { exact: true }).fill('7')
  const beforeEdit = count('/api/underpasses')
  await emit('data-changed', { resource: 'underpass', id: 1 })
  await page.waitForTimeout(400)
  assert.equal(await dialog.getByLabel('\uCC28\uB85C\uC218', { exact: true }).inputValue(), '7')
  assert.equal(count('/api/underpasses'), beforeEdit)
  await dialog.getByRole('button', { name: '\uB2EB\uAE30', exact: true }).click()
  await page.waitForTimeout(500)
  assert(count('/api/underpasses') > beforeEdit)
  session = 'customer'
  await page.goto(base + '/my-alerts')
  await page.locator('.notification-center-list').waitFor()
  await page.waitForTimeout(500)
  assert.equal(
    await page.evaluate(() => window.streams.filter((s) => !s.closed).at(-1).url),
    '/api/stream',
  )
  const beforeNotification = calls.length
  const notification = {
    id: 91,
    category: 'NOTICE',
    title: 'SSE notification',
    body: 'Event body',
    createdAt: time(0),
    unread: { total: 7, byCategory: { NOTICE: 7 } },
  }
  await emit('notification-new', notification)
  await page.getByText('SSE notification', { exact: true }).first().waitFor()
  await emit('notification-new', notification)
  await page.waitForTimeout(200)
  assert.equal(
    await page
      .locator('.notification-center-title')
      .filter({ hasText: 'SSE notification' })
      .count(),
    1,
  )
  assert.equal(calls.length, beforeNotification, 'customer notification does not re-fetch')
  assert.equal(
    await page.evaluate(async () => {
      const { useApp } = await import('/src/stores/app.ts')
      return useApp().unread
    }),
    7,
  )
  await page.clock.install()
  await page.clock.fastForward(65000)
  await page.waitForTimeout(100)
  assert.equal(calls.length, beforeNotification, 'no notification polling')
  assert.deepEqual(errors, [])
  console.log(
    'PASS SSE: one stream, direct risk/water, scoped forecast invalidation, reconnect snapshot, region restart, stale source guard, edit protection, direct notification/unread/dedup, no polling',
  )
} finally {
  await browser.close()
  await server.close()
}
