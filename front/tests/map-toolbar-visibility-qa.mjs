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

  for (const [width, height] of [
    [390, 844],
    [360, 640],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto(base + '/customer-app/screen-5')
    await page.locator('.test-map-marker').first().waitFor()
    const bar = page.locator('.mobile-app-map .kakao-map-controls'),
      map = page.locator('.mobile-app-map .mapw')
    for (const opened of [false, true]) {
      if (opened) await page.locator('.mobile-sheet-handle').click()
      await page.waitForTimeout(300)
      assert.equal(await bar.locator('button').count(), 4)
      const bounds = await map.boundingBox(),
        rect = await bar.boundingBox()
      assert(rect.x >= bounds.x && rect.x + rect.width <= bounds.x + bounds.width + 1)
      assert(
        rect.y >= bounds.y && rect.y + rect.height <= bounds.y + bounds.height + 1,
        'toolbar stays completely inside map',
      )
      for (const button of await bar.locator('button').all()) {
        const box = await button.boundingBox()
        assert.equal(box.width, 40)
        assert.equal(box.height, 40)
        assert(
          await button.evaluate((el) => {
            const r = el.getBoundingClientRect()
            return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
          }),
          'every control is clickable, not under the sheet: '+JSON.stringify(await button.evaluate((el)=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {name:el.getAttribute('aria-label'),rect:r.toJSON(),hit:hit?.outerHTML.slice(0,240),viewport:[innerWidth,innerHeight],map:el.closest('.mapw')?.getBoundingClientRect().toJSON(),sheet:document.querySelector('.app-map-sheet')?.getBoundingClientRect().toJSON(),root:document.querySelector('.mobile-app-map')?.getBoundingClientRect().toJSON(),bar:getComputedStyle(el.parentElement).cssText}})),
        )
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(base + '/c-map')
  await page.locator('.test-map-marker').first().waitFor()
  assert.equal(await page.locator('.kakao-map-controls button').count(), 4)
  await page.getByRole('button', { name: '\uC9C0\uB3C4 \uCD95\uC18C', exact: true }).click()
  assert((await page.evaluate(() => window.managerMap.level)) > 0)
  await page.goto(base + '/admin-app/screen-3')
  await page.locator('.test-map-marker').first().waitFor()
  assert.equal(await page.locator('.kakao-map-controls button').count(), 3)
  assert.deepEqual(errors, [])
  console.log(
    'PASS map toolbars: all four customer controls visible/clickable, 40px buttons, open/closed sheet, portrait/landscape, web zoom-out, three manager controls',
  )
} finally {
  await browser.close()
  await server.close()
}
