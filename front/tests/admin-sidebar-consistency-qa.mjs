import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({
  configLoader: 'runner',
  server: { port: 0, strictPort: false },
})
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/**', (r) => {
    const path = new URL(r.request().url()).pathname
    let data = []
    if (path === '/api/customers/me') data = null
    if (path === '/api/managers/me')
      data = {
        id: 1,
        name: '관리자',
        role: 'REGIONAL_ADMIN',
        regions: [{ id: 1, name: '부산광역시' }],
      }
    if (path === '/api/underpasses' || path === '/api/notices')
      data = { items: [], page: 1, totalItems: 0, totalPages: 0 }
    return r.fulfill({ json: { success: true, data } })
  })
  let baseline
  for (const path of [
    '/fac-list',
    '/pm-equipment',
    '/pm-queue',
    '/pm-history',
    '/bot-stats',
    '/admin-data/faqs',
  ]) {
    await page.goto(server.resolvedUrls.local[0] + path.slice(1))
    await page.locator('#menu-btn,button[aria-label="관리자 메뉴 열기"]').first().waitFor()
    const button = page.locator('#menu-btn')
    if (await button.count()) await button.click()
    else await page.getByRole('button', { name: '관리자 메뉴 열기' }).click()
    const side = page.locator('aside.side')
    await side.waitFor({ state: 'visible' })
    const data = await side.evaluate((el) => {
      const outer = el.getBoundingClientRect(),
        rect = (selector) => {
          const r = el.querySelector(selector).getBoundingClientRect()
          return { x: r.x - outer.x, y: r.y - outer.y, width: r.width, height: r.height }
        }
      return {
        links: [...el.querySelectorAll('.admin-sidebar-groups a')].map((a) => [
          a.textContent.trim(),
          a.getAttribute('href'),
        ]),
        groups: [...el.querySelectorAll('.sidebar-group-label')].map((e) => e.textContent),
        width: outer.width,
        head: rect('.side-top'),
        identity: rect('.side-user'),
        home: rect('.sidebar-home'),
      }
    })
    if (!baseline) baseline = data
    else {
      assert.deepEqual(data.links, baseline.links, path + ' links')
      assert.deepEqual(data.groups, baseline.groups, path + ' groups')
      assert.equal(data.width, baseline.width, path + ' width')
      for (const key of ['head', 'identity', 'home'])
        for (const field of ['x', 'y', 'width', 'height'])
          assert(
            Math.abs(data[key][field] - baseline[key][field]) < 2,
            path +
              ' ' +
              key +
              ' ' +
              field +
              ' ' +
              JSON.stringify({ actual: data[key], expected: baseline[key] }),
          )
    }
    if (path.startsWith('/pm-'))
      assert.equal(
        await side.locator('a[aria-current=page]').innerText(),
        {
          '/pm-equipment': '장비 현황',
          '/pm-queue': '점검 대기',
          '/pm-history': '정비 이력',
          '/pm-settings': '예지보전 기준 설정',
        }[path],
      )
    await side
      .getByRole('link', { name: '관할 담당자 연락처', exact: true, includeHidden: true })
      .waitFor({ state: 'attached' })
    await side.getByRole('button', { name: '닫기', exact: true }).click()
    assert.equal(await side.isVisible(), false)
    console.log('PASS identical sidebar', path)
  }
  await page.goto(server.resolvedUrls.local[0] + 'pm-settings')
  await page.waitForURL('**/pm-equipment')
  assert.equal(await page.locator('a[href="/pm-settings"]').count(), 0)
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
  await server.close()
}
