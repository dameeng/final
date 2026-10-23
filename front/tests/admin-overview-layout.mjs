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
      getProjection() { return { containerPointFromCoords: () => ({x:0,y:0}) } }
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


  for(const [width,height] of [[390,844],[430,932],[320,640],[844,430]]) {
    await page.setViewportSize({width,height})
    await page.goto(base+'/admin-app/screen-3')
    await page.locator('.admin-sheet-handle').waitFor()
    await page.waitForFunction(()=>document.querySelector('.admin-sheet-handle').textContent.includes('30'))
    const map=page.locator('.map-only-live'), toolbar=page.locator('.map-only-live .map-overlay-toolbar'), legend=page.locator('.map-only-legend'), switches=page.locator('.traffic-layer-switches'), sheet=page.locator('.admin-facility-sheet')
    const labels=await legend.boundingBox(), buttons=await switches.boundingBox()
    assert(buttons.y>=labels.y+labels.height,'Traffic switches sit below the legend without overlap')
    assert.equal(await page.getByRole('button',{name:'내 위치 찾기',exact:true}).count(),0)
    const controlToggle=page.locator('.admin-map-control-dock .map-control-toggle')
    await controlToggle.click()
    assert.equal(await page.locator('.admin-map-control-dock .kakao-map-controls').isVisible(),false)
    await controlToggle.click()
    for(const label of await legend.locator('li').all()) assert.equal(await label.evaluate(el=>getComputedStyle(el).whiteSpace),'nowrap')
    if(height>=800) {
      const mapBox=await map.boundingBox(),nav=await page.locator('.admin-app-bottom-nav').boundingBox()
      assert(nav.y-mapBox.y-mapBox.height<35,'No unused white area below the map')
    }
    await page.locator('.admin-sheet-handle').click()
    await page.waitForTimeout(280)
    const panel=await sheet.boundingBox(),bar=await toolbar.boundingBox()
    assert(panel.y>=bar.y+bar.height,'Sheet does not cover the map toolbar')
    const content=page.locator('.admin-sheet-content')
    assert(await content.evaluate(el=>el.scrollHeight>el.clientHeight),'Facility list scrolls within the sheet')
    if(width===430)await page.screenshot({path:'tests/admin-overview-sheet-preview.png'})
    await content.evaluate(el=>el.scrollTop=el.scrollHeight)
    const last=content.locator('li').last()
    await last.scrollIntoViewIfNeeded()
    assert(await last.getByRole('link').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'Last facility link is not covered')
    await page.locator('.admin-sheet-handle').click()
    await page.waitForTimeout(280)
    await page.getByRole('button',{name:'\uC9C0\uB3C4 \uD655\uB300',exact:true}).click()
    const handle=page.locator('.admin-sheet-handle')
    await handle.scrollIntoViewIfNeeded()
    const grip=await handle.boundingBox()
    await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2)
    await page.mouse.down();await page.mouse.move(grip.x+grip.width/2,grip.y-120,{steps:8});await page.mouse.up()
    assert.equal(await handle.getAttribute('aria-expanded'),'true','Drag opens the sheet')
    await handle.click()
    assert.equal(await handle.getAttribute('aria-expanded'),'false','Tap collapses the sheet after dragging')
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
    if(width===430)await page.screenshot({path:'tests/admin-overview-layout-preview.png'})
  }
  assert.deepEqual(errors,[])
  console.log('PASS admin overview: no toolbar overlap or white gap, last facility clickable, sheet drag/collapse, portrait and landscape')
} finally {await browser.close();await server.close()}
