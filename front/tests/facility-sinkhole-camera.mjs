import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
try {
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 const page=await browser.newPage(),calls=[],errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/**',async route=>{
  const u=new URL(route.request().url());calls.push(u.pathname+u.search)
  if(/\/stream/.test(u.pathname))return route.fulfill({contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')})
  let data={}
  if(u.pathname==='/api/cctv/analysis/state')data={cameras:[{cameraId:230,state:'RUNNING',running:true,frameSeconds:2.5,springDelivery:'SENT'}]}
  else if(u.pathname==='/api/pm/equipments')data={items:[{equipId:25}]}
  else if(u.pathname==='/api/plate-logs')data=[]
  return route.fulfill({json:{success:true,data}})
 })
 await page.goto(base+'/tests/facility-cctv-fixture.html?road=1')
 await page.getByRole('heading',{name:'노면·싱크홀 · 230',exact:true}).waitFor()
 await page.getByRole('button',{name:'영상 분석 실행',exact:true}).click()
 await page.getByText('초량 CCTV230 싱크홀 분석을 시작했습니다. 탐지 사진은 장비 현황의 노면에서 확인하세요.',{exact:true}).waitFor()
 assert(calls.some(x=>x==='/api/cctv/analysis/start?cameraId=230'))
 await page.getByText('Spring 저장 완료 · 장비 현황에서 분석 결과를 확인하세요.',{exact:true}).waitFor()
 assert.equal(await page.getByRole('complementary',{name:'OCR 인식 로그'}).count(),0)
 assert((await page.locator('.facility-camera-stage img').getAttribute('src')).startsWith('/api/cctv/230/stream'))
 await page.getByRole('button',{name:'정지',exact:true}).click()
 assert(calls.some(x=>x==='/api/cctv/analysis/stop?cameraId=230'))
 await page.getByRole('combobox',{name:'CCTV 선택',exact:true}).selectOption('226')
 await page.getByRole('button',{name:'영상 분석 실행',exact:true}).click()
 await page.getByText('번호판 인식 시작 요청이 완료되었습니다. OCR 인식 기록에서 결과를 확인하세요.',{exact:true}).waitFor()
 assert(calls.some(x=>x==='/api/cctv/analysis/start?cameraId=226'))
 assert.equal(await page.getByRole('complementary',{name:'OCR 인식 로그'}).count(),1)
 assert.deepEqual(errors,[])
 console.log('PASS camera230 sinkhole controls/stream, state and independent OCR226')
}finally{await browser.close();await server.close()}
