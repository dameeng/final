import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage()
 await page.route('**/api/**',r=>r.fulfill({json:{success:true,data:null}}))
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
  await page.setViewportSize(viewport)
  await page.goto(base+'/')
  await expect(page.locator('.home-premium')).toBeVisible()
  const layout=await page.evaluate(()=>({snap:getComputedStyle(document.documentElement).scrollSnapType,header:document.querySelector('.customer-header').getBoundingClientRect().height,sections:[...document.querySelectorAll('.home-premium>section')].map(el=>({height:el.getBoundingClientRect().height,snap:getComputedStyle(el).scrollSnapAlign})),overflow:document.documentElement.scrollWidth>innerWidth}))
  assert.equal(layout.snap,'y mandatory')
  assert(!layout.overflow)
  assert(layout.sections.slice(0,3).every(s=>s.height>=viewport.height-layout.header-1&&s.snap==='start'))
  assert(layout.sections.slice(3).every(s=>s.height<viewport.height-layout.header),'Supporting sections stay compact')
  assert.equal(await page.locator('.home-roadmap-year').first().evaluate(el=>getComputedStyle(el).fontSize),'22px')
  assert.equal(await page.locator('.home-closing').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)')
  await page.locator('.home-brand').evaluate(el=>el.scrollIntoView())
  await expect.poll(()=>page.locator('.home-brand').evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBe(Math.round(layout.header))
  await page.goto(base+'/info/company')
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollSnapType),'none')
 }
 console.log('PASS customer home viewport sections, scroll alignment, mobile overflow and route isolation')
}finally{await browser.close();await server.close()}
