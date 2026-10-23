import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import assert from 'node:assert/strict'

// Exercise the real component/store against controlled REST and shared SSE
// events. The fixture does not start the app's unrelated network services.
const fixture = `
import { createApp, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import CustomerArrivalAlert from '/src/components/CustomerArrivalAlert.vue'
import { useApp } from '/src/stores/app.ts'
import { useCustomerNotifications } from '/src/stores/customerNotifications.ts'
import '/src/styles/overlay-polish.css'
import '/src/styles/interface-motion.css'
const pinia = createPinia(); setActivePinia(pinia)
const app = useApp(); app.account = { id: 'customer-a', name: 'Fixture', role: 'customer' }
const notifications = useCustomerNotifications()
const router = createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]})
await router.push('/customer-app/notices'); await router.isReady()
createApp({render:()=>h('main',[h('button',{id:'source'},'Open account'),h(CustomerArrivalAlert)])}).use(pinia).use(router).mount('#app')
window.fixture = { app, notifications, router,
  emit(data) { window.dispatchEvent(new CustomEvent('routel-backend-event',{detail:{name:'notification-new',data}})) }
}
`
const server = await createServer({
  configFile: false,
  cacheDir: 'node_modules/.vite-arrival-alert-qa',
  optimizeDeps: { entries: [], include: ['vue', 'pinia', 'vue-router'] },
  server: { host: '127.0.0.1', port: 0, strictPort: false, watch: null },
  plugins: [vue(), {
    name: 'customer-arrival-fixture',
    resolveId(id) { if (id === '/__arrival-fixture-entry.js') return '\0arrival-fixture' },
    load(id) { if (id === '\0arrival-fixture') return fixture },
    configureServer(server) {
      server.middlewares.use('/__arrival-fixture', (_req, res) => {
        res.setHeader('Content-Type', 'text/html')
        res.end(`<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
          :root { --r-surface:white;--r-ink:#172d48;--r-muted:#63748a;--r-line:#dbe3ed;--r-font:Arial,sans-serif }
          :root[data-theme=dark] { --r-surface:#18283a;--r-ink:#e7f0fa;--r-muted:#a6b8ca;--r-line:#405165 }
          body {margin:0;font-family:Arial,sans-serif} #source {margin:20px}
        </style></head><body><div id="app"></div><script type="module" src="/__arrival-fixture-entry.js"></script></body></html>`)
      })
    },
  }],
})
await server.listen()
console.log('Arrival alert fixture server is ready')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const checks = []
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(60000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  let rows = [{ id: 1, category: 'NOTICE', title: 'Existing notice', body: 'Historical content', read: false, createdAt: '2025-01-01T10:00:00+09:00' }]
  let readCalls = [], listCalls = 0, holdList = null, failRead = false
  await page.addInitScript(() => {
    window.osNotifications = []
    window.Notification = class {
      static permission = 'granted'
      constructor(title, options) { window.osNotifications.push({ title, ...options }) }
      close() {}
    }
    window.arrivalIntervals = new Set()
    const originalSetInterval = window.setInterval.bind(window)
    const originalClearInterval = window.clearInterval.bind(window)
    window.setInterval = (callback, delay, ...args) => {
      const id = originalSetInterval(callback, delay, ...args)
      if (delay === 30000 && String(callback).includes('visibilityState')) window.arrivalIntervals.add(id)
      return id
    }
    window.clearInterval = id => { window.arrivalIntervals.delete(id); originalClearInterval(id) }
  })
  await page.route('**/api/customers/me/notifications**', async route => {
    const path = new URL(route.request().url()).pathname
    let data
    if (route.request().method() === 'PUT') {
      const id = Number(path.match(/\/(\d+)\/read$/)?.[1])
      if (failRead) return route.fulfill({ status: 503, json: { success: false, message: 'Read temporarily unavailable' } })
      readCalls.push(id)
      rows = rows.map(row => id === row.id || path.endsWith('read-all') ? { ...row, read: true } : row)
      data = null
    } else if (path.endsWith('/unread-count')) data = { total: rows.filter(r => !r.read).length, byCategory: { NOTICE: 1 } }
    else {
      listCalls++
      if (holdList) await holdList
      data = { items: rows.slice(0, 5), page: 1, size: 5, totalPages: 1, totalItems: rows.length }
    }
    await route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  const alert = page.locator('dialog.customer-arrival-alert')
  const ready = () => page.waitForFunction(() => window.fixture && !window.fixture.notifications.loading)
  const incoming = (id, changes = {}) => ({
    id, category: 'RISK', title: 'New safety update ' + id, body: 'Actual received safety information.', read: false,
    createdAt: new Date(Date.now() + 1000 + id).toISOString(), unread: { total: 2, byCategory: { RISK: 1, NOTICE: 1 } }, ...changes,
  })
  const emit = async row => { rows = [row, ...rows.filter(item => item.id !== row.id)]; await page.evaluate(row => window.fixture.emit(row), row) }
  const waitOpen = title => page.waitForFunction(title => document.querySelector('dialog.customer-arrival-alert[open] h2')?.textContent === title, title)
  const waitClosed = () => page.waitForFunction(() => !document.querySelector('dialog.customer-arrival-alert')?.open)

  await page.goto(base + '/__arrival-fixture')
  await ready()
  console.log('Arrival alert baseline is ready')
  assert.equal(await alert.getAttribute('open'), null)
  assert.equal(await page.evaluate(() => window.arrivalIntervals.size), 1)
  assert.equal(await page.evaluate(() => window.fixture.app.unread), 1)
  checks.push('initial unread history stays in the bell without a popup')

  await page.locator('#source').focus()
  await page.evaluate(() => window.fixture.notifications.setBrowserEnabled(true))
  const first = incoming(101, { severity: 'DANGER' })
  await emit(first)
  await waitOpen(first.title)
  assert.equal(await alert.getAttribute('role'), 'alertdialog')
  assert.equal(await alert.getAttribute('data-tone'), 'danger')
  assert.equal(await alert.evaluate(el => getComputedStyle(el).borderTopWidth), '5px')
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'customer-arrival-title')
  await page.evaluate(row => window.fixture.emit(row), first)
  assert.equal(await page.evaluate(() => window.fixture.notifications.appArrivals.length), 1)
  assert.equal(await page.evaluate(() => window.osNotifications.length), 1)
  assert.equal(readCalls.length, 0)
  await page.keyboard.press('Tab')
  assert(await page.evaluate(() => document.activeElement?.closest('dialog') !== null))
  checks.push('new SSE safety message, actual severity, focus, OS permission flow and duplicate suppression')
  console.log('Arrival alert SSE and accessibility checks passed')

  const ordinary = incoming(102, { category: 'NOTICE', title: 'Routine service notice' })
  await emit(ordinary)
  assert.equal(await alert.locator('h2').textContent(), first.title)
  failRead = true
  await alert.locator('.arrival-confirm').click()
  await alert.locator('.arrival-error').waitFor()
  assert.equal(await alert.locator('h2').textContent(), first.title)
  failRead = false
  await alert.locator('.arrival-confirm').click()
  await waitOpen(ordinary.title)
  await ready()
  assert.deepEqual(readCalls, [101])
  assert.equal(await alert.getAttribute('data-tone'), 'info')
  assert.equal(await page.evaluate(() => window.fixture.app.unread), 2)
  await page.keyboard.press('Escape')
  await waitClosed()
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'source')
  assert.equal(rows.find(row => row.id === 102).read, false)
  checks.push('FIFO queue, read failure recovery, acknowledge current only, routine tone, Escape leaves unread and restores focus')

  await page.evaluate(async () => {
    window.fixture.notifications.reset()
    await window.fixture.router.push('/customer-app/profile')
    window.fixture.emit(window.fixture.notifications.recent.find(row => row.id === 102))
  })
  await waitClosed()
  assert.equal(await page.evaluate(() => window.arrivalIntervals.size), 1)
  await emit(incoming(103, { createdAt: '2024-01-01T10:00:00+09:00' }))
  await waitClosed()
  const polled = incoming(104, { title: 'Received by polling' })
  rows.unshift(polled)
  await page.evaluate(() => window.fixture.notifications.refresh())
  await waitOpen(polled.title)
  await alert.locator('.arrival-details').click()
  await waitClosed()
  assert.equal(await page.evaluate(() => window.fixture.router.currentRoute.value.fullPath), '/customer-app/screen-12?notification=104')
  checks.push('same-account reset/navigation dedup, historical replay suppression, REST fallback and existing detail route')
  console.log('Arrival alert read/navigation checks passed')

  await page.evaluate(() => window.fixture.router.push('/c-notice'))
  const outsideCalls = listCalls
  assert.equal(await page.evaluate(() => window.arrivalIntervals.size), 0)
  await page.evaluate(row => window.fixture.emit(row), incoming(105))
  assert.equal(await page.evaluate(() => window.fixture.notifications.appArrivals.length), 0)
  assert.equal(listCalls, outsideCalls)
  checks.push('outside customer app: no event subscription or polling interval')

  rows = [rows[0]]
  await page.evaluate(() => window.fixture.router.push('/customer-app/notices'))
  await ready()
  await emit(incoming(106))
  await waitOpen('New safety update 106')
  await page.evaluate(() => window.fixture.app.clearAccount())
  await waitClosed()
  assert.equal(await page.evaluate(() => window.fixture.notifications.recent.length), 0)
  assert.equal(await page.evaluate(() => window.fixture.app.unread), 0)
  assert.equal(await page.evaluate(() => window.arrivalIntervals.size), 0)
  rows = [{ id: 2, category: 'NOTICE', title: 'Other account baseline', body: 'Private', read: false, createdAt: '2025-02-01T10:00:00+09:00' }]
  await page.evaluate(() => { window.fixture.app.account = { id: 'customer-b', name: 'Other', role: 'customer' } })
  await ready()
  await waitClosed()
  assert.equal(await page.evaluate(() => window.fixture.notifications.browserEnabled), false)
  assert.equal(await page.evaluate(() => window.fixture.app.unread), 1)
  const long = incoming(101, { title: 'Other account new safety update', body: '긴 안전 안내 내용을 확인해 주세요. '.repeat(80) })
  await page.setViewportSize({ width: 320, height: 640 })
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await emit(long)
  await waitOpen(long.title)
  assert.equal(await alert.evaluate(el => getComputedStyle(el).animationName), 'none')
  const geometry = await alert.evaluate(el => {
    const box = el.getBoundingClientRect(), button = el.querySelector('.arrival-confirm').getBoundingClientRect()
    return { left: box.left, right: box.right, bottom: box.bottom, buttonBottom: button.bottom, overflows: el.scrollWidth > el.clientWidth, accent: getComputedStyle(el).getPropertyValue('--arrival-accent').trim() }
  })
  assert(geometry.left >= 0 && geometry.right <= 320 && geometry.bottom <= 640)
  assert(geometry.buttonBottom <= geometry.bottom)
  assert.equal(geometry.overflows, false)
  assert.equal(geometry.accent, '#f2c879')
  checks.push('logout clears queue/unread/interval, different account isolated, 320px long content, dark theme and reduced motion')
  await alert.locator('.arrival-close').click()

  // Race: two new events arrive before the first valid REST baseline. Both
  // must survive, even when the snapshot already includes the later event.
  await page.evaluate(() => window.fixture.router.push('/c-notice'))
  let release
  holdList = new Promise(resolve => { release = resolve })
  await page.evaluate(() => window.fixture.router.push('/customer-app/notices'))
  await page.waitForFunction(() => window.fixture.notifications.loading)
  const raceA = incoming(201), raceB = incoming(202)
  await emit(raceA); await emit(raceB)
  await waitClosed()
  holdList = null; release()
  await ready()
  await waitOpen(raceA.title)
  assert.deepEqual(await page.evaluate(() => window.fixture.notifications.appArrivals.map(row => row.id)), [201, 202])
  checks.push('initial REST/SSE race preserves both actual new arrivals without replaying history')

  assert.deepEqual(errors, [])
  console.log(`PASS ${checks.length} customer arrival alert scenarios\n- ${checks.join('\n- ')}`)
} finally {
  await browser.close()
  await server.close()
}
