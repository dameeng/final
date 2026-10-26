import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
let server
try { await fetch('http://localhost:8282') } catch { server=await createServer({configLoader:'runner'});await server.listen() }
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  let reviewed=false
  const apiCalls=[]
  const result=()=>({id:21,eventId:71,cameraId:null,detected:true,confidence:0.87,detectionCount:3,frameSeconds:12.2,analyzedAt:'2026-10-25T14:32:00',modelVersion:'test-model',reviewStatus:reviewed?'FALSE_POSITIVE':'PENDING',imageUrl:'/api/pm/road-results/21/image',eventStatus:reviewed?'ETC':'CHECK_NEEDED'})
  const road=()=>({equipId:901,name:'R-1-1',type:'ROAD',underpassName:'초량지하차도',score:null,level:null,scoreChange7d:null,lastReceivedAt:'2026-10-25T14:32:00',reasons:[],openEventId:reviewed?null:71,openEventStatus:reviewed?null:'CHECK_NEEDED',sparkline:[],roadStatus:reviewed?'오탐 확인':'싱크홀 의심'})
  await page.route('**/api/**',async route=>{
    const req=route.request(),u=new URL(req.url());apiCalls.push(u.pathname);let data={}
    if(u.pathname==='/api/customers/me')return route.fulfill({status:401,json:{success:false}})
    if(u.pathname==='/api/managers/me')data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:4,name:'동구'}]}
    else if(u.pathname==='/api/pm/equipments') {
      const pump={equipId:902,name:'P-1-1',type:'PUMP',underpassName:'초량지하차도',score:45,level:'CAUTION',openEventId:null,openEventStatus:null,reasons:[],sparkline:[]}
      const items=u.searchParams.has('level')?[]:u.searchParams.get('size')==='100'?[road(),pump]:[road()]
      data={items,page:1,size:10,totalItems:items.length,totalPages:1}
    }
    else if(u.pathname==='/api/pm/equipments/901')data={equipment:road(),detail:null,cautionMin:null,dangerMin:null,lastCheckedAt:null,recentActions:[],modelVersion:null,scoredAt:null,anomalyStartedAt:null,topCauses:[]}
    else if(u.pathname==='/api/pm/equipments/902')data={equipment:{equipId:902,name:'P-1-1',type:'PUMP',underpassName:'초량지하차도',score:45,level:'CAUTION',openEventId:null},detail:null,cautionMin:40,dangerMin:70,lastCheckedAt:null,recentActions:[],modelVersion:'pump',scoredAt:null,anomalyStartedAt:null,topCauses:[]}
    else if(u.pathname.endsWith('/scores'))data=[]
    else if(u.pathname.endsWith('/sensor-trend'))data={column:'vibration',points:[],band:null}
    else if(u.pathname.endsWith('/thresholds'))data={threshold:null,history:[]}
    else if(u.pathname==='/api/pm/equipments/901/road/review') { assert.equal(req.postDataJSON().verdict,'FALSE_POSITIVE');reviewed=true;data={equipId:901,name:'R-1-1',underpassName:'초량지하차도',state:'오탐 확인',current:result(),history:[result()]} }
    else if(u.pathname==='/api/pm/equipments/901/road')data={equipId:901,name:'R-1-1',underpassName:'초량지하차도',state:reviewed?'오탐 확인':'싱크홀 의심',current:result(),history:[result()]}
    else if(u.pathname.endsWith('/image'))return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')})
    else if(u.pathname==='/api/pm/events')data={items:[],page:1,size:1,totalItems:reviewed?0:1,totalPages:1}
    else if(u.pathname==='/api/pm/engine-status')data={status:'NORMAL',lastReceivedAt:null,equipmentTotal:4,sensorStale:0}
    else if(u.pathname==='/api/stream')return route.fulfill({contentType:'text/event-stream',body:': test\n\n'})
    else if(/notifications|device-tokens/.test(u.pathname))data=[]
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto('http://localhost:8282/pm-equipment')
  await page.getByRole('heading',{name:'장비 현황',exact:true}).waitFor()
  await page.getByRole('combobox',{name:'종류',exact:true}).selectOption('ROAD')
  await page.getByRole('button',{name:'확인 필요',exact:true}).click()
  await page.locator('.road-panel img').waitFor()
  assert.equal(new URL(page.url()).pathname,'/pm-equipment-detail')
  assert.equal(new URL(page.url()).searchParams.get('id'),'901')
  await page.getByRole('heading',{name:'노면 상태',exact:true}).waitFor()
  await page.getByRole('heading',{name:'분석 이력',exact:false}).waitFor()
  assert(!apiCalls.some(p=>/901\/(scores|sensor-trend|thresholds)$/.test(p)),'ROAD must not request sensor-risk graphs')
  assert.match(await page.locator('.road-panel').innerText(),/초량지하차도/)
  assert.match(await page.locator('.road-panel').innerText(),/87.0%/)
  await page.getByRole('button',{name:'오탐 처리',exact:true}).click()
  await page.locator('.road-state').filter({hasText:'오탐 확인'}).waitFor()
  assert(reviewed)
  assert.equal(await page.getByRole('button',{name:'오탐 처리',exact:true}).count(),0)
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900})
    assert.equal(await page.locator('.road-panel').evaluate(el=>el.scrollWidth>el.clientWidth+2),false)
  }
  await page.setViewportSize({width:1440,height:1000})
  await page.getByRole('button',{name:'다음 설비 ›',exact:true}).click()
  await page.waitForURL('**/pm-equipment-detail?id=902')
  await page.getByRole('heading',{name:'위험 점수',exact:true}).waitFor()
  assert.equal(await page.locator('.road-panel').count(),0)
  await page.getByRole('button',{name:'‹ 이전 설비',exact:true}).click()
  await page.waitForURL('**/pm-equipment-detail?id=901')
  await page.locator('.road-panel img').waitFor()
  await page.getByRole('link',{name:'← 목록으로',exact:true}).click()
  await page.waitForURL('**/pm-equipment')
  await page.locator('tr').filter({hasText:'R-1-1'}).click()
  await page.waitForURL('**/pm-equipment-detail?id=901')
  await page.locator('.road-panel img').waitFor()
  await page.goto('http://localhost:8282/pm-equipment?road=901')
  await page.waitForURL('**/pm-equipment-detail?id=901')
  await page.locator('.road-panel img').waitFor()
  assert.deepEqual(errors,[])
  console.log('ROAD detail navigation, shared layout, verdict, adjacent equipment and legacy links passed')
} finally { await browser.close();await server?.close() }
