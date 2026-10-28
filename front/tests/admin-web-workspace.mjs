import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ configLoader:'runner', server:{host:'127.0.0.1',port:0,strictPort:false} })
await server.listen()
const browser = await chromium.launch({channel:'msedge',headless:true})
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}})
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    let data = {items:[],page:1,totalItems:0,totalPages:1}
    if(path==='/api/managers/me') data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:1,name:'동구'}]}
    else if(path==='/api/customers/me') data=null
    else if(path==='/api/regions'||path.endsWith('/urgent')||path.endsWith('/device-tokens')) data=[]
    return route.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  const routes=['/admin-data/ocr','/admin-data/reviews','/admin-data/transits','/admin-data/facilities','/admin-data/notices','/admin-data/faqs','/admin-data/manager-notifications','/pm-settings','/bot-logs','/admin-reports']
  for(const width of [1440,1024]) {
    await page.setViewportSize({width,height:1000})
    for(const path of routes) {
      await page.goto(base+path)
      await expect(page.locator('.admin-shell .service-heading h1').first()).toBeVisible()
      for(const theme of ['light','dark']) {
        await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
        const result=await page.evaluate(()=>{
          const root=document.querySelector('.admin-shell')
          const filters=[...root.querySelectorAll('.service-filters,.chat-monitor-filters')].filter(el=>el.getClientRects().length)
          return {
            overflow:document.documentElement.scrollWidth>innerWidth+1,
            filters:filters.map(el=>({padding:getComputedStyle(el).paddingTop,gap:getComputedStyle(el).gap})),
            controls:filters.flatMap(el=>[...el.querySelectorAll('input:not([type=checkbox]),select,button')]).filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().height),
            heading:getComputedStyle(root.querySelector('.service-heading h1')).fontSize,
          }
        })
        assert(!result.overflow,`${path} ${width} ${theme}: no page overflow`)
        assert.equal(result.heading,'22px',path+' heading size')
        for(const filter of result.filters) assert.deepEqual(filter,{padding:'20px',gap:'16px'},path+' consistent filter spacing')
        assert(result.controls.every(height=>height>=44),path+' full-height filter controls')
      }
    }
  }
  console.log('PASS 10 admin web workspaces at 1440/1024 in light/dark: headings, filter rhythm, controls and page width')
} finally { await browser.close(); await server.close() }
