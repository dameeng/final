import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
let browser
try{
 browser=await chromium.launch({channel:'msedge',headless:true})
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/v2/maps/sdk.js*',r=>r.abort())
 const rows=Array.from({length:45},(_,i)=>({id:i+1,name:'지하차도 '+String(i+1).padStart(2,'0'),regionName:'동구',roadAddress:'부산광역시 동구 중앙대로 '+i,latitude:35.12+i*.001,longitude:129.04,currentStatus:'NORMAL',currentRiskLevel:'안전'}))
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname
  return route.fulfill({json:{success:true,data:path==='/api/underpasses'?{items:rows,page:1,totalPages:1,totalItems:45}:path==='/api/navigation/weather'?{temperature:15.3,humidity:98,rainfall:1,condition:'비'}:null}})
 })
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/c-map`)
 const list=page.locator('.facility-list-panel .lst')
 await page.waitForFunction(()=>Number(document.querySelector('.facility-list-panel .lst')?.dataset.pageSize)>5)
 const tallSize=Number(await list.getAttribute('data-page-size'))
 async function checkAlignment(){
  const result=await page.locator('.map-swap-layout').evaluate(el=>[...el.children].map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {top:r.top,bottom:r.bottom,width:r.width,border:s.borderTopWidth,radius:s.borderTopLeftRadius}}))
  assert(Math.abs(result[0].top-result[1].top)<1,'map and panel tops align')
  assert(Math.abs(result[0].bottom-result[1].bottom)<1,'map and panel bottoms align')
  assert.equal(result[1].border,'1px');assert.equal(result[0].radius,result[1].radius)
 }
 await checkAlignment()
 assert.equal(await list.locator('.it').count(),tallSize)
 const fill=await list.evaluate(el=>{const last=el.lastElementChild.getBoundingClientRect(),rect=el.getBoundingClientRect();return {gap:rect.bottom-last.bottom,overflow:el.scrollHeight>el.clientHeight+2}})
 assert(fill.gap<4,JSON.stringify(fill));assert.equal(fill.overflow,false)
 const sidebar=page.locator('.customer-section-sidebar')
 assert(await sidebar.isVisible())
 await page.evaluate(()=>scrollTo({top:140,behavior:'instant'}))
 const first=await sidebar.boundingBox(),header=await page.locator('.customer-header').boundingBox()
 assert(first.y>=header.y+header.height)
 await page.evaluate(()=>scrollTo({top:240,behavior:'instant'}))
 const second=await sidebar.boundingBox()
 assert(Math.abs(first.y-second.y)<2,'left sidebar follows scroll below header')
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}))
 await page.setViewportSize({width:1366,height:650})
 await page.waitForFunction(size=>Number(document.querySelector('.facility-list-panel .lst')?.dataset.pageSize)<size,tallSize)
 const shortSize=Number(await list.getAttribute('data-page-size'))
 assert(shortSize>=1&&shortSize<tallSize)
 await page.locator('.customer-list-pagination').getByRole('button',{name:'다음',exact:true}).click()
 assert.equal(await list.locator('.it').count(),shortSize)
 await checkAlignment()
 assert((await list.locator('.it').first().innerText()).includes('지하차도 '+String(shortSize+1).padStart(2,'0')))
 await list.locator('.it').first().click()
 await page.locator('.swapped-detail').waitFor()
 await checkAlignment()
 await page.getByRole('button',{name:'상세 접기 ▴',exact:true}).click()
 await checkAlignment()
 await page.getByRole('button',{name:'상세 펼치기 ▾',exact:true}).click()
 await checkAlignment()
 await page.getByRole('button',{name:'목록으로',exact:true}).click()
 for(const [width,height] of [[1280,720],[1024,600],[768,900],[390,844],[360,640],[844,390]]){
  await page.setViewportSize({width,height})
  await page.waitForTimeout(80)
  assert(await sidebar.isVisible())
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width} overflow`)
  if(width>900)await checkAlignment()
  await page.locator('.customer-list-pagination').scrollIntoViewIfNeeded()
  assert(await page.locator('.customer-list-pagination').isVisible())
 }
 assert.deepEqual(errors,[])
 console.log('PASS adaptive row count and full panel, sidebar restored/sticky, pagination and responsive layouts',JSON.stringify({tallSize,shortSize}))
}finally{await browser?.close();await server.close()}
