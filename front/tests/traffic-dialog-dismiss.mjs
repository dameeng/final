import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage(),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/map-cctv.json',route=>route.fulfill({json:[{id:'1',name:'테스트 해변',address:'부산',lat:35.17,lng:129.07,url:'https://video.test/live.m3u8'}]}))
 await page.route('https://video.test/**',route=>route.fulfill({status:404}))
 const vms={id:57,name:'테스트 전광판',lat:35.17,lng:129.07,pages:[{pageNo:2,content:'북항지하차도\n통제 해제',color:'GREEN'},{pageNo:1,content:'초량지하차도\n통제 중 통행 금지',color:'RED'},{pageNo:3,content:'안전운전 하세요',color:'YELLOW'}]}
 await page.route(/\/api\/its-vms(?:\/57)?$/,route=>route.fulfill({json:{success:true,data:new URL(route.request().url()).pathname.endsWith('/57')?vms:[vms]}}))
 for(const [width,height,app] of [[1280,844,false],[1280,844,true],[390,844,true],[320,280,true]]) {
  await page.setViewportSize({width,height})
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/traffic-layers-fixture.html${app?'?app=1':''}`)
  if(app) await page.locator('#app').evaluate(el=>el.style.cssText='width:min(430px,100%);margin:0 auto;padding:16px;box-sizing:border-box')
  await page.getByRole('button',{name:'CCTV',exact:true}).click()
  await page.locator('.traffic-device-marker').first().click()
  const view=page.locator(app?'.workflow-page:visible':'dialog.traffic-device-dialog[open]')
  await expect(view.getByRole('heading',{name:'테스트 해변',exact:true})).toBeVisible()
  await expect(page.locator('dialog[open]')).toHaveCount(app?0:1)
  for(const theme of ['light','dark']) {
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
   const box=await view.boundingBox(),video=await view.locator('video').boundingBox()
   assert(box.width<=(app?430:900)&&box.x>=0&&box.x+box.width<=width,'CCTV page fits its content area')
   assert(video.width<=box.width,'Video fits page')
   assert.equal(await view.evaluate(el=>el.tagName),app?'SECTION':'DIALOG','Only apps use content pages; web uses native dialogs')
  }
  await view.getByRole('button',{name:'닫기',exact:true}).click()
  await expect(view).toHaveCount(0)
  await expect(page.locator('video')).toHaveCount(0)
  await page.getByRole('button',{name:'VMS 전광판',exact:true}).click()
  await page.locator('.traffic-device-marker').first().click()
  await view.getByRole('button',{name:/테스트 전광판/}).click()
  await expect(view.getByRole('heading',{name:'테스트 전광판',exact:true})).toBeVisible()
  await expect(view.locator('.vms-led-text')).toContainText('초량지하차도')
  await expect(view.locator('.vms-led-carousel')).toHaveAttribute('data-color','RED')
  assert.match(await view.locator('.vms-led-text').evaluate(el=>getComputedStyle(el).backgroundImage),/255, 73, 62/)
  await expect(view.locator('.vms-example-note')).toHaveCount(0)
  await view.getByRole('button',{name:'다음 문구',exact:true}).click()
  await expect(view.locator('.vms-led-text')).toContainText('북항지하차도')
  await expect(view.locator('.vms-led-carousel')).toHaveAttribute('data-color','GREEN')
  assert.match(await view.locator('.vms-led-text').evaluate(el=>getComputedStyle(el).backgroundImage),/70, 215, 108/)
  await expect(view.locator('.vms-led-counter')).toHaveText('2 / 3')
  await view.getByRole('button',{name:'다음 문구',exact:true}).click()
  await expect(view.locator('.vms-led-carousel')).toHaveAttribute('data-color','YELLOW')
  await view.getByRole('button',{name:app?'‹ 뒤로':'닫기',exact:true}).click()
  await expect(view).toHaveCount(0)
 }
 assert.deepEqual(errors,[])
 console.log('PASS CCTV/VMS as content pages in app/web, both themes, phone/landscape; playback cleanup and page return')
} finally {await browser.close();await server.close()}
