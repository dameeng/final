import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    const data = path === '/api/managers/me'
      ? { id: 7, name: 'Manager', role: 'REGIONAL_ADMIN', regions: [] }
      : path === '/api/notices'
        ? { items: [{ id: 1, title: 'QA notice', authorName: 'Manager', createdAt: '2026-10-22T12:34:56.123456', viewCount: 42 }], page: 1, totalItems: 1, totalPages: 1 }
        : null
    return route.fulfill({ json: { success: true, data } })
  })
  await page.goto('http://localhost:8282/login')
  const password = page.getByRole('textbox', { name: '비밀번호', exact: true })
  const remember = page.getByLabel('아이디 저장', { exact: true })
  assert((await remember.boundingBox()).y > (await password.boundingBox()).y)
  assert((await page.getByLabel('아이디', { exact: true }).boundingBox()).width <= 360)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), '아이디')
  await page.goto('http://localhost:8282/signup')
  await page.getByRole('button', { name: 'PASS 인증' }).click()
  await page.getByLabel('휴대전화 앞자리', { exact: true }).fill('010')
  await page.getByLabel('휴대전화 가운데 자리', { exact: true }).fill('1234')
  await page.getByLabel('휴대전화 마지막 자리', { exact: true }).fill('5678')
  await page.getByRole('button', { name: 'PASS로 본인인증' }).click()
  const dialog = page.getByRole('dialog', { name: 'PASS 회원가입 본인인증' })
  await dialog.waitFor()
  const phone = dialog.getByRole('textbox', { name: '인증할 휴대전화' })
  assert.equal(await phone.inputValue(), '010-1234-5678')
  assert(await phone.evaluate(el => el.readOnly))
  await dialog.getByRole('button', { name: 'SKT', exact: true }).click()
  await dialog.getByLabel('PASS 이름').fill('테스트')
  await dialog.getByLabel('생년월일 연도').selectOption('1990')
  await dialog.getByLabel('생년월일 월', { exact: true }).selectOption('1')
  await dialog.getByLabel('생년월일 일', { exact: true }).selectOption('1')
  await dialog.getByLabel('필수 항목 전체 동의').check()
  await dialog.getByRole('button', { name: 'PASS 인증 요청' }).click()
  await dialog.getByRole('button', { name: '인증 완료 확인', exact: true }).click()
  await dialog.getByRole('button', { name: '회원가입 계속하기' }).click()
  const verifiedPhone = page.getByRole('textbox', { name: '휴대전화', exact: true })
  assert.equal(await verifiedPhone.inputValue(), '010-1234-5678')
  assert(await verifiedPhone.evaluate(el => el.readOnly))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/team-qa-auth.png', fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://localhost:8282/admin-data/notices')
  await page.getByText('QA notice', { exact: true }).waitFor()
  const headers = await page.locator('.service-table th').allTextContents()
  assert(headers.indexOf('조회수') > headers.indexOf('작성일'))
  assert(await page.getByText('2026.10.22 12:34', { exact: true }).isVisible())
  assert(await page.locator('.service-result-count').getByText('총 1건').isVisible())
  assert(!(await page.locator('.service-pagination').innerText()).includes('전체'))
  assert.deepEqual(errors, [])
  console.log('PASS login layout, first invalid field focus, web PASS demo, readonly phone, last view-count column, timestamp display and separate result count')
} finally {
  await browser.close()
}
