import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'

const origin = process.env.TUNNEL_QA_ORIGIN || 'http://127.0.0.1:8295'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage(), writes = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('routel-session-kind', 'manager'))
  await page.route(origin + '/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes.push(path)
    const facility = { id: 1, name: '부산 시설', regionId: 1, regionName: '부산광역시', manageable: true, currentRiskLevel: 'SAFE', currentStatus: 'NORMAL' }
    let data = []
    if (path === '/api/managers/me') data = { id: 7, name: '검증 관리자', role: 'REGIONAL_ADMIN', regions: [{ id: 1, name: '부산광역시' }] }
    if (path === '/api/underpasses') data = { items: [facility], page: 1, size: 10, totalItems: 1, totalPages: 1 }
    if (path === '/api/underpasses/1') data = facility
    return route.fulfill({ json: { success: true, data } })
  })
  await page.route(origin + '/tunnel-source/*', route => route.fulfill({ json: { list: [] } }))
  await page.goto(origin + '/admin-data/facilities?id=1', { waitUntil: 'domcontentloaded' })
  const modal = page.locator('dialog.service-modal[open]')
  await modal.waitFor()
  assert.equal(await modal.getByRole('button', { name: '수정', exact: true }).count(), 1)
  assert.equal(await modal.getByRole('button', { name: '삭제', exact: true }).count(), 1)
  // The current product only authenticates REGIONAL_ADMIN. Model canWrite=false
  // in this isolated browser store without changing actual sessions or APIs.
  await page.evaluate(() => {
    const app = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app')
    app.account = { ...app.account, role: 'READ_ONLY_TEST' }
  })
  await modal.getByRole('button', { name: '수정', exact: true }).waitFor({ state: 'hidden' })
  assert.equal(await modal.getByRole('button', { name: '삭제', exact: true }).count(), 0)
  assert.equal(await modal.getByRole('button', { name: '내부 CCTV 보기', exact: true }).count(), 1)
  assert.equal(await modal.getByRole('link', { name: '시설 CCTV 보기', exact: true }).count(), 1)
  await modal.getByRole('button', { name: '내부 CCTV 보기', exact: true }).click()
  const videoModal = page.locator('dialog.tunnel-cctv-modal[open]')
  await videoModal.getByRole('heading', { name: '신월여의지하도로 CCTV', exact: true }).waitFor()
  await videoModal.getByRole('button', { name: '내부 CCTV 창 닫기', exact: true }).click()
  assert.equal(await modal.count(), 1, 'closing public CCTV returns to the facility detail')
  assert.deepEqual(writes, [], 'no backend mutations occurred')
  assert.deepEqual(errors, [])
  console.log('PASS read-only UI state: CCTV entry retained, edit/delete hidden, nested public viewer opens and closes, no backend writes')
} finally {
  await browser.close()
}
