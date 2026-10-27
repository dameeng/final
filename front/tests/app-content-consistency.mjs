import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  let manager=false
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname
    let data={items:[],page:1,totalItems:0,totalPages:1}
    if(path==='/api/managers/me') data=manager?{id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[]}:null
    else if(path==='/api/customers/me') data=manager?null:{id:2,name:'이하은',phone:'01012345678'}
    else if(path==='/api/regions') data=[]
    else if(path==='/api/faqs') data={...data,totalItems:2,items:[{id:1,question:'지하차도 침수 위험 알림은 어떻게 받나요?',category:'NOTICE',viewCount:129},{id:2,question:'지하차도가 차단되면 언제 해제되나요?',category:'USE',viewCount:97}]}
    else if(/^\/api\/faqs\/\d+$/.test(path)) data={answer:'관심 지역과 차량을 등록하면 해당 지하차도의 통제 정보를 확인할 수 있습니다. 안전한 이동을 위해 최신 안내를 확인해 주세요.',viewCount:130}
    return route.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  for(const width of [320,430,1200]) {
    await page.setViewportSize({width,height:950})
    for(const theme of ['light','dark']) {
      await page.goto(base+'/customer-app/faq')
      await expect(page.locator('.faq-accordion-item')).toHaveCount(2)
      if(await page.locator('html').getAttribute('data-theme')!==theme) await page.locator('.theme-toggle:visible').first().click()
      for(const summary of await page.locator('.faq-accordion summary').all()) await summary.click()
      await expect(page.locator('.faq-answer-text').first()).toContainText('관심 지역과 차량')
      const card=page.locator('.faq-accordion-item').first(),answer=card.locator('.faq-inline-answer')
      assert.equal(await card.evaluate(el=>getComputedStyle(el).borderRadius),'14px')
      const box=await card.boundingBox(),reply=await answer.boundingBox()
      assert(reply.x-box.x<=14,'Answer uses the card width instead of a deep indent')
      assert(reply.x+reply.width<=box.x+box.width,'Answer stays inside card')
      assert.equal(await card.locator('summary strong').evaluate(el=>getComputedStyle(el).fontSize),'14px')
      assert.equal(await answer.locator('.faq-answer-text').evaluate(el=>getComputedStyle(el).fontSize),'13px')
      const select=page.locator('.service-filters select').first()
      assert.equal(await select.evaluate(el=>Math.abs(el.getBoundingClientRect().width-el.parentElement.getBoundingClientRect().width)<2),true,'Filter controls fill their label')
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow')
      if(width===430) await page.screenshot({path:`test-results/faq-app-${theme}.png`,animations:'disabled'})
    }
  }
  await page.setViewportSize({width:1440,height:950})
  await page.goto(base+'/info/faq')
  await expect(page.locator('.faq-accordion-item')).toHaveCount(2)
  assert.equal(await page.locator('.faq-accordion').evaluate(el=>getComputedStyle(el).display),'block','Web FAQ layout remains unchanged')
  manager=true
  await page.goto(base+'/admin-app/ocr')
  const controls=page.locator('.service-filters input,.service-filters select')
  for(const control of await controls.all()) assert.equal(await control.evaluate(el=>Math.abs(el.getBoundingClientRect().width-el.parentElement.getBoundingClientRect().width)<2),true,'Administrator app controls use the same full width')
  assert.deepEqual(errors,[])
  console.log('PASS app FAQ/cards/forms in both themes and 3 widths; administrator controls aligned; web FAQ preserved')
} finally {await browser.close();await server.close()}
