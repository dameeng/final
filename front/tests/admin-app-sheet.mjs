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
      getBounds() { return { contain: () => true } }
      getProjection() { return { containerPointFromCoords: () => ({ x:0, y:0 }) } }
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
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget {
      close() {}
    }
  })
  const facility = {
    id: 1,
    manageable: true,
    name: 'Facility 1',
    regionId: 1,
    regionName: '부산광역시',
    roadAddress: '부산광역시 중구',
    latitude: 35.17,
    longitude: 129.07,
    currentStatus: 'NORMAL',
    currentRiskLevel: 'WATCH',
    remainingCount: 0,
    pendingReviewCount: 0,
  }
  let riskRequests = 0,
    rejectRelease = false
  await page.route('**/api/**', async (r) => {
    const path = new URL(r.request().url()).pathname,
      method = r.request().method()
    calls.push({ path, method, body: r.request().postDataJSON() })
    let data = []
    if (path === '/api/customers/me') data = null
    if (path === '/api/managers/me')
      data = { id: 7, name: 'Manager', role: 'REGIONAL_ADMIN', regions: [{ id: 1, name: '부산광역시' }] }
    if (path === '/api/underpasses')
      data = { items: [facility], page: 1, totalItems: 1, totalPages: 1 }
    if (path === '/api/underpasses/1') data = { ...facility }
    if (path === '/api/control/reason-presets') data = [{ id: 1, content: 'Preset reason' }]
    if (path.endsWith('/risk-scores')) {
      riskRequests++
      data = [
        {
          riskScore: 23.9,
          rainfallMm: 0,
          predictedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
        },
      ]
    }
    if (path.endsWith('/block') || path.endsWith('/release')) {
      if (rejectRelease && path.endsWith('/release'))
        return r.fulfill({ status: 403, json: { success: false, message: 'Control rejected' } })
      facility.currentStatus = path.endsWith('/block') ? 'BLOCKED' : 'NORMAL'
      return r.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' })
    }
    return r.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`

  await page.setViewportSize({width:390,height:844})
  await page.goto(base + '/admin-app/screen-3')
  const handle=page.locator('.admin-sheet-handle')
  await handle.waitFor()
  assert.equal(await handle.getAttribute('aria-expanded'),'false')
  assert.equal(await page.locator('.app-overview .card').count(),0)
  const rect=await handle.boundingBox()
  await page.mouse.move(rect.x+rect.width/2,rect.y+30)
  await page.mouse.down()
  await page.mouse.move(rect.x+rect.width/2,rect.y-200,{steps:12})
  await page.mouse.up()
  await page.waitForTimeout(300)
  assert.equal(await handle.getAttribute('aria-expanded'),'true')
  await page.locator('.admin-sheet-facility').first().waitFor()
  await handle.click()
  assert.equal(await handle.getAttribute('aria-expanded'),'false')
  assert.deepEqual(errors,[])
  console.log('PASS admin facility sheet swipe, click collapse, facility list, removed summary cards')
} finally { await browser.close(); await server.close() }
