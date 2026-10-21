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
    calls.push({ path, method })
    let data = []
    if (path === '/api/customers/me') data = null
    if (path === '/api/managers/me')
      data = { id: 7, name: 'Manager', role: 'REGIONAL_ADMIN', regions: [{ id: 1, name: '부산광역시' }] }
    if (path === '/api/underpasses')
      data = { items: [facility], page: 1, totalItems: 1, totalPages: 1 }
    if (path === '/api/underpasses/1') data = { ...facility }
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
  await page.goto(base + '/admin-dashboard')
  await page.locator('.handover-x').click()
  await page.locator('.test-map-marker').first().click()
  const panel = page.locator('.manager-map-panel')
  const block = panel.getByRole('button', { name: '통제', exact: true })
  const release = panel.getByRole('button', { name: '통제 해제', exact: true })
  await page.waitForFunction(
    () => !document.querySelector('.manager-control-actions button').disabled,
  )
  assert(await block.isEnabled(), 'old risk observation does not lock a known NORMAL control state')
  assert(await release.isDisabled())
  const riskBaseline = riskRequests
  await block.click()
  const dialog = page.locator('.service-modal[open]')
  await dialog.locator('textarea').fill('Test block')
  await dialog.getByRole('button', { name: '확인', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert(
    await release.isEnabled(),
    'release is immediately available after successful block without SSE',
  )
  assert(await block.isDisabled())
  assert.equal(
    riskRequests,
    riskBaseline,
    'control success does not wait for risk/forecast reloads',
  )
  rejectRelease = true
  await release.click()
  await dialog.locator('textarea').fill('Test release')
  await dialog.getByRole('button', { name: '확인', exact: true }).click()
  await dialog.getByText('Control rejected').waitFor()
  assert(await block.isDisabled(), 'failed release never changes the control state')
  rejectRelease = false
  await dialog.getByRole('button', { name: '확인', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert(await block.isEnabled(), 'successful release immediately re-enables block')
  assert(await release.isDisabled())
  assert.equal(riskRequests, riskBaseline)
  assert.deepEqual(errors, [])
  console.log(
    'PASS immediate block/release after confirmed PDF response, stale risk independence, no SSE/extra risk wait and failed-action state preservation',
  )
} finally {
  await browser.close()
  await server.close()
}
