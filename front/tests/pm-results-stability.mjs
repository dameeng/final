import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    let data = []
    if (path === '/api/managers/me') data = { id: 1, name: '관리자', role: 'REGIONAL_ADMIN', regions: [] }
    else if (path === '/api/customers/me') data = null
    else if (path === '/api/pm/engine-status') data = { status: 'OK', lastReceivedAt: '2026-10-27T12:38:00', sensorStale: 0 }
    else if (/^\/api\/pm\/(equipments|events|actions)$/.test(path)) {
      const count = url.searchParams.get('type') === 'PUMP' ? 0 : url.searchParams.get('type') === 'CCTV' ? 1 : 10
      data = { items: Array.from({ length: count }, (_, i) => ({
        equipId: i + 1, eventId: i + 1, actionId: i + 1, name: 'C-' + (i + 1), type: 'CCTV',
        underpassName: '초량지하차도', score: 82, currentScore:34, level: 'DANGER', eventLevel: 'DANGER',
        scoreBefore: 82, scoreAfter: 40, scoreChange7d: 3, lastReceivedAt: '2026-10-27T12:38:00',
        createdAt: '2026-10-27T12:38:00', reasons: ['패킷 손실률이 평소보다 높아요'],
        content: '긴 점검 기록 '.repeat(100), managerName: '관리자', sparkline: [30, 40, 82],
        status: 'CHECK_NEEDED', triggerType: 'DANGER_ENTRY', openEventId: 1, openEventStatus: 'CHECK_NEEDED',
      })), page: 1, size: 10, totalItems: count, totalPages: 1 }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    await route.fulfill({ json: { success: true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  const geometry = () => page.evaluate(() => {
    const rect = selector => {
      const box = document.querySelector(selector).getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }
    return { scroll: scrollY, heading: rect('.service-heading'), filter: rect('.pm-filters,.pm-filter-card'), results: rect('.pm-results-viewport'), pager: rect('.pm-pager') }
  })
  for (const path of ['/pm-equipment', '/pm-queue', '/pm-history']) {
    await page.goto(base + path)
    const viewport = page.locator('.pm-results-viewport')
    await expect(viewport).toHaveAttribute('aria-busy', 'false')
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()))
    const baseline = await geometry()
    const checkGeometry = async message => {
      const current=await geometry()
      {
        assert.deepEqual(current.heading,baseline.heading,message+' heading')
        assert.deepEqual(current.filter,baseline.filter,message+' filters')
        assert.equal(await viewport.evaluate(el=>getComputedStyle(el).overflowY),'visible','Paginated results grow with their rows instead of scrolling internally')
        assert(await viewport.evaluate(el=>el.scrollHeight<=el.clientHeight+1),'All result rows fit without vertical scrolling')
      }
    }
    const type = page.locator('.pm-type select,.pm-filter-card .pm-select select').first()
    for (const [value, count] of [['CCTV', 1], ['PUMP', 0], ['', 10]]) {
      await type.selectOption(value)
      await expect(viewport).toHaveAttribute('aria-busy', 'true')
      await checkGeometry(path + ' stable while loading')
      await expect(viewport).toHaveAttribute('aria-busy', 'false')
      await expect(viewport.locator('tbody tr')).toHaveCount(count)
      await checkGeometry(path + ' stable with ' + count + ' rows')
    }
    const refresh = page.getByRole('button', { name: '새로고침', exact: true })
    await refresh.click()
    await expect(viewport).toHaveAttribute('aria-busy', 'false')
    await checkGeometry(path + ' stable after refresh')
    await page.setViewportSize({ width: 390, height: 844 })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path + ' no mobile overflow')
    await page.setViewportSize({ width: 1440, height: 900 })
    console.log('PASS fixed controls/results/pager with 10/1/0 rows, loading, refresh, long content and mobile', path)
  }
  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 844 })
    for (const path of ['/admin-app/screen-9', '/admin-app/screen-11', '/admin-app/history']) {
      await page.goto(base + path)
      await expect(page.locator('.pm-results-viewport')).toHaveAttribute('aria-busy', 'false')
      await expect(page.locator('.pm-equipment-card')).toHaveCount(10)
      await expect(page.getByRole('button', { name: '새로고침', exact: true })).toHaveCount(0)
      await expect(page.locator('.pm-results-viewport table')).toHaveCount(0)
      await expect(page.locator('.pm-equipment-card').first()).toHaveAttribute('href', '/admin-app/screen-10?id=1')
      if (path.endsWith('screen-11')) {
        await expect(page.locator('.pm-filters .tabs button')).toHaveCount(3)
        await expect(page.locator('.pm-filters .tabs')).not.toContainText('확인 필요')
        await expect(page.locator('.pm-filters .tabs')).not.toContainText('점검 중')
        await expect(page.locator('.pm-equipment-card').first().locator('.pm-inspection-state')).toHaveText('확인 필요')
        await expect(page.locator('.pm-equipment-card').first().locator('.pm-equipment-card-score')).toContainText('34.0')
        await expect(page.locator('.pm-equipment-card').first().locator('.pm-equipment-card-score')).toHaveAttribute('aria-label','현재 위험 점수 34.0점')
        await expect(page.locator('.pm-results-viewport button')).toHaveCount(0)
      }
      const overlapping = await page.locator('.pm-equipment-cards').evaluate(list => {
        const problems = [], rows = [...list.querySelectorAll('.pm-equipment-card')]
        for (let index = 0; index < rows.length; index++) {
          const row = rows[index], box = row.getBoundingClientRect()
          if (index && box.top < rows[index - 1].getBoundingClientRect().bottom) problems.push('overlapping cards')
          for (const child of row.children) {
            const rect = child.getBoundingClientRect()
            if (rect.top < box.top || rect.bottom > box.bottom || rect.right > box.right) problems.push('content outside card')
          }
        }
        for (let parent = list.parentElement; parent && !parent.classList.contains('app-restored-body'); parent = parent.parentElement) {
          if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight + 1) problems.push('nested scrolling')
        }
        return problems
      })
      assert.deepEqual(overlapping, [], `${width}px ${path}: compact cards without overlap or nested scrolling`)
      if (width === 430 && path.endsWith('screen-9')) {
        await page.locator('.app-restored-body').evaluate(body => { body.scrollTop += body.querySelector('.pm-equipment-cards').getBoundingClientRect().top - body.getBoundingClientRect().top - 8 })
        await page.screenshot({ path: 'test-results/pm-app-populated-preview.png' })
      }
      console.log('PASS compact cards, detail links and one scroll area', width, path)
    }
  }
  assert.deepEqual(errors, [])
} finally { await browser.close(); await server.close() }
