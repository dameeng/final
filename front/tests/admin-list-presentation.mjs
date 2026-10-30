import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const longText = '여러 담당 지역의 시설 정보를 확인하고 현장 조치 내용을 전달하는 긴 안내 문구입니다. '.repeat(5)
const base = { id: 1, name: '김관리', loginId: 'manager01', phone: '01010010001', email: 'manager@example.com', regions: [{id:1,name:'동구'}], role: 'REGIONAL_ADMIN', shiftName: '주간조', title: longText, content: longText, question: longText, answer: longText, memo: longText, reason: longText, displayContent: longText, carNums:['12가3456'], category:'BLOCK', type:'BLOCK', customerName:'이고객', authorName:'김관리', managerName:'김관리', underpassName:'부산진시장지하차도', createdAt:'2026-10-30T12:00:00', detectedAt:'2026-10-30T12:00:00', sentAt:'2026-10-30T12:00:00', entryAt:'2026-10-30T12:00:00', exitAt:null, viewCount:42, important:true, recognitionStatus:'SUCCESS', reviewStatus:'CONFIRMED', pushStatus:'SUCCESS', startTime:'08:00:00',endTime:'16:00:00',detectedNum:'12가3456',correctedNum:'12가3456',displayCarNum:'12가3456',confidence:0.98,agency:'POLICE',documentType:'BLOCK',kind:'EVENT',eventType:'BLOCK',alertType:'FINAL' }
try {
 const page = await browser.newPage({ viewport: { width:1440,height:1000 } })
 let emptyResults=false
 const errors=[]; page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/**',async r=>{
  const p=new URL(r.request().url()).pathname
  let data={items:[{...base,status:p.includes('inquiries')?'PENDING':p.includes('transits')?'REMAINING':'ACTIVE'}],page:1,size:10,totalItems:1,totalPages:1}
  if(p==='/api/managers/me') data={id:1,name:'QA',role:'REGIONAL_ADMIN',regions:[{id:1,name:'동구'}]}
  else if(p==='/api/regions'||p==='/api/shifts') data=[{id:1,name:'주간조',startTime:'08:00:00',endTime:'16:00:00'}]
  else if(p==='/api/underpasses') data={items:[],page:1,size:10,totalItems:0,totalPages:1}
  else if(p.startsWith('/api/pm/')) data={items:[{...base, equipId:1,eventId:1,actionId:1, name:'P-1-1',type:'PUMP',status:'IN_PROGRESS',triggerType:'RISK_ENTER',score:75,currentScore:72,level:'DANGER',currentLevel:'DANGER',reasons:[longText],sparkline:[10,30,75],scoreChange7d:4,lastReceivedAt:base.createdAt,scoreBefore:75,scoreAfter:72,content:longText}],page:1,size:10,totalItems:1,totalPages:1}
  else if(p.includes('/notifications')) data={items:[],totalItems:0,totalPages:1,page:1,size:10}
  if(emptyResults && Array.isArray(data.items)) data={...data,items:[],totalItems:0,totalPages:1}
  await r.fulfill({json:{data}})
 })
 const pages=['/cs-customers','/cs-inquiries','/admin-data/notices','/admin-data/faqs','/admin-data/ocr','/admin-data/reviews','/admin-data/transits','/admin-data/alerts','/logs?underpassId=1','/admin-data/transfers?underpassId=1','/admin-data/presets','/admin-data/reasons','/admin-data/shifts','/admin-data/managers','/admin-data/regions','/pm-equipment','/pm-queue','/pm-history','/pm-settings']
 const sharedWidths=new Map()
 for(const path of pages){
  await page.goto('http://localhost:8282'+path,{waitUntil:'domcontentloaded'})
  await page.locator('.list-result-count').first().waitFor()
  const title=await page.locator('h1').first().evaluate(e=>({size:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight,weight:getComputedStyle(e).fontWeight,left:Math.round(e.getBoundingClientRect().left)}))
  assert.deepEqual(title,{size:'22px',line:'32px',weight:'700',left:24},path+' page title standard')
  for(const header of await page.locator('.service-table th,.tbl th').evaluateAll(es=>es.map(e=>({size:getComputedStyle(e).fontSize,weight:getComputedStyle(e).fontWeight})))) assert.deepEqual(header,{size:'12px',weight:'600'},path+' table heading standard')
  if(await page.locator('.resource-overview').count()) {
   assert.equal(await page.locator('.resource-overview-item').count(),4,path)
   const positions=await page.locator('.resource-overview-item').evaluateAll(es=>es.map(e=>Math.round(e.getBoundingClientRect().top)))
   assert.equal(new Set(positions).size,1,path)
  }
  for(const width of [1440,1280,900,390]){
   await page.setViewportSize({width,height:1000})
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path+' page overflow at '+width)
  }
  await page.setViewportSize({width:1440,height:1000})
  const fields=await page.locator('.resource-list-table th[data-field]').evaluateAll(es=>es.map(e=>({key:e.dataset.field,width:Math.round(e.getBoundingClientRect().width),height:e.getBoundingClientRect().height})))
  for(const field of fields.filter(f=>['phone','status','createdAt'].includes(f.key))){
   if(sharedWidths.has(field.key)) assert.equal(field.width,sharedWidths.get(field.key),path+' shared '+field.key)
   else sharedWidths.set(field.key,field.width)
  }
  for(const theme of ['light','dark']){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  }
  console.log(path+' layout passed')
 }
 emptyResults=true
 for(const path of ['/cs-customers','/cs-inquiries','/pm-history']) {
  await page.goto('http://localhost:8282'+path)
  await page.locator('.resource-overview').waitFor()
  assert.deepEqual((await page.locator('.resource-overview strong').allTextContents()).map(text=>parseInt(text,10)),[0,0,0,0])
  assert.equal((await page.locator('.list-result-count').textContent()).startsWith('총 0건'),true)
 }
 assert.deepEqual(errors,[])
 console.log('Shared columns:',Object.fromEntries(sharedWidths))
} finally {await browser.close()}
