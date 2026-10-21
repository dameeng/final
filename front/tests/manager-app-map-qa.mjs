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
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
    errors = [],
    calls = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    const handlers = new WeakMap(),
      emit = (target, type, data) => (handlers.get(target)?.[type] || []).forEach((fn) => fn(data))
    const event = {
      addListener(target, type, fn) {
        const all = handlers.get(target) || {}
        ;(all[type] ??= []).push(fn)
        handlers.set(target, all)
      },
      removeListener() {},
    }
    class MapStub {
      constructor(host, options) {
        this.host = host
        this.center = options.center
        this.level = options.level
        window.managerMap = this
        host.style.background = '#dce8ef'
      }
      setZoomable() {}
      getCenter() {
        return this.center
      }
      setCenter(p) {
        this.center = p
      }
      panTo(p) {
        this.center = p
      }
      getLevel() {
        return this.level
      }
      setLevel(v) {
        this.level = v
      }
      setBounds(bounds) {
        this.bounds = bounds.points
        this.level = 11
      }
      relayout() {}
    }
    class Marker {
      constructor(options) {
        this.options = options
        this.el = document.createElement('button')
        this.el.className = 'test-map-marker'
        this.el.textContent = options.title
        Object.assign(this.el.style, {
          position: 'absolute',
          top: '160px',
          left: options.title.includes('Facility 1')
            ? '100px'
            : options.title.includes('Facility 2')
              ? '240px'
              : '380px',
        })
        options.map.host.append(this.el)
        this.el.onclick = () => emit(this, 'click')
      }
      setMap(value) {
        if (!value) this.el.remove()
      }
    }
    class MarkerClusterer {
      constructor(options) {
        this.map = options.map
        window.openManagerCluster = () =>
          emit(this, 'clusterclick', { getMarkers: () => this.markers.slice(0, 2) })
      }
      clear() {
        this.markers = []
      }
      addMarkers(markers) {
        this.markers = markers
        window.managerMarkers = markers
      }
      redraw() {}
    }
    class LatLng {
      constructor(lat, lng) {
        this.lat = lat
        this.lng = lng
      }
    }
    class LatLngBounds {
      constructor() {
        this.points = []
      }
      extend(p) {
        this.points.push(p)
      }
    }
    class MarkerImage {
      constructor(src) {
        this.src = src
      }
    }
    class Size {}
    class Point {}
    class InfoWindow {
      close() {}
      open() {}
      setContent() {}
    }
    window.kakao = {
      maps: {
        Map: MapStub,
        Marker,
        MarkerClusterer,
        LatLng,
        LatLngBounds,
        MarkerImage,
        Size,
        Point,
        InfoWindow,
        event,
        load: (fn) => fn(),
      },
    }
  })
  const rows = [
    {
      id: 1,
      manageable: true,
      name: 'Facility 1',
      regionId: 1,
      regionName: '부산광역시',
      roadAddress: '부산광역시 중구 중앙대로',
      latitude: 35.104,
      longitude: 129.03,
      currentStatus: 'NORMAL',
      currentRiskLevel: 'WARNING',
      riskScore: 55,
      remainingCount: 2,
      pendingReviewCount: 1,
    },
    {
      id: 2,
      manageable: true,
      name: 'Facility 2',
      regionId: 1,
      regionName: '부산광역시',
      roadAddress: '부산광역시 서구 충무대로',
      latitude: 35.11,
      longitude: 129.02,
      currentStatus: 'BLOCKED',
      currentRiskLevel: 'DANGER',
      riskScore: 80,
      remainingCount: 0,
      pendingReviewCount: 0,
    },
    {
      id: 3,
      manageable: false,
      name: 'Facility 3',
      regionId: 1,
      regionName: '부산광역시',
      roadAddress: '부산광역시 해운대구 해운대로',
      latitude: 35.16,
      longitude: 129.16,
      currentStatus: 'NORMAL',
      currentRiskLevel: 'SAFE',
      riskScore: 20,
      remainingCount: 0,
      pendingReviewCount: 0,
    },
  ]
  await page.route('**/api/**', (r) => {
    const url = new URL(r.request().url()),
      path = url.pathname
    calls.push({ path, method: r.request().method() })
    let data = []
    if (path === '/api/customers/me') data = null
    if (path === '/api/managers/me')
      data = {
        id: 7,
        name: 'Manager',
        role: 'REGIONAL_ADMIN',
        regions: [
          { id: 8, name: '중구' },
          { id: 9, name: '서구' },
        ],
      }
    if (path === '/api/underpasses') data = { items: rows, page: 1, totalItems: 3, totalPages: 1 }
    if (/^\/api\/underpasses\/\d+$/.test(path))
      data = rows.find((row) => row.id === Number(path.split('/').at(-1)))
    if (path.endsWith('/risk-scores'))
      data = [{ riskScore: 55, rainfallMm: 2, predictedAt: new Date().toISOString() }]
    if (path === '/api/navigation/weather')
      data = {
        temperature: 16,
        condition: '맑음',
        humidity: 60,
        rainfall: 0,
        observedAt: new Date().toISOString(),
      }
    if (path === '/api/dashboard/facility-kpi')
      data = {
        facilityCount: 3,
        blockedCount: 1,
        dangerLevelCount: 1,
        pendingReviewCount: 1,
        remainingCount: 2,
        alertsToday: 0,
      }
    return r.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + '/admin-app/screen-3')
  await page.locator('.test-map-marker').nth(2).waitFor()
  const legend = page.locator('.map-only-legend')
  assert.equal(await legend.locator('li').count(), 5)
  assert.equal(
    await legend
      .locator('li')
      .allTextContents()
      .then((rows) => rows.join(',')),
    '\uD1B5\uC81C,\uC704\uD5D8,\uC8FC\uC758,\uC548\uC804,\uB2F4\uB2F9 \uC678 \uC2DC\uC124',
  )
  const markerSvg = await page.evaluate(() =>
    window.managerMarkers.map((marker) => ({
      title: marker.options.title,
      svg: decodeURIComponent(marker.options.image.src.split(',')[1]),
    })),
  )
  assert(
    markerSvg.find((row) => row.title.includes('Facility 3')).svg.includes('fill="#9aa3ae"'),
    'outside facility is gray',
  )
  assert(
    !markerSvg.find((row) => row.title.includes('Facility 1')).svg.includes('fill="#9aa3ae"'),
    'assigned facility retains status color',
  )
  for (const marker of markerSvg)
    assert(marker.svg.includes('stroke-dasharray="3 3"'), 'manager markers use dashed rings')
  const controls = page.locator('.map-only-live .kakao-map-controls'),
    box = await controls.boundingBox()
  assert(box.height >= 120 && box.height < 130, 'toolbar wraps just three compact buttons')
  for (const button of await controls.locator('button').all()) {
    const b = await button.boundingBox()
    assert(b.height <= 42 && b.width <= 42)
  }
  assert.equal(
    await page
      .getByRole('button', { name: '\uB0B4 \uC704\uCE58 \uCC3E\uAE30', exact: true })
      .count(),
    0,
  )
  assert.equal(
    await page.evaluate(() => window.managerMap.bounds.length),
    2,
    'assigned-region facilities set the initial map bounds',
  )
  assert.equal(
    await page.evaluate(() => window.managerMap.level),
    11,
    'overview preserves bounds fit instead of forcing a close zoom',
  )
  await page.locator('.test-map-marker').filter({ hasText: 'Facility 1' }).click()
  await page.locator('.map-only-selection').waitFor()
  assert(
    (await page.locator('.map-only-selection a').getAttribute('href')).includes(
      '/admin-app/screen-5?id=1',
    ),
  )
  await page.goto(base + '/admin-dashboard')
  await page.locator('.handover-x').click()
  await page.locator('.test-map-marker').first().waitFor()
  assert.equal(
    await page
      .getByRole('button', { name: '\uB0B4 \uC704\uCE58 \uCC3E\uAE30', exact: true })
      .count(),
    0,
  )
  await page.goto(base + '/c-map')
  await page.locator('.test-map-marker').first().waitFor()
  assert.equal(
    await page
      .getByRole('button', { name: '\uB0B4 \uC704\uCE58 \uCC3E\uAE30', exact: true })
      .count(),
    1,
    'customer location button stays available',
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS manager app map: visible markers, four status grades, bounded initial view, compact toolbar, detail link, manager location removed/customer retained',
  )
} finally {
  await browser.close()
  await server.close()
}
