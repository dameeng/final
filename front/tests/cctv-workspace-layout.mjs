import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try {
const p=await b.newPage({viewport:{width:1440,height:1000}})
const errors=[],calls=[];p.on('pageerror',e=>errors.push(e.message))
const cams=['APPROACH_LPR','FINAL_LPR','FINAL_LPR','FINAL_LPR','CCTV'].map((cameraRole,i)=>({id:226+i,underpassId:1,cameraRole,streamUrl:'http://localhost:8000/stream/'+(226+i),distanceM:i*50}))
await p.route('**/api/**',r=>{
 const url=new URL(r.request().url()),path=url.pathname
 calls.push({path,method:r.request().method(),camera:url.searchParams.get('cameraId'),page:url.searchParams.get('page')})
 if(path.endsWith('/stream'))return r.fulfill({status:503,body:''})
 let data=[]
 if(path==='/api/managers/me')data={id:1,name:'QA',role:'REGIONAL_ADMIN'}
 else if(path==='/api/underpasses/1')data={id:1,name:'Facility',currentRiskLevel:'SAFE'}
 else if(path.endsWith('/1/cameras'))data=cams
 else if(path==='/api/cctv/analysis/state')data={cameras:[{cameraId:Number(url.searchParams.get('cameraId')),state:'STOPPED',running:false}]}
 else if(path==='/api/plate-logs')data={items:[{id:Number(url.searchParams.get('page')||1),detectedNum:url.searchParams.get('page')==='2'?'34나5678':'12가3456',recognitionStatus:'SUCCESS',reviewStatus:'NONE',detectedAt:'2026-10-30T12:00:00',cameraId:226}],totalItems:2,totalPages:2,page:Number(url.searchParams.get('page')||1),size:10}
 else if(path.startsWith('/api/pm/'))data={items:[],totalItems:0,totalPages:1}
 return r.fulfill({json:{data}})
})
await p.goto('http://localhost:8282/fac-detail?id=1&tab=cctv')
await p.locator('.facility-video-empty').waitFor()
assert.equal(await p.locator('.facility-camera-facts dd').first().textContent(),'226')
assert.equal(await p.locator('.facility-viewer-toolbar .recognition-start').count(),0)
assert.equal(await p.locator('.facility-video-heading .recognition-start').count(),2)
assert.equal(await p.locator('.facility-viewer-toolbar').evaluate(e=>getComputedStyle(e).borderTopWidth),'0px')
assert.equal(await p.locator('.facility-detail-tabs [aria-current=page]').count(),1)
assert.equal(await p.locator('.facility-detail-tabs [aria-current=page]').textContent(),'CCTV')
const heights=await p.locator('.facility-camera-row').evaluate(e=>({video:e.querySelector('.facility-video-panel').getBoundingClientRect().height,log:e.querySelector('.facility-ocr-log').getBoundingClientRect().height}))
assert.ok(Math.abs(heights.video-heights.log)<=1)
for(const theme of ['light','dark']){
 await p.evaluate(t=>document.documentElement.dataset.theme=t,theme)
 for(const width of [1440,1900,900,390]){
  await p.setViewportSize({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,theme+' '+width)
  if(width>=1440){
   const columns=await p.locator('.facility-camera-row').evaluate(e=>({total:e.clientWidth,video:e.querySelector('.facility-video-panel').getBoundingClientRect().width,log:e.querySelector('.facility-ocr-log').getBoundingClientRect().width}))
   assert(columns.video/columns.total>=.7)
   assert(columns.log>=300&&columns.log<=401)
  }
 }
}
await p.setViewportSize({width:1440,height:1000})
await p.getByRole('button',{name:'영상 분석 실행',exact:true}).click()
await p.getByRole('button',{name:'정지',exact:true}).click()
assert.ok(calls.some(c=>c.path.endsWith('/analysis/start')&&c.method==='POST'&&c.camera==='226'))
assert.ok(calls.some(c=>c.path.endsWith('/analysis/stop')&&c.method==='POST'&&c.camera==='226'))
await p.locator('.facility-ocr-log').getByRole('button',{name:'다음',exact:true}).click()
await p.locator('.ocr-log-row strong').filter({hasText:'34나5678'}).waitFor()
await p.locator('[data-camera-id="230"]').click()
await p.locator('.facility-road-analysis').waitFor()
assert.equal(await p.locator('.facility-camera-facts dd').first().textContent(),'230')
assert.deepEqual(errors,[])
console.log('CCTV toolbar, video empty state, equal panel height, responsive themes, start/stop, log paging and camera switching passed')
}finally{await b.close()}
