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
    class MarkerImage {}
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
    if (path === '/api/dashboard/timeline')
      data = Array.from({ length: 30 }, (_, i) => ({
        createdAt: '2026-10-21T12:00:00',
        underpassName: 'Facility ' + i,
        eventType: 'BLOCK',
        reason: 'Control event description ' + i,
      }))
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
  await page.goto(base + '/admin-dashboard')
  await page.locator('.handover-x').click()
  await page.locator('.test-map-marker').nth(2).waitFor()
  assert.equal(
    await page.locator('.map-sidebar,.underpass-map-table,.live-cluster-list').count(),
    0,
  )
  const initial = await page.evaluate(() => ({
    bounds: window.managerMap.bounds,
    level: window.managerMap.level,
  }))
  assert.equal(initial.bounds.length, 2, 'initial bounds use the two assigned districts')
  assert(initial.bounds.every((p) => p.lng < 129.04))
  assert(initial.level <= 6, 'initial assigned view is closer')

  const list = page.locator('.fixed-events .tl'),
    head = page.locator('.fixed-events .wg-head')
  await list.locator('li').nth(29).waitFor({ state: 'attached' })
  await list.hover()
  const before = await head.boundingBox()
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(200)
  assert(await list.evaluate((el) => el.scrollTop > 0), 'event list scrolls vertically')
  const after = await head.boundingBox()
  assert(Math.abs(before.y - after.y) < 1, 'event heading stays fixed')
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await list.hover()
  await page.evaluate(() => window.scrollTo(0, 0))
  await list.hover({ position: { x: 20, y: 40 } })
  const pageBefore = await page.evaluate(() => document.scrollingElement.scrollTop)
  await page.mouse.wheel(0, 250)
  await page.waitForTimeout(250)
  assert(
    (await page.evaluate(() => document.scrollingElement.scrollTop)) > pageBefore,
    'at the list bottom, wheel continues down the page',
  )
  await list.evaluate((el) => {
    el.replaceChildren()
  })
  await list.hover()
  await page.evaluate(() => window.scrollTo(0, 0))
  await list.hover({ position: { x: 20, y: 40 } })
  const emptyBefore = await page.evaluate(() => document.scrollingElement.scrollTop)
  await page.mouse.wheel(0, 150)
  await page.waitForTimeout(250)
  assert(
    (await page.evaluate(() => document.scrollingElement.scrollTop)) > emptyBefore,
    'empty event list does not trap page scrolling',
  )
  assert.deepEqual(errors, [])
  console.log('PASS recent events scroll: 30 entries, vertical list scrolling, fixed title')
} finally {
  await browser.close()
  await server.close()
}
