import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
let server
try { await fetch('http://localhost:8282') }
catch {
  server = await createServer({ configLoader:'runner', server:{host:'127.0.0.1',port:0,strictPort:false} })
  await server.listen()
}
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    let data = {items:[],page:1,totalItems:0,totalPages:1}
    if(path==='/api/managers/me') data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:1,name:'동구'}]}
    else if(path==='/api/customers/me') data=null
    else if(path==='/api/underpasses/transits') data={items:[{id:1,underpassName:'초량지하차도',displayCarNum:'12가1234',status:'EXITED',entryAt:'2026-10-28T10:00:00',exitAt:'2026-10-28T10:10:00'},{id:2,underpassName:'초량지하차도',displayCarNum:'34나5678',status:'REMAINING',entryAt:'2026-10-28T10:00:00',exitAt:null}],page:1,totalItems:2,totalPages:1}
    else if(path==='/api/regions'||path.endsWith('/urgent')||path.endsWith('/device-tokens')) data=[]
    else if(path==='/api/assistant/admin/stats') data={total:0,answered:0,unanswered:0,successRate:0,sessions:0,daily:[],topQuestions:[]}
    return route.fulfill({json:{success:true,data}})
  })
  const base=server?`http://127.0.0.1:${server.httpServer.address().port}`:'http://localhost:8282'
  const routes=[...['ocr','reviews','transits','facilities','cameras','thresholds','display','presets','reasons','transfers','customers','inquiries','notices','faqs','alerts','events','manager-notifications','managers','regions','shifts'].map(resource=>'/admin-data/'+resource),'/pm-equipment','/pm-queue','/pm-history','/pm-settings','/pm-daily','/pm-inspection','/bot-logs','/bot-stats','/admin-reports','/admin-profile','/jurisdiction-contacts']
  for(const width of [1440,1024]) {
    await page.setViewportSize({width,height:1000})
    for(const path of routes) {
      await page.goto(base+path,{waitUntil:'domcontentloaded'})
      await expect(page.locator('.admin-shell h1').first()).toBeVisible()
      await expect(page.locator('.admin-shell h1 .admin-page-icon').first()).toBeVisible()
      if(path==='/admin-data/transits'){
        await expect(page.locator('.service-table tbody tr')).toHaveCount(2)
        const rows=await page.locator('.service-table tbody tr').evaluateAll(rows=>rows.map(row=>row.getBoundingClientRect().height))
        assert(Math.abs(rows[0]-rows[1])<2,'Transit rows have consistent height with one or two actions')
        const buttons=await page.locator('.service-table tbody tr').nth(1).locator('button').evaluateAll(items=>items.map(el=>el.getBoundingClientRect().top))
        assert(buttons.length===2&&Math.abs(buttons[0]-buttons[1])<2,'Transit actions stay on one line')
      }
      await expect(page.locator('.admin-workspace-navigation')).toHaveCount(0)
      for(const theme of ['light','dark']) {
        await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
        const result=await page.evaluate(()=>{
          const root=document.querySelector('.admin-shell')
          const filters=[...root.querySelectorAll('.service-filters,.chat-monitor-filters')].filter(el=>el.getClientRects().length)
          return {
            overflow:document.documentElement.scrollWidth>innerWidth+1,
            filters:filters.map(el=>({padding:getComputedStyle(el).paddingTop,gap:getComputedStyle(el).gap})),
            controls:filters.flatMap(el=>[...el.querySelectorAll('input:not([type=checkbox]),select,button')]).filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().height),
            heading:getComputedStyle(root.querySelector('h1')).fontSize,
            headingWeight:getComputedStyle(root.querySelector('h1')).fontWeight,
            headingLine:getComputedStyle(root.querySelector('h1')).lineHeight,
          }
        })
        assert(!result.overflow,`${path} ${width} ${theme}: no page overflow`)
        assert.equal(result.heading,'22px',path+' heading size')
        assert.equal(result.headingWeight,'700',path+' heading weight')
        assert.equal(result.headingLine,'32px',path+' heading line height')
        for(const filter of result.filters) assert.deepEqual(filter,{padding:'20px',gap:'16px'},path+' consistent filter spacing')
        assert(result.controls.every(height=>height>=44),path+' full-height filter controls')
      }
    }
  }
  assert.deepEqual(errors,[])
  console.log('PASS 31 admin web workspaces at 1440/1024 in light/dark: page icons, headings, filter rhythm, controls and page width')
} finally { await browser.close(); await server?.close() }
