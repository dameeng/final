import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];let number='12가3456',calls=0,recordId=1
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/api/plate-logs?*',route=>{
    calls++;const id=new URL(route.request().url()).searchParams.get('underpassId')
    return route.fulfill({json:{success:true,data:{items:id==='1'?[{id:recordId,detectedNum:number,detectedAt:'2026-10-22T14:00:00',cameraId:61,recognitionStatus:'SUCCESS',reviewStatus:'NONE'}]:[],page:1,size:20,totalItems:id==='1'?1:0,totalPages:1}}})
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/facility-cctv-fixture.html`)
  await page.getByText('12가3456',{exact:true}).waitFor()
  assert.equal(await page.locator('.ocr-log-list .notification-arrival-glow').count(),0)
  const video=await page.locator('.facility-camera-stage').boundingBox(),log=await page.getByRole('complementary',{name:'OCR 인식 로그'}).boundingBox()
  assert(log.x>=video.x+video.width)
  assert(Math.abs(log.y-video.y)<2)
  assert(Math.abs(log.height-video.height)<2)
  number='34나5678'
  recordId=2
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('routel-backend-event',{detail:{name:'plate-queue-add',data:{underpassId:1}}})))
  await page.getByText('34나5678',{exact:true}).waitFor()
  assert.equal(await page.locator('.ocr-log-list .notification-arrival-glow').count(),1)
  await page.setViewportSize({width:390,height:900})
  const mobileVideo=await page.locator('.facility-camera-stage').boundingBox(),mobileLog=await page.getByRole('complementary',{name:'OCR 인식 로그'}).boundingBox()
  assert(mobileLog.y>=mobileVideo.y+mobileVideo.height)
  await page.evaluate(()=>window.selectTestFacility('2'))
  await page.getByText('아직 인식된 번호판이 없습니다.',{exact:true}).waitFor()
  assert.equal(await page.getByText('34나5678',{exact:true}).count(),0)
  assert(calls>=3);assert.deepEqual(errors,[])
  console.log('통과: OCR 로그 우측 배치, 시설별 조회·전환, 인식 이벤트 갱신, 모바일 아래 배치')
}finally{await browser.close();await server.close()}
