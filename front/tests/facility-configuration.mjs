import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 let empty=false
 const camera={id:7,cameraRole:'CCTV',streamUrl:'https://example.invalid/very-long-camera-address/live-stream.m3u8',distanceM:0}
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname
  let data={items:[],page:1,size:10,totalItems:0,totalPages:1}
  if(path==='/api/managers/me')data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:1,name:'동구'}]}
  else if(path==='/api/customers/me')data=null
  else if(path==='/api/underpasses')data={...data,items:[{id:1,name:'초량지하차도',regionName:'동구',currentRiskLevel:'SAFE'}],totalItems:1}
  else if(path==='/api/underpasses/1/thresholds')data={...data,items:empty?[]:[{level:'SAFE',riskScoreMin:0,updatedAt:'2026-10-28T12:00:00'},{level:'WATCH',riskScoreMin:40,updatedAt:'2026-10-28T12:00:00'},{level:'CAUTION',riskScoreMin:70,updatedAt:'2026-10-28T12:00:00'}],totalItems:empty?0:3}
  else if(path==='/api/underpasses/1/cameras')data={...data,items:empty?[]:[camera],totalItems:empty?0:1}
  else if(path==='/api/underpasses/1/cameras/7')data=camera
  return r.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 for(const kind of ['thresholds','cameras']){
  empty=false
  await page.goto(base+`/admin-data/${kind}?underpassId=1`)
  await expect(page.locator('.configuration-summary h2')).toHaveText('초량지하차도')
  if(kind==='thresholds'){
   await expect(page.locator('.configuration-threshold-card')).toHaveCount(3)
   await expect(page.locator('.configuration-score strong').first()).toHaveText('0')
   await page.getByRole('button',{name:'기준 수정',exact:true}).first().click()
   await expect(page.getByRole('dialog')).toBeVisible()
   await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click()
   await mkdir('test-results',{recursive:true})
   await page.screenshot({path:'test-results/facility-threshold-cards.png'})
  }else{
   await expect(page.locator('.configuration-camera-card')).toHaveCount(1)
   await expect(page.locator('.configuration-camera-card')).toContainText('0 m')
   await page.locator('.configuration-camera-card').getByRole('button',{name:'수정',exact:true}).click()
   await expect(page.getByRole('dialog')).toBeVisible()
   await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click()
  }
  empty=true
  await page.reload()
  await expect(page.locator('.configuration-empty')).toBeVisible()
  await expect(page.locator('.configuration-score')).toHaveCount(0)
  if(kind==='cameras'){
   await page.getByRole('button',{name:'카메라 등록',exact:true}).click()
   await expect(page.getByRole('dialog')).toBeVisible()
   await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click()
  }
  await page.setViewportSize({width:390,height:844})
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No narrow-screen overflow')
  await page.setViewportSize({width:1600,height:1000})
 }
 assert.deepEqual(errors,[])
 console.log('PASS facility context, threshold/camera cards, zero values, empty states, existing edit/create actions and mobile width')
}finally{await browser.close();await server.close()}
