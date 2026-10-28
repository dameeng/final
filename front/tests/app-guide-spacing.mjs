import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage()
 await page.route('**/api/**',r=>r.fulfill({json:{success:true,data:null}}))
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:900})
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/info/app-guide`)
  await expect(page.locator('.app-guide-feature-detail')).toBeVisible()
  const sizes=await page.evaluate(()=>{
   const box=s=>document.querySelector(s).getBoundingClientRect()
   const tabs=box('.app-guide-feature-tabs'),detail=box('.app-guide-feature-detail'),install=box('.app-guide-install'),feature=box('.app-guide-feature-section')
   return {inside:detail.top-tabs.bottom,outside:install.top-feature.bottom,padding:getComputedStyle(document.querySelector('.app-guide-feature-detail')).paddingTop,panelPadding:getComputedStyle(document.querySelector('.app-guide-install-panel')).paddingTop,overflow:document.documentElement.scrollWidth>innerWidth+1}
  })
  assert(Math.abs(sizes.inside-(width>800?24:20))<1)
  assert(Math.abs(sizes.outside-(width>800?48:32))<1)
  assert.equal(sizes.padding,sizes.panelPadding)
  assert(!sizes.overflow)
 }
 console.log('PASS consistent section gaps, card padding and mobile overflow')
}finally{await browser.close();await server.close()}
