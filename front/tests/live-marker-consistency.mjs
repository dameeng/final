import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage(),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    const handlers = new WeakMap()
    const event = {
      addListener(target, type, callback) {
        const listeners = handlers.get(target) || {}
        ;(listeners[type] ??= []).push(callback)
        handlers.set(target, listeners)
      },
      removeListener() {},
    }
    const emit = (target, type, data) =>
      (handlers.get(target)?.[type] || []).forEach((fn) => fn(data))
    window.markerImages = []
    class MapStub {
      constructor(host, options) {
        this.host = host
        this.center = options.center
        this.level = options.level
      }
      setZoomable() {}
      getCenter() {
        return this.center
      }
      setCenter(value) {
        this.center = value
      }
      panTo(value) {
        this.center = value
      }
      getLevel() {
        return this.level
      }
      setLevel(value) {
        this.level = value
      }
      setBounds() {}
      relayout() {}
    }
    class Marker {
      constructor(options) {
        this.options = options
      }
      setMap() {}
    }
    class MarkerImage {
      constructor(src, size, offset) {
        this.src = src
        this.size = size
        this.offset = offset
        window.markerImages.push({ src, size, offset })
      }
    }
    class MarkerClusterer {
      constructor(options) {
        this.map = options.map
        this.styles = options.styles
        window.previewMarkerGroups = (specs) => {
          const groups = specs.map((spec) => {
            const content = document.createElement('div')
            content.textContent = String(spec.count)
            return {
              content,
              getMarkers: () => Array(spec.count).fill(this.markers[spec.index]),
              getClusterMarker: () => ({ getContent: () => content }),
            }
          })
          emit(this, 'clustered', groups)
          return groups.map((group) => group.content.outerHTML)
        }
      }
      clear() {
        this.map.host.querySelectorAll('.sdk-cluster').forEach((el) => el.remove())
      }
      addMarkers(markers) {
        this.markers = markers
        this.redraw()
      }
      redraw() {
        this.clear()
        if (!this.markers?.length) return
        const groups = [this.markers.slice(0, 3), this.markers.slice(3)]
        const clusters = groups
          .filter((group) => group.length > 1)
          .map((group) => {
            const el = document.createElement('button')
            el.className = 'sdk-cluster'
            el.textContent = String(group.length)
            Object.assign(el.style, this.styles[0], {
              position: 'absolute',
              top: '160px',
              left: group.length === 3 ? '100px' : '200px',
            })
            this.map.host.append(el)
            const cluster = {
              getMarkers: () => group,
              getCenter: () => new LatLng(35.12, 129.1),
              getClusterMarker: () => ({ getContent: () => el }),
            }
            el.onclick = () => emit(this, 'clusterclick', cluster)
            return cluster
          })
        emit(this, 'clustered', clusters)
      }
    }
    class LatLng {
      constructor(lat, lng) {
        this.lat = lat
        this.lng = lng
      }
    }
    class LatLngBounds {
      extend() {}
    }
    class Size {
      constructor(width, height) {
        this.width = width
        this.height = height
      }
    }
    class Point {
      constructor(x, y) {
        this.x = x
        this.y = y
      }
    }
    class InfoWindow {
      close() {
        this.content?.remove()
      }
      open(map) {
        if (this.content) {
          Object.assign(this.content.style, {
            position: 'absolute',
            top: '210px',
            left: '80px',
            zIndex: 20,
          })
          map.host.append(this.content)
        }
      }
      setContent(content) {
        this.content?.remove()
        this.content = content
      }
      setPosition(position) {
        window.popupPosition = position
      }
    }
    window.kakao = {
      maps: {
        Map: MapStub,
        Marker,
        MarkerImage,
        MarkerClusterer,
        LatLng,
        LatLngBounds,
        Size,
        Point,
        InfoWindow,
        event,
        load: (callback) => callback(),
      },
    }
  })
  let facilityCount = 5
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const rows = Array.from({ length: facilityCount }, (_, i) => ({
      id: i + 1,
      name: `시설 ${i + 1}`,
      regionName: '부산광역시',
      roadAddress: '부산광역시 동구',
      latitude: 35.1 + i * 0.01,
      longitude: 129.1,
      currentStatus: i === 0 ? 'BLOCKED' : 'NORMAL',
      currentRiskLevel: i === 2 ? 'DANGER' : i === 3 ? '주의' : '안전',
    }))
    return route.fulfill({
      json: {
        success: true,
        data:
          path === '/api/underpasses'
            ? { items: rows, page: 1, totalPages: 1, totalItems: facilityCount }
            : null,
      },
    })
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/c-map`)
  await page.waitForFunction(() => document.querySelectorAll('.sdk-cluster').length === 2)
  assert.equal(
    await page
      .locator('[aria-label="마커 색상 안내"]')
      .getByText('미확인', { exact: true })
      .count(),
    0,
  )
  const result = await page.evaluate(() => ({
    images: window.markerImages.map((image) => ({
      svg: decodeURIComponent(image.src.split(',')[1]),
      size: image.size,
      offset: image.offset,
    })),
    clusters: [...document.querySelectorAll('.sdk-cluster')].map((el) => ({
      count: el.textContent,
      width: el.style.width,
      height: el.style.height,
      radius: el.style.borderRadius,
      background: el.style.backgroundColor,
    })),
  }))
  assert(result.images.length >= 3)
  for (const image of result.images)
    assert(!image.svg.includes('<text'), 'single markers have no count label')
  for (const image of result.images) {
    assert(image.svg.includes('<circle'))
    assert(image.svg.includes("fill-opacity='0.48'"))
    assert(!image.svg.includes('Gradient'))
    assert(!image.svg.includes('<path'))
    assert.equal(image.size.width, 44)
    assert.equal(image.size.height, 44)
    assert.equal(image.offset.offset.x, 22)
    assert.equal(image.offset.offset.y, 22)
  }
  for (const cluster of result.clusters) {
    assert.equal(cluster.width, '44px')
    assert.equal(cluster.height, '44px')
    assert.equal(cluster.radius, '50%')
  }
  assert.equal(result.clusters[0].background, 'rgba(139, 30, 45, 0.8)')
  assert.equal(result.clusters[1].background, 'rgba(232, 185, 35, 0.64)')
  for (const width of await page
    .locator('.sdk-cluster')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).borderTopWidth)))
    assert.equal(width, '0px')
  const specs = [0, 2, 3, 1].flatMap((index) => [2, 5, 10].map((count) => ({ index, count })))
  const previews = await page.evaluate((specs) => window.previewMarkerGroups(specs), specs)
  const labels = ['통제', '위험', '주의', '안전'],
    colors = ['#8b1e2d', '#e75b36', '#e8b923', '#2eaa6b']
  const rows = labels
    .map(
      (label, i) =>
        `<div class="row"><strong>${label}</strong><div>${result.images.find((image) => image.svg.includes(colors[i])).svg}</div>${previews
          .slice(i * 3, i * 3 + 3)
          .map((marker) => `<div>${marker}</div>`)
          .join('')}</div>`,
    )
    .join('')
  const html = `<!doctype html><meta charset="utf-8"><title>ROUTEL 마커 색상 미리보기</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;font:15px Arial,sans-serif;color:#163b4b;background:#fff}h1{font-size:22px}p{font-size:13px;color:#64748b}.row{display:grid;grid-template-columns:80px repeat(4,110px);align-items:center;min-height:90px;border-bottom:1px solid #dce4e9}.row>div{display:grid;place-items:center;height:90px;background:repeating-linear-gradient(30deg,#edf3e9 0px,#edf3e9 16px,#fff 17px,#fff 20px,#eef4f7 21px,#eef4f7 38px)}.head{min-height:40px}.head>div{height:40px;background:white}.routel-marker-ripple{position:relative}</style><h1>ROUTEL 마커 색상 미리보기</h1><p>표시 예시 · 실제 시설 상태는 변경하지 않았습니다. 최대 묶음은 10곳인 경우입니다.</p><div class="row head"><strong>상태</strong><div>1곳 · 숫자 없음</div><div>2곳</div><div>5곳</div><div>10곳 · 최대</div></div>${rows}`
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/marker-colors-preview.html', html)
  const previewPage = await browser.newPage({ viewport: { width: 650, height: 560 } })
  await previewPage.setContent(html)
  await previewPage.screenshot({ path: 'test-results/marker-colors-preview.png', fullPage: true })
  await previewPage.close()
  for (const image of result.images) {
    assert(image.svg.includes("class='ripple'"))
    assert(image.svg.includes('3.8s ease-out infinite'))
    assert(image.svg.includes('prefers-reduced-motion:reduce'))
  }
  const waves = await page.locator('.sdk-cluster').evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el, '::before')
      return {
        animation: s.animationName,
        duration: s.animationDuration,
        pointer: s.pointerEvents,
        color: el.style.getPropertyValue('--marker-ripple-color'),
      }
    }),
  )
  assert.equal(waves.length, 2)
  for (const wave of waves) {
    assert.equal(wave.animation, 'routel-marker-wave')
    assert.equal(wave.duration, '3.8s')
    assert.equal(wave.pointer, 'none')
    assert(wave.color.startsWith('#'))
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(
    await page
      .locator('.sdk-cluster')
      .first()
      .evaluate((el) => getComputedStyle(el, '::before').animationName),
    'none',
  )
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.locator('.sdk-cluster').first().click()
  const popup = page.getByRole('region', { name: '묶음 지하차도 목록' })
  await popup.waitFor()
  assert.equal(await popup.locator('.routel-cluster-popup__item').count(), 3)
  assert.deepEqual(await page.evaluate(() => window.popupPosition), { lat: 35.12, lng: 129.1 })
  await popup.locator('.routel-cluster-popup__item').first().click()
  await page.locator('.swapped-detail').waitFor()
  assert.equal(await popup.count(), 0)
  await page.getByRole('button', { name: '목록으로', exact: true }).click()
  await page.getByText('묶음 시설 3곳', { exact: true }).waitFor()
  const capacity = Number(
    await page.locator('.facility-list-panel .lst').getAttribute('data-page-size'),
  )
  assert.equal(await page.locator('.facility-list-panel .it').count(), Math.min(3, capacity))
  for (const count of [7, 8]) {
    facilityCount = count
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/c-map`)
    await page.waitForFunction(() => document.querySelectorAll('.sdk-cluster').length === 2)
    const cluster = page.locator('.sdk-cluster').filter({ hasText: new RegExp(`^${count - 3}$`) })
    const color = await cluster.evaluate((el) => getComputedStyle(el).backgroundColor)
    assert.equal(color, 'rgba(232, 185, 35, 0.8)')
    const smaller = await page
      .locator('.sdk-cluster')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    assert(smaller.startsWith('rgba(139, 30, 45,'))
    assert(
      Math.abs(Number(smaller.match(/, ([\d.]+)\)$/)[1]) - (count === 7 ? 0.693 : 0.64)) < 0.005,
    )
    if (count === 8) {
      await cluster.click()
      await page.getByText('묶음 시설 5곳', { exact: true }).waitFor()
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  facilityCount = 12
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/customer-app/screen-5`)
  await page.locator('.mobile-app-map .app-map-sheet').waitFor()
  assert.equal(await page.locator('.customer-app-nav').count(), 1)
  assert.equal(await page.locator('.app-restored-header').count(), 1)
  const shell = await page.locator('.service-app-layout').boundingBox(),
    mapBox = await page.locator('.mobile-app-map .mapw').boundingBox()
  assert(shell.width <= 430 && Math.abs(shell.height - 900) < 2)
  assert(mapBox.height > 650, 'app map fills the available height')
  const handle = page.locator('.mobile-sheet-handle')
  assert.equal(await handle.getAttribute('aria-expanded'), 'false')
  assert(Math.abs((await page.locator('.app-map-sheet').boundingBox()).height - 68) < 2)
  await page.locator('.sdk-cluster').first().click()
  await page.locator('.routel-cluster-popup').waitFor()
  assert.equal(
    await handle.getAttribute('aria-expanded'),
    'false',
    'cluster popup does not cover the map with the app sheet',
  )
  await page.getByRole('button', { name: '묶음 목록 닫기', exact: true }).click()
  assert.equal(await page.locator('.routel-cluster-popup').count(), 0)
  await handle.click()
  assert.equal(await handle.getAttribute('aria-expanded'), 'true')
  await page
    .locator('.cluster-list-heading')
    .getByRole('button', { name: '전체 목록으로', exact: true })
    .click()
  assert.equal(await page.locator('.facility-list-panel .lst').getAttribute('data-page-size'), '5')
  assert.equal(await page.locator('.facility-list-panel .it').count(), 12)
  assert.equal(await page.locator('.customer-list-pagination').count(), 0)
  assert.notEqual(
    await page.locator('.app-map-sheet').evaluate((el) => getComputedStyle(el).backgroundColor),
    'rgba(0, 0, 0, 0)',
  )
  await page.locator('.facility-list-panel .it').first().click()
  await page.locator('.swapped-detail .nm').waitFor()
  await page.getByRole('button', { name: '목록으로', exact: true }).click()
  await handle.click()
  const rect = await handle.boundingBox()
  await page.mouse.move(rect.x + 50, rect.y + 30)
  await page.mouse.down()
  await page.mouse.move(rect.x + 50, rect.y - 150, { steps: 8 })
  await page.mouse.up()
  assert.equal(await handle.getAttribute('aria-expanded'), 'true', 'sheet opens by dragging')
  await page.waitForTimeout(300)
  const sheetBox = await page.locator('.app-map-sheet').boundingBox()
  assert(
    Math.abs(sheetBox.y + sheetBox.height - mapBox.y - mapBox.height) < 2,
    'sheet stays against the bottom of the map',
  )
  assert(sheetBox.height <= mapBox.height * 0.89, 'expanded sheet leaves the upper map visible')
  await page.screenshot({ path: 'tests/app-map-restored.png' })
  await page.setViewportSize({ width: 390, height: 700 })
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
  )
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/customer-app/screen-6?id=1`)
  await page.locator('.mobile-app-detail .swapped-detail .nm').waitFor()
  assert.equal(await page.locator('.customer-app-nav').count(), 1)
  await page.getByRole('button', { name: /현재 CCTV 보기/ }).waitFor()
  assert.deepEqual(errors, [])
  console.log(
    'PASS single/cluster circles share size and anchor; cluster color follows highest risk; cluster selection still works',
  )
} finally {
  await browser?.close()
  await server.close()
}
