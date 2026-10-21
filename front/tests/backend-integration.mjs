import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const b = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [],
    calls = []
  p.on('pageerror', (e) => errors.push(e.message))
  await p.addInitScript(() => {
    for (const key of ['guest:regional', '7:REGIONAL_ADMIN'])
      localStorage.setItem(
        'routel-handover-hide:' + key,
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date()),
      )
  })
  let account = 'manager',
    rejectWrite = false
  const facility = {
    id: 3,
    name: '초량1지하차도',
    regionId: 1,
    regionName: '부산 동구',
    roadAddress: '부산 동구 초량동',
    latitude: 35.11,
    longitude: 129.03,
    currentStatus: 'NORMAL',
    currentRiskLevel: 'SAFE',
    riskScore: 20,
    currentBlockEventId: 8,
  }
  const envelope = (data) => ({ success: true, data })
  const paged = (items, url) => ({
    items,
    page: Number(url.searchParams.get('page') || 1),
    size: 20,
    totalItems: items.length,
    totalPages: 1,
  })
  await p.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method(),
      body = req.postDataJSON()
    calls.push({ path, method, body, query: Object.fromEntries(url.searchParams) })
    if (rejectWrite && method !== 'GET')
      return route.fulfill({
        status: 403,
        json: { success: false, message: '담당 지역 밖입니다.' },
      })
    if (path.endsWith('/login')) {
      account = path.includes('managers') ? 'manager' : 'customer'
      return route.fulfill({
        json: envelope(
          account === 'manager'
            ? {
                id: 7,
                loginId: 'admin',
                name: '김관리',
                role: 'REGIONAL_ADMIN',
                regions: [{ id: 1, name: '부산 동구' }],
              }
            : { id: 9, loginId: 'customer', name: '홍고객' },
        ),
      })
    }
    if (path === '/api/managers/me')
      return route.fulfill({
        json: envelope({
          id: 7,
          loginId: 'admin',
          name: '김관리',
          role: 'REGIONAL_ADMIN',
          regions: [{ id: 1, name: '부산 동구' }],
          phone: '01012345678',
          email: 'admin@example.com',
          shift: { id: 2, name: '주간', startTime: '06:00', endTime: '14:00' },
        }),
      })
    if (path === '/api/customers/me')
      return route.fulfill({
        json: envelope({
          id: 9,
          loginId: 'customer',
          name: '홍고객',
          phone: '01012345678',
          email: 'customer@example.com',
          roadAddress: '부산',
          detailAddress: '101호',
          zipcode: '12345',
          emergency: '01011112222',
        }),
      })
    if (method !== 'GET' && path.startsWith('/api/control/'))
      return route.fulfill({ contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\n%%EOF') })
    if (method !== 'GET')
      return route.fulfill({ json: envelope(method === 'DELETE' ? null : { id: 10, ...body }) })
    let data
    if (path.endsWith('/check-login-id')) data = { available: true }
    else if (path === '/api/regions') data = [{ id: 1, name: '부산 동구' }]
    else if (path === '/api/shifts') data = [{ id: 2, name: '주간' }]
    else if (path === '/api/underpasses') data = paged([facility], url)
    else if (path === '/api/underpasses/3') data = facility
    else if (path.endsWith('/cameras'))
      data = [{ id: 4, cameraRole: 'FINAL_LPR', streamUrl: 'https://example.com/stream.m3u8' }]
    else if (path.endsWith('/thresholds')) data = [{ id: 5, level: 'WARNING', riskScoreMin: 50 }]
    else if (path === '/api/managers')
      data = paged(
        [
          {
            id: 7,
            name: '김관리',
            role: 'REGIONAL_ADMIN',
            regions: [{ id: 1, name: '부산 동구' }],
            shiftId: 2,
          },
        ],
        url,
      )
    else if (path === '/api/plate-logs')
      data = paged(
        [
          {
            id: 6,
            underpassName: '초량1지하차도',
            detectedNum: '12가3456',
            reviewStatus: 'PENDING',
          },
        ],
        url,
      )
    else if (path.includes('/reason-presets')) data = [{ id: 1, content: '침수 위험' }]
    else if (path === '/api/display/presets')
      data = [{ id: 2, category: 'BLOCK', content: '진입 금지' }]
    else if (path === '/api/notices')
      data = paged([{ id: 1, title: 'Notice', important: true }], url)
    else if (path === '/api/notices/1')
      data = { id: 1, title: 'Notice', content: 'Notice body', important: true }
    else if (path === '/api/inquiries')
      data = paged([{ id: 11, title: 'Inquiry', status: 'PENDING' }], url)
    else if (path === '/api/inquiries/11')
      data = { id: 11, title: 'Inquiry', content: 'Question body', replyContent: 'Existing reply' }
    else if (path.endsWith('/device-tokens')) data = []
    else if (path.endsWith('/cars')) data = [{ id: 10, carNum: '12가3456' }]
    else if (path.startsWith('/api/dashboard/'))
      data = path.endsWith('/facility-kpi')
        ? {
            facilityCount: 1,
            blockedCount: 0,
            pendingReviewCount: 1,
            remainingCount: 1,
            alertsToday: 0,
            dangerLevelCount: 0,
          }
        : []
    else if (path.endsWith('/risk-scores')) data = []
    else data = paged([], url)
    return route.fulfill({ json: envelope(data) })
  })
  await p.goto('http://localhost:8282/admin-login')
  await p.getByLabel('아이디', { exact: true }).fill('admin')
  await p.getByLabel('비밀번호', { exact: true }).fill('password1!')
  await p.getByRole('button', { name: '로그인', exact: true }).click()
  await p.waitForURL('**/admin-dashboard')
  await p.locator('.server-summary').waitFor()
  assert.match(await p.locator('.server-summary').innerText(), /담당 시설/)
  await p.goto('http://localhost:8282/admin-data/facilities')
  await p.getByRole('button', { name: '통제 및 경찰 이관', exact: true }).click()
  await p.getByLabel('통제 사유', { exact: true }).fill('침수 위험 확인')
  const downloading = p.waitForEvent('download')
  await p.locator('.service-modal').getByRole('button', { name: '확인', exact: true }).click()
  await downloading
  assert(
    calls.some(
      (c) =>
        c.path === '/api/control/underpasses/3/block' &&
        c.method === 'POST' &&
        c.body.reason === '침수 위험 확인',
    ),
  )
  await p.goto('http://localhost:8282/admin-data/cameras?underpassId=3')
  await p.getByRole('button', { name: '새로 등록' }).click()
  await p.getByLabel('카메라 역할', { exact: true }).selectOption('FINAL_LPR')
  await p.getByLabel('영상 주소', { exact: true }).fill('https://example.com/video.m3u8')
  await p.locator('.service-modal').getByRole('button', { name: '확인', exact: true }).click()
  await p.locator('.service-modal').waitFor({ state: 'hidden' })
  assert(
    calls.some(
      (c) =>
        c.path === '/api/underpasses/3/cameras' &&
        c.method === 'POST' &&
        c.body.cameraRole === 'FINAL_LPR',
    ),
  )
  await p.goto('http://localhost:8282/admin-data/thresholds?underpassId=3')
  await p.getByRole('button', { name: '수정', exact: true }).click()
  await p.getByLabel('최소 위험 점수', { exact: true }).fill('55')
  await p.locator('.service-modal').getByRole('button', { name: '확인', exact: true }).click()
  await p.locator('.service-modal').waitFor({ state: 'hidden' })
  assert(
    calls.some(
      (c) =>
        c.path === '/api/underpasses/3/thresholds/WARNING' &&
        c.method === 'PUT' &&
        c.body.riskScoreMin === 55,
    ),
  )
  await p.goto('http://localhost:8282/admin-data/reviews')
  await p.getByRole('button', { name: '번호판 정정·확정' }).click()
  await p.getByLabel('확정할 차량 번호').fill('12가3457')
  await p.locator('.service-modal').getByRole('button', { name: '확인', exact: true }).click()
  await p.locator('.service-modal').waitFor({ state: 'hidden' })
  assert(
    calls.some((c) => c.path === '/api/plate-logs/6/review' && c.body.correctedNum === '12가3457'),
  )
  assert(calls.some((c) => c.path === '/api/plate-logs' && c.query.reviewStatus === 'PENDING'))
  await p.goto('http://localhost:8282/admin-data/managers')
  await p.getByRole('button', { name: '담당 지역 변경' }).click()
  await p.locator('.service-modal select').selectOption(['1'])
  await p.locator('.service-modal').getByRole('button', { name: '확인', exact: true }).click()
  await p.locator('.service-modal').waitFor({ state: 'hidden' })
  assert(calls.some((c) => c.path === '/api/managers/7/regions' && c.body.regionIds[0] === 1))
  await p.goto('http://localhost:8282/admin-data/regions')
  await p.getByRole('button', { name: '새로 등록' }).click()
  await p.getByLabel('지역명', { exact: true }).fill('새 지역')
  rejectWrite = true
  await p.locator('.service-modal').getByRole('button', { name: '확인', exact: true }).click()
  await p.locator('.service-modal [role=alert]').waitFor()
  assert.equal(await p.getByLabel('지역명', { exact: true }).inputValue(), '새 지역')
  assert(await p.locator('.service-modal').isVisible())
  rejectWrite = false
  await p.locator('.service-modal').getByRole('button', { name: '닫기', exact: true }).click()
  await p.goto('http://localhost:8282/admin-data/notices')
  await p.getByRole('button', { name: '수정', exact: true }).click()
  await p.getByLabel('내용', { exact: true }).waitFor()
  await p.getByLabel('제목', { exact: true }).fill('수정 공지')
  await p.locator('.service-modal').getByRole('button', { name: '확인', exact: true }).click()
  await p.locator('.service-modal').waitFor({ state: 'hidden' })
  assert(
    calls.some(
      (c) => c.path === '/api/notices/1' && c.method === 'PUT' && c.body.important === true,
    ),
  )
  await p.goto('http://localhost:8282/admin-data/inquiries')
  await p.getByRole('button', { name: '답변 등록', exact: true }).click()
  assert.equal(await p.getByLabel('답변 내용', { exact: true }).inputValue(), '')
  await p.getByLabel('답변 내용', { exact: true }).fill('답변입니다')
  await p.locator('.service-modal').getByRole('button', { name: '확인', exact: true }).click()
  await p.locator('.service-modal').waitFor({ state: 'hidden' })
  assert(
    calls.some(
      (c) =>
        c.path === '/api/inquiries/11/reply' &&
        c.method === 'POST' &&
        c.body.content === '답변입니다',
    ),
  )
  await p.goto('http://localhost:8282/admin-data/transits?underpassId=3')
  await p.getByLabel('차량 번호', { exact: true }).fill('12가')
  await p.getByRole('button', { name: '조회', exact: true }).click()
  await p.waitForTimeout(100)
  assert(
    calls.some(
      (c) =>
        c.path === '/api/underpasses/transits' &&
        c.query.carNum === '12가' &&
        c.query.underpassId === '3' &&
        !c.query.keyword,
    ),
  )
  await p.goto('http://localhost:8282/login')
  await p.getByLabel('아이디', { exact: true }).fill('customer')
  await p.getByLabel('비밀번호', { exact: true }).fill('password1!')
  await p.getByRole('button', { name: '로그인', exact: true }).click()
  await p.waitForURL('**/my-home')
  await p.getByLabel('이름', { exact: true }).waitFor()
  await p.getByLabel('이름', { exact: true }).fill('새 이름')
  await p.getByRole('button', { name: '기본 정보 저장' }).click()
  assert(
    calls.some(
      (c) =>
        c.path === '/api/customers/me' && c.method === 'PUT' && c.body.detailAddress === '101호',
    ),
  )
  await p.goto('http://localhost:8282/my-cars')
  await p.getByRole('button', { name: '새로 등록' }).click()
  await p.getByLabel('차량 번호', { exact: true }).fill('34나5678')
  await p.locator('.service-modal').getByRole('button', { name: '확인', exact: true }).click()
  await p.locator('.service-modal').waitFor({ state: 'hidden' })
  assert(
    calls.some(
      (c) =>
        c.path === '/api/customers/me/cars' && c.method === 'POST' && c.body.carNum === '34나5678',
    ),
  )
  for (const width of [390, 360]) {
    await p.setViewportSize({ width, height: 900 })
    await p.goto('http://localhost:8282/admin-data/regions')
    await p.getByRole('heading', { name: '지역 관리', exact: true }).waitFor()
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    )
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS backend contracts: manager/customer sessions, dashboard, PDF control, cameras, thresholds, plate review, regions assignment, failed writes retain input, profile preservation, vehicles and mobile layouts',
  )
} finally {
  await b.close()
}
