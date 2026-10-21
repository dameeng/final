import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage()
  await page.addInitScript(() => { window.EventSource = class extends EventTarget { close() {} } })
  await page.route('**/api/**', (r) => r.fulfill({ json: { success: true, data: null } }))
  await page.route('https://its.busan.go.kr/**', (r) => r.fulfill({ json: [{ cctvId: 1, instlPos: 'Camera', instlAddr: 'Busan road address', hlsAddr: 'https://video.test/live.m3u8', lat: 35.17, lot: 129.07 }] }))
  await page.route('https://video.test/**', (r) => r.fulfill({ status: 404, body: '' }))
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/login`)
  for (const [route, width, height] of [
    ['/customer-app/screen-5', 1280, 900],
    ['/admin-app/screen-3', 1280, 900],
    ['/customer-app/screen-5', 390, 844],
    ['/admin-app/screen-3', 360, 280],
    ['/c-map', 1280, 900],
  ]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(async (path) => {
      window.cctvTest?.unmount()
      const { createApp, h, ref, nextTick } = await import('/node_modules/.vite/deps/vue.js')
      const { createRouter, createMemoryHistory } = await import(performance.getEntriesByType('resource').find((entry) => entry.name.includes('/vue-router.js?')).name)
      const { default: Modal } = await import('/src/components/BusanCctvModal.vue')
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path, component: { render: () => null } }] })
      await router.push(path)
      const opened = ref(false), host = document.createElement('div')
      document.body.append(host)
      window.cctvTest = createApp({ render: () => h(Modal, { modelValue: opened.value, 'onUpdate:modelValue': (value) => { opened.value = value }, facilityName: 'Facility', lat: 35.17, lng: 129.07 }) }).use(router)
      window.cctvTest.mount(host)
      await nextTick()
      opened.value = true
    }, route)
    const modal = page.locator('.busan-cctv-modal[open]')
    await modal.locator('video').waitFor()
    const box = await modal.boundingBox()
    assert.equal(box.width, route.includes('-app/') ? Math.min(430, width - 24) : 660)
    assert(box.x >= 0 && box.x + box.width <= width)
    assert(box.y >= 0 && box.y + box.height <= height)
    const video = await modal.locator('video').boundingBox()
    assert(video.width <= box.width - 32 && video.x >= box.x)
    assert.equal(await modal.locator('video').count(), 1)
    if (height === 280) assert(await modal.evaluate((el) => el.scrollHeight > el.clientHeight),JSON.stringify(await modal.evaluate((el)=>({scroll:el.scrollHeight,client:el.clientHeight,display:getComputedStyle(el).display,html:el.innerText,children:[...el.children].map(c=>({tag:c.tagName,height:c.getBoundingClientRect().height,flex:getComputedStyle(c).flex}))}))))
    await modal.getByRole('button', { name: '확인', exact: true }).click()
    assert.equal(await modal.locator('video').count(), 0)
  }
  console.log('PASS CCTV modal follows 430px app frame on desktop, fits phone/landscape viewport, scrolls and releases playback; web width preserved')
} finally {
  await browser.close()
  await server.close()
}
