import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const server = process.env.TUNNEL_QA_ORIGIN ? null : await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false, watch: null } })
await server?.listen()
const origin = process.env.TUNNEL_QA_ORIGIN || `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage(), errors = [], requests = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('routel-session-kind', 'manager'))
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    let data = []
    if (path === '/api/managers/me') data = { id: 7, name: '관리자', role: 'REGIONAL_ADMIN', regions: [{ id: 1, name: '부산광역시' }] }
    if (path === '/api/underpasses/1') data = { id: 1, name: '부산 시설', currentRiskLevel: 'SAFE', currentStatus: 'NORMAL' }
    if (path.endsWith('/cameras')) data = [{ id: 61, underpassId: 1, cameraRole: 'CCTV' }, { id: 62, underpassId: 99, cameraRole: 'CCTV' }]
    return route.fulfill({ json: { success: true, data } })
  })
  let failList = false, failDetail = false
  await page.route('**/tunnel-source/*', async route => {
    requests.push({ path: new URL(route.request().url()).pathname, body: route.request().postData(), method: route.request().method() })
    if (route.request().url().endsWith('/getCctv-data.do'))
      return route.fulfill(failList ? { status: 503, json: {} } : { json: { list: [{ CCTV_ID: 'T1' }, { CCTV_ID: 'T2' }, { CCTV_ID: 'T1' }] } })
    const id = new URLSearchParams(route.request().postData()).get('cctvId')
    if (id === 'T1') await new Promise(resolve => setTimeout(resolve, 200))
    return route.fulfill(failDetail ? { status: 502, json: {} } : { json: { info: { CCTV_ID: id, CCTV_NM: '공개 CCTV ' + id, DRC: '여의도방향', STREAMING2_ADRES: `https://www.seoultunnel.co.kr/test/${id}.m3u8` } } })
  })
  await page.route('https://www.seoultunnel.co.kr/test/**', route => route.fulfill({ status: 404, body: '' }))

  for (const [path, width] of [['/fac-detail?id=1', 1440], ['/admin-app/screen-5?id=1', 390]]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(origin + (process.env.TUNNEL_QA_FIXTURE ? '/tests/tunnel-cctv-fixture.html' : path), { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.getByRole('button', { name: '내부 CCTV 보기', exact: true }).click()
    const modal = page.locator('dialog.tunnel-cctv-modal[open]')
    await modal.getByRole('heading', { name: '신월여의지하도로 CCTV', exact: true }).waitFor()
    await modal.getByText(/현재 선택한 부산 시설/).waitFor()
    const select = modal.getByRole('combobox')
    await select.locator('option').first().waitFor({ state: 'attached' })
    assert.equal(await select.locator('option').count(), 2, 'duplicate source IDs are removed')
    await select.selectOption('T2')
    await modal.getByRole('heading', { name: /공개 CCTV T2/ }).waitFor()
    assert.equal(await modal.locator('video').count(), 1, 'only selected external video is mounted')
    await page.waitForTimeout(350)
    assert.equal(await modal.getByRole('heading', { name: /공개 CCTV T1/ }).count(), 0, 'older response cannot replace the selected stream')
    assert.equal(await modal.locator('a[target="_blank"]').getAttribute('href'), 'https://seoultunnel.co.kr/usage/traffic.do')
    assert.equal(await modal.evaluate(node => node.scrollWidth > node.clientWidth), false)
    await page.evaluate(() => { window.oldTunnelVideo = document.querySelector('.tunnel-cctv-modal video') })
    await modal.getByRole('button', { name: '내부 CCTV 창 닫기' }).click()
    await page.waitForFunction(() => !window.oldTunnelVideo?.getAttribute('src'))
    assert.equal(await page.locator('.tunnel-cctv-modal video').count(), 0, 'closing releases the external stream')
    if (!process.env.TUNNEL_QA_FIXTURE) {
      if (path.startsWith('/fac-detail')) await page.getByRole('link', { name: '시설 CCTV 보기', exact: true }).click()
      await page.locator('.facility-cctv-viewer').waitFor()
      assert.equal(await page.locator('.facility-camera-buttons [aria-pressed=true]').getAttribute('data-camera-id'), '61', 'the original facility CCTV stays separate')
      assert.equal(await page.locator('.facility-camera-buttons button').count(), 1, 'cameras belonging to another facility cannot be selected')
    }
  }

  failList = true
  await page.getByRole('button', { name: '내부 CCTV 보기', exact: true }).click()
  let modal = page.locator('dialog.tunnel-cctv-modal[open]')
  await modal.getByRole('alert').waitFor()
  assert.equal(await modal.locator('video').count(), 0)
  assert.equal(await modal.getByRole('link', { name: /공식 사이트/ }).count(), 1)
  failList = false
  await modal.getByRole('button', { name: '다시 연결', exact: true }).click()
  await modal.locator('video').waitFor()
  failDetail = true
  await modal.getByRole('combobox').selectOption('T2')
  await modal.getByRole('alert').waitFor()
  assert.equal(await modal.locator('video').count(), 0, 'failed next camera cannot leave the previous image visible')
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('dialog.tunnel-cctv-modal[open]').count(), 0)
  assert(requests.every(request => request.method === 'POST'))
  assert(requests.some(request => request.body === 'lvl=1'))
  assert.deepEqual(errors, [])
  console.log('PASS tunnel CCTV web/app: official source labels, selected-channel race safety, close cleanup, error/retry/fallback, responsive bounds')
} finally {
  await browser.close()
  await server?.close()
}
