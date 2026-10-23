import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 const page=await browser.newPage(),calls=[],errors=[]
 let rejectStart=true
 await page.context().addCookies([{name:'session',value:'test-session',url:base}])
 page.on('pageerror',error=>errors.push(error.message))
 page.on('request',request=>calls.push({url:request.url(),method:request.method(),cookie:request.headers().cookie}))
 await page.route('**/api/plate-logs?*',route=>route.fulfill({json:{success:true,data:[]}}))
 await page.route('**/api/cctv/61/stream?*',route=>route.fulfill({contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')}))
 await page.route('**/api/cctv/plate/*',route=>route.fulfill({status:rejectStart?403:200,json:rejectStart?{success:false,message:'담당 카메라 권한 없음'}:{success:true,data:{}}}))
 await page.goto(base+'/tests/facility-cctv-fixture.html?ai=1')
 const image=page.locator('.facility-camera-stage img')
 await image.waitFor()
 assert.equal(await image.getAttribute('src'),'/api/cctv/61/stream?v=0')
 await page.getByRole('button',{name:'번호판 인식 실행',exact:true}).click()
 await page.getByText('담당 카메라 권한 없음',{exact:true}).waitFor()
 assert.equal(await image.getAttribute('src'),'/api/cctv/61/stream?v=0','Failure does not restart the stream')
 rejectStart=false
 await page.getByRole('button',{name:'번호판 인식 실행',exact:true}).click()
 await page.waitForFunction(()=>document.querySelector('.facility-camera-stage img').getAttribute('src').endsWith('v=1'))
 await page.getByRole('button',{name:'정지',exact:true}).click()
 await page.getByText('번호판 인식을 정지했습니다.',{exact:true}).waitFor()
 for(const action of ['start','stop']) {
  const request=calls.find(call=>call.url.includes(`/api/cctv/plate/${action}?cameraId=61`))
  assert(request);assert.equal(request.method,'POST');assert.match(request.cookie,/session=test-session/)
 }
 assert(!calls.some(call=>call.url.startsWith('http://ocr.test')||new URL(call.url).pathname.startsWith('/control/plate/')))
 assert.deepEqual(errors,[])
 console.log('PASS CCTV Spring proxy: stream URL, start/stop POST with session cookie, rejected request stays failed, no direct OCR requests')
} finally {await browser.close();await server.close()}
