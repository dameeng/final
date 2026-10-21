import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
try {
  const page = await browser.newPage(),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    const d = new Date()
    localStorage.setItem(
      'routel-handover-hidden:' +
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      '1',
    )
  })
  await page.goto('http://localhost:8282/admin-profile')
  await page.getByRole('button', { name: '회원탈퇴', exact: true }).click()
  await page.locator('dialog[open]').waitFor()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await page.goto('http://localhost:8282/jurisdiction-contacts')
  await page.locator('.contact-card').first().waitFor()
  assert.equal(await page.locator('.contact-card').count(), 3)
  await page
    .locator('.contact-card')
    .first()
    .getByPlaceholder('기관·단체명')
    .fill('테스트 주민센터')
  await page.locator('.contact-card').first().getByPlaceholder('전화번호').fill('051-000-0000')
  await page.getByRole('button', { name: '연락처 저장' }).click()
  await page.reload()
  assert.equal(
    await page.locator('.contact-card').first().getByPlaceholder('기관·단체명').inputValue(),
    '테스트 주민센터',
  )
  assert.equal(
    await page
      .locator('.contact-card')
      .first()
      .getByRole('link', { name: '전화 걸기' })
      .getAttribute('href'),
    'tel:0510000000',
  )
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    )
  }
  await page.goto('http://localhost:8282/pm-equipment')
  await page.locator('#menu-btn').click()
  assert.equal(await page.getByText('운영 관리', { exact: true }).count(), 0)
  await page.getByRole('link', { name: '관할 담당자 연락처', exact: true }).click()
  await page.waitForURL('**/jurisdiction-contacts')
  await page.goto('http://localhost:8282/admin-profile')
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await page.waitForURL('**/admin-login')
  assert.deepEqual(errors, [])
  console.log(
    'PASS contacts save/reload/tel/mobile; removed operations menu; profile withdrawal dialog and logout',
  )
} finally {
  await browser.close()
}
