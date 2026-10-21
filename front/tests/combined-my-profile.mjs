import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
await server.listen()
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [],
    calls = []
  let profile = { id: 11, name: '홍고객', loginId: 'customer1', phone: '01012345678' },
    cars = [{ id: 1, carNum: '12가3456', createdAt: '2026-10-20 12:00' }]
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/**', (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname,
      method = request.method(),
      body = request.postDataJSON()
    calls.push({ path, method, body })
    let data = null
    if (path === '/api/customers/me') {
      if (method === 'PUT') profile = { ...profile, ...body }
      data = profile
    }
    if (path === '/api/customers/me/device-tokens') data = []
    if (path === '/api/customers/me/cars') {
      if (method === 'POST')
        cars.push({ id: 2, carNum: body.carNum, createdAt: '2026-10-20 12:01' })
      data = cars
    }
    if (path === '/api/customers/me/cars/2') {
      if (method === 'PUT')
        cars = cars.map((car) => (car.id === 2 ? { ...car, carNum: body.carNum } : car))
      if (method === 'DELETE') cars = cars.filter((car) => car.id !== 2)
    }
    return route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  await page.goto(base + '/my-home')
  await page.getByRole('heading', { name: '회원정보 수정', exact: true }).waitFor()
  const sidebar = page.locator('.mypage-sidebar')
  assert.equal(await sidebar.getByRole('link', { name: '내 정보', exact: true }).count(), 1)
  assert.equal(await sidebar.getByRole('link', { name: /계정 설정|내 차량/ }).count(), 0)
  for (const name of ['비밀번호 변경', '내 차량'])
    assert(await page.getByRole('heading', { name, exact: true }).isVisible())
  const settings = page.locator('#account-settings')
  await settings.getByLabel('이름', { exact: true }).fill('수정된 이름')
  await settings.getByRole('button', { name: '변경 사항 저장', exact: true }).click()
  await page
    .locator('.account-service>.service-message')
    .filter({ hasText: '기본 정보를 저장' })
    .waitFor()
  assert(
    calls.some(
      (c) => c.path === '/api/customers/me' && c.method === 'PUT' && c.body.name === '수정된 이름',
    ),
  )
  const vehicles = page.locator('#account-cars')
  await vehicles.getByRole('button', { name: '차량 등록', exact: true }).click()
  const modal = vehicles.getByRole('dialog')
  await modal.getByLabel('차량 번호', { exact: true }).fill('34나7788')
  await modal.getByRole('button', { name: '확인', exact: true }).click()
  const row = vehicles.locator('tbody tr').filter({ hasText: '34나7788' })
  await row.waitFor()
  await row.getByRole('button', { name: '수정', exact: true }).click()
  await modal.getByLabel('차량 번호', { exact: true }).fill('56다1234')
  await modal.getByRole('button', { name: '확인', exact: true }).click()
  const changed = vehicles.locator('tbody tr').filter({ hasText: '56다1234' })
  await changed.waitFor()
  await changed.getByRole('button', { name: '삭제', exact: true }).click()
  await modal.getByRole('button', { name: '확인', exact: true }).click()
  await page.waitForFunction(
    () => !document.querySelector('#account-cars tbody')?.textContent.includes('56다1234'),
  )
  for (const [oldPath, hash] of [
    ['/my-account', '#account-settings'],
    ['/my-cars', '#account-cars'],
  ]) {
    await page.goto(base + oldPath)
    await page.waitForURL((url) => url.pathname === '/my-home' && url.hash === hash)
    await page.locator(hash).waitFor()
  }
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
      `overflow ${width}`,
    )
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS single profile menu, combined sections, profile save, car create/edit/delete, old-link redirects, responsive layout',
  )
} finally {
  await browser?.close()
  await server.close()
}
