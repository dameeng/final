import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage({viewport:{width:1057,height:844}}), errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/map-cctv.json',route=>route.fulfill({json:[
  {id:'1',name:'테스트 해변',address:'부산',lat:35.17,lng:129.07,url:'https://video.test/live.m3u8'},
  {id:'2',name:'테스트 교차로',address:'부산',lat:35.17,lng:129.07,url:'https://video.test/live.m3u8'},
 ]}))
 await page.route('https://video.test/**',route=>route.fulfill({status:404}))
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/traffic-layers-fixture.html`)
 await page.evaluate(()=>window.setTrafficOverlap(true))
 await page.getByRole('button',{name:'CCTV',exact:true}).click()
 const marker=page.locator('.traffic-device-marker.device-group'),dialog=page.getByRole('dialog',{name:'교통 시설 정보'})
 await marker.click()
 assert.equal(await dialog.locator('li').count(),2)
 assert.equal(await dialog.evaluate(element=>element.parentElement===document.body),true)
 assert.equal(await dialog.evaluate(element=>getComputedStyle(element).pointerEvents),'auto')
 await dialog.getByRole('button',{name:/테스트 해변/}).click()
 await dialog.getByRole('heading',{name:'테스트 해변',exact:true}).waitFor()
 await dialog.getByRole('button',{name:'목록으로 돌아가기'}).click()
 await dialog.getByRole('heading',{name:'확인할 시설을 선택하세요'}).waitFor()
 await dialog.getByRole('button',{name:'닫기',exact:true}).click()
 await page.waitForFunction(()=>!document.querySelector('.traffic-device-dialog').open)
 for(const width of [1057,390]) {
  await page.setViewportSize({width,height:844})
  await marker.click()
  await dialog.getByRole('heading',{name:'확인할 시설을 선택하세요'}).click()
  assert.equal(await dialog.evaluate(element=>element.open),true,'팝업 안 빈 공간은 유지')
  await page.mouse.click(2,2)
  await page.waitForFunction(()=>!document.querySelector('.traffic-device-dialog').open)
  await marker.click()
  await dialog.getByRole('button',{name:/테스트 교차로/}).click()
  await page.mouse.click(2,2)
  await page.waitForFunction(()=>!document.querySelector('.traffic-device-dialog').open)
 }
 await marker.click();await page.keyboard.press('Escape')
 await page.waitForFunction(()=>!document.querySelector('.traffic-device-dialog').open)
 await page.getByRole('button',{name:'CCTV',exact:true}).click()
 assert.equal(await page.locator('.traffic-device-marker').count(),0,'닫은 뒤 지도 버튼 클릭 가능')
 assert.deepEqual(errors,[])
 console.log('통과: 지도 툴바 안 팝업의 닫기·시설 선택·뒤로가기·PC/모바일 배경 클릭·Escape·닫은 뒤 클릭')
} finally {await browser.close();await server.close()}
