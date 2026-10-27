import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ configLoader:'runner', server:{ host:'127.0.0.1', port:0, strictPort:false } })
await server.listen()
const browser = await chromium.launch({ channel:'msedge', headless:true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let manager = true
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    let data = { items:[], page:1, totalItems:0, totalPages:1 }
    if(path==='/api/managers/me') data = manager ? { id:1, name:'김민수', role:'REGIONAL_ADMIN', regions:[] } : null
    else if(path==='/api/customers/me') data = manager ? null : { id:2, name:'고객', phone:'01012345678' }
    else if(path==='/api/underpasses/7') data = { id:7, name:'충장지하차도', currentRiskLevel:'CAUTION', currentStatus:'BLOCKED', regionName:'동구', roadAddress:'부산광역시 동구', safetyGrade:'UNKNOWN', heightM:7.3, lengthM:1860, lanes:4, currentRiskScore:62, remainingCount:0, pendingReviewCount:2 }
    else if(path==='/api/regions'||path.includes('/dashboard/')) data=[]
    return route.fulfill({ json:{ success:true, data } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  for(const width of [320,430]) {
    await page.setViewportSize({width,height:900})
    for(const path of ['/admin-app/screen-5?id=7','/admin-app/screen-9','/admin-app/screen-11','/admin-app/screen-14','/customer-app/account/settings']) {
      manager = path.startsWith('/admin-app/')
      await page.goto(base+path)
      await page.locator('.app-restored-body').waitFor()
      if(path.includes('screen-5')) {
        await expect(page.locator('.app-facility-heading h1')).toHaveText('충장지하차도')
        await expect(page.locator('.app-facility-specs')).toContainText('미확인')
        await expect(page.locator('.app-operation-badge')).toHaveText('통제 중')
      }
      for(const theme of ['light','dark']) {
        await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
        const results = await page.evaluate(() => {
          function contrast(foreground,background) {
            const luminance=color=>{
              const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4})
              return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722
            }
            const a=luminance(foreground),b=luminance(background)
            return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)
          }
          const host=document.createElement('div');document.querySelector('.app-restored-body').append(host)
          host.innerHTML=['safe','watch','caution','alert','severe','unknown'].map(level=>`<span class="risk-level-badge risk-level-badge--${level}">상태</span>`).join('')+'<span class="pm-inspection-state pm-inspection-state--resolved">완료</span>'
          const badges=[...document.querySelectorAll('.risk-level-badge,.app-operation-badge,.pm-inspection-state')].map(el=>{const s=getComputedStyle(el);return {text:el.textContent,ratio:contrast(s.color,s.backgroundColor)}})
          host.remove()
          const body=document.querySelector('.app-restored-body')
          return {badges,overflow:body.scrollWidth>body.clientWidth+1}
        })
        for(const badge of results.badges) assert(badge.ratio>=4.5,`${width} ${path} ${theme} ${badge.text}: contrast ${badge.ratio}`)
        assert(!results.overflow,`${path}: no horizontal overflow`)
        if(width===430&&path.includes('screen-5')) await page.screenshot({path:`test-results/app-facility-${theme}.png`})
      }
    }
  }
  assert.deepEqual(errors,[])
  console.log('PASS 20 app/theme/width combinations: badge contrast >=4.5, unknown label and no horizontal overflow')
} finally { await browser.close();await server.close() }
