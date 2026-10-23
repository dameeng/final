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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [],
    requests = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    const listeners = new WeakMap()
    const event = {
      addListener(target, name, fn) {
        let handlers = listeners.get(target)
        if (!handlers) listeners.set(target, (handlers = {}))
        handlers[name] = fn
      },
      removeListener() {},
    }
    class LatLng {
      constructor(lat, lng) {
        this.lat = lat
        this.lng = lng
      }
      getLat() {
        return this.lat
      }
      getLng() {
        return this.lng
      }
    }
    class MapStub {
      constructor(host, options) {
        this.host = host
        this.center = options.center
        this.level = options.level
        host.style.background = '#e6eef2'
        window.testMap = this
      }
      getCenter() {
        return this.center
      }
      setCenter(value) {
        this.center = value
      }
      panTo(value) {
        this.center = value
      }
      setLevel(value) {
        this.level = value
      }
      getLevel() {
        return this.level
      }
      setBounds() {}
      setCursor() {}
      setZoomable() {}
      relayout() {}
    }
    class LatLngBounds {
      extend() {}
    }
    class Shape {
      setMap() {}
    }
    class Polyline {
      constructor(options) {
        window.testRoute = options
        this.el = document.createElement('div')
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('width', '1200')
        svg.setAttribute('height', '1200')
        const path = document.createElementNS(svg.namespaceURI, 'path')
        path.setAttribute('d', 'M 600 600 L 700 700')
        path.setAttribute('stroke', options.strokeColor)
        svg.append(path)
        this.el.append(svg)
        options.map.host.append(this.el)
      }
      setMap(map) {
        if (!map) this.el.remove()
      }
    }
    class CustomOverlay {
      constructor(options) {
        this.el = document.createElement('div')
        this.el.innerHTML = options.content
        options.map.host.append(this.el)
      }
      setPosition() {}
      setMap(value) {
        if (!value) this.el.remove()
      }
    }
    window.kakao = {
      maps: {
        Map: MapStub,
        LatLng,
        LatLngBounds,
        Polyline,
        Marker: Shape,
        Circle: Shape,
        CustomOverlay,
        event,
      },
    }
    window.testGeo = {
      callback: null,
      error: null,
      cleared: [],
      emit(lat, lng) {
        this.callback?.({
          coords: { latitude: lat, longitude: lng, accuracy: 5, speed: 10 },
          timestamp: Date.now(),
        })
      },
    }
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        watchPosition(callback, error) {
          window.testGeo.callback = callback
          window.testGeo.error = error
          return 77
        },
        clearWatch(id) {
          window.testGeo.cleared.push(id)
        },
        getCurrentPosition(callback) {
          callback({ coords: { latitude: 35.1, longitude: 129 } })
        },
      },
    })
  })
  const guides = Array.from({ length: 12 }, (_, i) => ({
    x: 129,
    y: 35.1 + (i * 0.02) / 11,
    distance: i ? 200 : 0,
    guidance: i === 0 ? '출발' : i === 11 ? '목적지 도착' : i % 2 ? '우회전' : '직진',
    name: `Road ${i}`,
  }))
  const route = {
    result_code: 0,
    summary: { distance: 2200, duration: 1200, fare: { toll: 0 } },
    sections: [{ roads: [{ vertexes: [129, 35.1, 129, 35.11, 129, 35.12] }], guides }],
  }
  await page.route('**/api/**', (r) => {
    const u = new URL(r.request().url())
    requests.push(u)
    const data =
      u.pathname === '/api/navigation/places'
        ? [
            {
              name: u.searchParams.get('q'),
              lat: u.searchParams.get('q') === '부산역' ? 35.1 : 35.12,
              lng: 129,
            },
          ]
        : u.pathname === '/api/navigation/directions'
          ? [route, { ...route, summary: { ...route.summary, duration: 1500 } }]
          : u.pathname === '/api/navigation/weather'
            ? {
                temperature: 15,
                condition: '맑음',
                humidity: 60,
                rainfall: 0,
                observedAt: '2026-10-20T10:00:00+09:00',
              }
            : null
    return r.fulfill({ json: { success: true, data } })
  })
  await page.route('https://its.busan.go.kr/**', (r) =>
    r.fulfill({
      json: Array.from({ length: 15 }, (_, i) => ({
        cctvId: i + 1,
        instlPos: `Camera ${i + 1}`,
        instlAddr: 'Busan',
        hlsAddr: `https://video.test/${i + 1}.m3u8`,
        lat: 35.12 + i * 0.0001,
        lot: 129,
      })),
    }),
  )
  await page.route('https://video.test/**', (r) => r.fulfill({ status: 404, body: '' }))
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  await page.goto(base + '/customer-app/screen-7')
  await page.locator('.directions-form .btn.p').click()
  await page.locator('.navigation-summary').waitFor()
  await page.waitForFunction(() => !!window.testRoute)
  assert.equal(
    await page.locator('.directions-map svg').evaluate((el) => el.getBoundingClientRect().width),
    1200,
    'SDK route canvas retains its coordinate space instead of shrinking to the phone width',
  )
  assert.equal(await page.evaluate(() => window.testRoute.strokeColor), '#2878cc')
  assert.equal(await page.evaluate(() => window.testRoute.path.length), 3)
  assert.equal(await page.locator('.navigation-summary .directions-camera-list').count(), 0)
  assert.equal(await page.locator('.navigation-summary ol').count(), 0)
  assert.equal(
    await page.locator('.navigation-body').evaluate((el) => el.scrollHeight > el.clientHeight + 1),
    false,
  )
  await page.getByRole('button', { name: /구간 안내/ }).click()
  const guideDialog = page.getByRole('dialog', { name: '구간별 안내', exact: true })
  await guideDialog.waitFor()
  assert.equal(await guideDialog.locator('li').count(), 12)
  await guideDialog.locator('li button').nth(2).click()
  assert.equal(await guideDialog.isVisible(), false)
  await page.getByRole('button', { name: /주변 CCTV/ }).click()
  const cctv = page.getByRole('dialog', { name: '주변 도로 CCTV', exact: true })
  await cctv.locator('.directions-camera-list li').nth(14).waitFor()
  await cctv.getByRole('searchbox').fill('Camera 12')
  assert.equal(await cctv.locator('.directions-camera-list li').count(), 1)
  await cctv.getByRole('button', { name: 'Camera 12', exact: true }).click()
  await cctv.locator('video').waitFor()
  assert.equal(await cctv.locator('.directions-camera-list').count(), 0)
  await cctv.getByRole('button', { name: 'CCTV 창 닫기' }).click()
  assert.equal(await page.locator('video').count(), 0, 'closing CCTV releases the player')
  await page.getByRole('button', { name: '도착지 날씨', exact: true }).click()
  const weatherDialog = page.getByRole('dialog', { name: '도착지 날씨', exact: true })
  await weatherDialog.getByText('맑음 · 15°C', { exact: true }).waitFor()
  await weatherDialog.getByRole('button', { name: '날씨 창 닫기' }).click()
  await page.getByRole('button', { name: '안내 시작', exact: true }).click()
  await page.getByText('현재 위치 확인 중…', { exact: true }).waitFor()
  await page.evaluate(() => window.testGeo.emit(35.105, 129))
  await page.getByRole('button', { name: '안내 종료', exact: true }).waitFor()
  assert((await page.locator('.navigation-arrival strong').innerText()).includes('15'))
  assert.equal(
    await page.getByRole('button', { name: '현재 위치 따라가기' }).getAttribute('aria-pressed'),
    'true',
  )
  await page.evaluate(() => window.testGeo.emit(35.106, 129.02))
  await page.getByText('경로를 벗어났습니다', { exact: true }).waitFor()
  await page.getByRole('button', { name: '경로 다시 찾기', exact: true }).click()
  await page.getByRole('button', { name: '안내 시작', exact: true }).waitFor()
  assert(
    requests.some(
      (u) =>
        u.pathname === '/api/navigation/directions' &&
        u.searchParams.get('origin') === '129.02,35.106',
    ),
  )
  await page.getByRole('button', { name: '안내 시작', exact: true }).click()
  await page.evaluate(() => window.testGeo.error({ code: 1 }))
  await page.getByRole('alert').filter({ hasText: '위치 권한' }).waitFor()
  await page.getByRole('button', { name: '안내 시작', exact: true }).click()
  await page.evaluate(() => window.testGeo.emit(35.12, 129))
  await page.getByText('목적지에 도착했습니다', { exact: true }).waitFor()
  assert((await page.locator('.navigation-arrival strong').innerText()).includes('0'))
  assert((await page.evaluate(() => window.testGeo.cleared)).includes(77))
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [360, 640],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    )
    await page.getByRole('button', { name: /주변 CCTV/ }).click()
    const rect = await cctv.boundingBox()
    assert(
      rect.x >= 0 &&
        rect.y >= 0 &&
        rect.x + rect.width <= width + 1 &&
        rect.y + rect.height <= height + 1,
    )
    await page.keyboard.press('Escape')
    assert.equal(await cctv.isVisible(), false)
  }
  await page.screenshot({ path: 'tests/navigation-driving-preview.png' })
  const clearedBefore = await page.evaluate(() => window.testGeo.cleared.length)
  await page.getByRole('button', { name: '다시 안내', exact: true }).click()
  await page
    .getByRole('navigation', { name: '고객앱 메뉴' })
    .getByRole('link', { name: '내 정보', exact: true })
    .click()
  await page.waitForURL((url) => url.pathname === '/customer-app/screen-1')
  assert(
    (await page.evaluate(() => window.testGeo.cleared.length)) > clearedBefore,
    'leaving the screen stops location tracking',
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS map-first navigation, separate guide/CCTV/weather views, CCTV search/player cleanup, real-position progress, reroute, denied permission, arrival, watch cleanup and responsive dialogs',
  )
} finally {
  await browser.close()
  await server.close()
}
