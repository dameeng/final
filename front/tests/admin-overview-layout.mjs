import { chromium, expect } from '@playwright/test'
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
      getProjection() { return { containerPointFromCoords: () => window.popupAnchor || ({x:0,y:0}) } }
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
        this.el.textContent = ''
        Object.assign(this.el.style, {
          position: 'absolute',
          width:'16px',height:'16px',padding:'0',borderRadius:'50%',background:'#54a391',
          top: '160px',
          left: options.title.includes('Facility 1')
            ? '100px'
            : options.title.includes('Facility 2')
              ? '240px'
              : '280px',
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
          emit(this, 'clusterclick', { getMarkers: () => this.markers.slice(0, window.popupCount || 2) })
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
    if (path === '/api/underpasses') data = { items: Array.from({length:30},(_,index)=>({...rows[index%3],id:index+1,name:index===0?'Long facility name for layout validation':'Facility '+(index+1)})), page:1,totalItems:30,totalPages:1 }
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



  for (const [width,height] of [[390,844],[430,932],[320,640],[844,430]]) {
    await page.setViewportSize({width,height})
    await page.goto(base+'/admin-app/screen-3')
    const map=page.locator('.map-only-live')
    await map.waitFor()
    await page.waitForTimeout(300)
    const notice=page.locator('.overview-control-notice[open]')
    if(await notice.count()) await notice.getByRole('button').click()
    assert.equal(await page.locator('.admin-facility-sheet,.admin-sheet-handle,.overview-stats').count(),0)
    const mapBox=await map.boundingBox(), nav=await page.locator('.admin-app-bottom-nav').boundingBox(),title=await page.locator('.manager-app-titlebar').boundingBox(),shell=await page.locator('.manager-app-shell').boundingBox()
    assert(Math.abs(mapBox.y-title.y-title.height)<2,'Map starts directly below titlebar')
    assert(Math.abs(mapBox.y+mapBox.height-nav.y)<2,'Map extends to bottom navigation')
    assert(Math.abs(mapBox.x-shell.x)<2 && Math.abs(mapBox.width-shell.width)<2,'Map fills app width')
    const controls=await page.locator('.admin-map-control-dock').boundingBox()
    assert(controls.y+controls.height<=nav.y,'Map controls remain above navigation')
    await page.getByRole('button',{name:'\uC9C0\uB3C4 \uD655\uB300',exact:true}).click()
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
    for (const anchorY of [10, mapBox.height / 2, mapBox.height - 10]) {
      await page.evaluate(y => { window.popupAnchor = { x: 4, y }; window.popupCount = 30; window.openManagerCluster() }, anchorY)
      const popup=page.locator('.admin-map-floating-popup.routel-cluster-popup')
      await expect(popup).toBeVisible()
      const box=await popup.boundingBox()
      assert(box.x>=mapBox.x && box.x+box.width<=mapBox.x+mapBox.width+1,'Popup stays inside map horizontally')
      assert(box.y>=mapBox.y && box.y+box.height<=nav.y,'Popup stays above navigation')
      for (const obstacle of await page.locator('.admin-map-search,.map-overlay-toolbar').all()) {
        if (await obstacle.isVisible()) {
          const tool=await obstacle.boundingBox()
          assert(box.y>=tool.y+tool.height,'Popup stays below search and traffic tools')
        }
      }
      const last=popup.locator('li').last()
      await last.scrollIntoViewIfNeeded()
      assert(await last.locator('button').evaluate(element=>{const rect=element.getBoundingClientRect();return element.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2))}),'Last popup row is not covered')
      await popup.getByRole('button',{name:'묶음 목록 닫기'}).click()
      await expect(page.locator('.admin-map-control-dock')).toBeVisible()
    }
    const search=page.locator('.admin-map-search input'), submit=page.locator('.admin-map-search button')
    await search.fill('long facility name')
    await submit.click()
    await expect.poll(()=>page.evaluate(()=>window.managerMap.level)).toBe(4)
    assert.equal(await page.evaluate(()=>window.managerMap.center.lat),35.104)
    const requestsBefore=calls.filter(call=>call.path==='/api/underpasses').length
    await search.fill('서구')
    await submit.click()
    await expect.poll(()=>page.evaluate(()=>window.managerMap.bounds?.length)).toBe(10)
    assert(await page.evaluate(()=>window.managerMap.bounds.every(point=>point.lng===129.02)))
    await search.fill('ㅎㅇㄷㄱ')
    await submit.click()
    await expect.poll(()=>page.evaluate(()=>window.managerMap.bounds.every(point=>point.lng===129.16))).toBe(true)
    assert.equal(calls.filter(call=>call.path==='/api/underpasses').length,requestsBefore,'Search uses loaded facilities immediately')
  }
  assert.deepEqual(errors,[])
  console.log('PASS administrator map fills app between titlebar and navigation; no slider; map controls work at four viewport sizes')
} finally {await browser.close();await server.close()}
