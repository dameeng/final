import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],calls=[]
 page.on('pageerror',e=>errors.push(e.message))
 let failRead=true,deleted=false,urgent=[{id:80,title:'펌프 긴급 점검',body:'배수펌프 위험 진입',category:'EQUIPMENT',urgent:true,read:false,createdAt:'2026-10-28T12:00:00'}]
 const equipment={equipId:15,name:'P-1-1',type:'PUMP',underpassId:1,underpassName:'초량지하차도',cautionMin:40,dangerMin:70}
 const handover={id:null,written:false,shiftId:1,shiftName:'오전 근무',shiftDate:'2026-10-28',authorName:'홍길동',managerId:1,windowStart:'2026-10-28T06:00:00',windowEnd:'2026-10-28T14:00:00',summary:{counts:{block:8,riskUp:4,pmChecked:3,pmPending:9},staff:[{managerId:1,name:'홍길동',total:6,block:2,release:1,plateReview:0,pmAction:3,displayEdit:0,transfer:0,inquiryAnswer:0}],activities:[{at:'2026-10-28T12:00:00',category:'점검',content:'배수펌프 점검 완료',actor:'홍길동'}]}}
 await page.route('**/api/**',r=>{
  const url=new URL(r.request().url()),path=url.pathname,method=r.request().method(),body=r.request().postDataJSON()
  calls.push({path,method,body,query:Object.fromEntries(url.searchParams)})
  let data={items:[],page:1,size:10,totalItems:0,totalPages:1}
  if(path==='/api/managers/me')data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:1,name:'동구'}]}
  else if(path==='/api/customers/me')data=null
  else if(path.endsWith('/notifications/urgent'))data=urgent
  else if(path.endsWith('/unread-count'))data={total:1}
  else if(path.endsWith('/80/read')){
   if(failRead){failRead=false;return r.fulfill({status:500,json:{success:false,message:'일시 오류'}})}
   urgent=[];data=null
  }
  else if(path==='/api/underpasses')data={...data,items:[{id:1,name:'초량지하차도',regionId:1},{id:2,name:'다른 지역 시설',regionId:2}],totalItems:2}
  else if(path==='/api/pm/thresholds')data=method==='PUT'?[equipment]:{...data,items:deleted?[]:[equipment],totalItems:deleted?0:1}
  else if(path==='/api/pm/equipments'&&method==='POST')data={...equipment,equipId:16,name:'P-1-2'}
  else if(path==='/api/pm/equipments/15'&&method==='DELETE'){deleted=true;data=null}
  else if(path==='/api/pm/reports/daily')data={date:'2026-10-28',generatedAt:'2026-10-28T12:00:00',summary:{byType:[{type:'CCTV',total:3,safe:2,caution:0,danger:1,noData:0},{type:'PUMP',total:4,safe:2,caution:2,danger:0,noData:0}],levelCounts:{safe:4,caution:2,danger:1,noData:0},previousLevelCounts:{safe:3,caution:3,danger:1,noData:0},recommended:Array.from({length:7},(_,i)=>({...equipment,equipId:i+15,name:"P-1-"+(i+1)})),newEventCount:0,actionCount:0,openEventCount:0}}
  else if(path==='/api/pm/reports/daily/pdf')return r.fulfill({contentType:'application/pdf',body:Buffer.from('%PDF-1.4\n%%EOF')})
  else if(path==='/api/shift-handovers/previous'||path==='/api/shift-handovers/preview')data=handover
  else if(path==='/api/shift-handovers'&&method==='POST')data={...handover,id:9,written:true,memo:body.memo}
  else if(path==='/api/shift-handovers/9/memo')data={...handover,id:9,written:true,memo:body.memo}
  else if(path==='/api/managers/me/device-tokens')data=method==='GET'?[{id:1,platform:'APP',active:true}]:null
  return r.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 await page.goto(base+'/admin-app/pm-settings')
 const popup=page.locator('.manager-urgent-alert')
 await expect(popup).toBeVisible()
 await popup.getByRole('button',{name:'확인하고 닫기',exact:true}).click()
 await expect(popup).toContainText('일시 오류')
 await expect(popup).toBeVisible()
 await popup.getByRole('button',{name:'확인하고 닫기',exact:true}).click()
 await expect(popup).toBeHidden()
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('routel:push-token',{detail:{token:'test-issued-token',platform:'APP'}})))
 await expect.poll(()=>calls.some(c=>c.path==='/api/managers/me/device-tokens'&&c.method==='POST')).toBe(true)
 await expect(page.locator('.pm-settings-list')).toContainText('P-1-1')
 await expect(page.locator('.pm-settings-list-heading')).toBeVisible()
 await expect(page.locator('.pm-settings-list-heading')).toContainText('총 1건')
 const settingsRow=await page.locator('.pm-settings-list>li').first().evaluate(el=>({height:el.getBoundingClientRect().height,actionHeight:el.querySelector('.equipment-delete').getBoundingClientRect().height}))
 assert(settingsRow.height<180,'App equipment rows stay compact: '+settingsRow.height)
 assert(settingsRow.actionHeight>=44,'Compact rows preserve touch target height')
 await expect(page.locator('.pm-settings-list .row-actions')).toHaveCount(0)
 await page.locator('.pm-settings-list>li').first().click({position:{x:8,y:65}})
 await expect(page).toHaveURL(/\/admin-app\/screen-10\?id=15$/)
 await page.goBack()
 await expect(page.locator('.pm-settings-list')).toContainText('P-1-1')
 await page.getByRole('checkbox',{name:'P-1-1 선택'}).check()
 await page.getByLabel('주의 시작 점수').fill('45')
 await page.getByLabel('위험 시작 점수').fill('75')
 await page.getByRole('button',{name:'기준 저장',exact:true}).click()
 await expect.poll(()=>calls.some(c=>c.path==='/api/pm/thresholds'&&c.method==='PUT')).toBe(true)
 assert.deepEqual(calls.find(c=>c.path==='/api/pm/thresholds'&&c.method==='PUT').body,{equipIds:[15],cautionMin:45,dangerMin:75})
 await page.getByRole('button',{name:'설비 등록',exact:true}).click()
 await expect(page.getByLabel('등록 지하차도',{exact:true}).locator('option')).toHaveText(['선택','초량지하차도'])
 await expect(page.locator('.service-filters select').first().locator('option')).toHaveText(['전체','초량지하차도'])
 await page.getByLabel('등록 지하차도',{exact:true}).selectOption('1')
 await page.getByRole('button',{name:'등록',exact:true}).click()
 await expect.poll(()=>calls.some(c=>c.path==='/api/pm/equipments'&&c.method==='POST')).toBe(true)
 assert.deepEqual(calls.find(c=>c.path==='/api/pm/equipments'&&c.method==='POST').body,{underpassId:1,type:'PUMP'})
 await page.getByRole('button',{name:'설비 삭제',exact:true}).click()
 assert.equal(calls.filter(c=>c.method==='DELETE').length,0,'Deletion waits for explicit confirmation')
 await page.locator('.pm-delete-dialog').getByRole('button',{name:'삭제',exact:true}).click()
 await expect(page.locator('.pm-delete-dialog')).toBeHidden()
 await expect.poll(()=>calls.some(c=>c.path==='/api/pm/equipments/15'&&c.method==='DELETE')).toBe(true)
 await page.goto(base+'/admin-app/pm-daily')
 await expect(page.getByRole('heading',{name:'점검 권장 설비'})).toBeVisible()
 await expect(page.locator('.pm-daily-live')).toContainText('P-1-1')
 const recommended=page.locator('.daily-section').nth(1)
 await expect(recommended.locator('li')).toHaveCount(3)
 await recommended.locator('.app-number-pagination button').filter({hasText:'2'}).click()
 await expect(recommended).toContainText('P-1-4')
 await expect(recommended).not.toContainText('P-1-1')
 const download=page.waitForEvent('download')
 await page.getByRole('button',{name:'PDF 다운로드',exact:true}).click()
 await download
 await page.goto(base+'/shift-report')
 await expect(page.locator('.handover-live-summary')).toContainText('8건')
 await expect(page.locator('.handover-live-summary')).toContainText('홍길동 · 6건')
 await expect(page.locator('.handover-live-summary')).toContainText('배수펌프 점검 완료')
 await page.getByRole('button',{name:'인수인계 작성',exact:true}).click()
 await expect(page.getByLabel('인수인계 메모')).toBeVisible()
 await page.getByLabel('인수인계 메모').fill('잔여 설비 점검을 이어 주세요.')
 await page.getByRole('button',{name:'인수인계 저장',exact:true}).click()
 await expect(page.getByRole('button',{name:'메모 수정',exact:true})).toBeVisible()
 await page.getByLabel('인수인계 메모').fill('수정한 인수인계')
 await page.getByRole('button',{name:'메모 수정',exact:true}).click()
 await expect.poll(()=>calls.some(c=>c.path==='/api/shift-handovers/9/memo'&&c.body.memo==='수정한 인수인계')).toBe(true)
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('routel-backend-event',{detail:{name:'notification-new',data:{id:81,title:'실시간 긴급',body:'긴급',category:'RISK',urgent:true,read:false}}})))
 await expect(popup).toContainText('실시간 긴급')
 await popup.getByRole('button',{name:'확인하고 닫기',exact:true}).click()
 await expect(popup).toBeHidden()
 urgent=[{id:82,title:'재연결 긴급',body:'복구',category:'RISK',urgent:true,read:false}]
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('routel-backend-event',{detail:{name:'connected',data:{}}})))
 await expect(popup).toContainText('재연결 긴급')
 await popup.getByRole('button',{name:'확인하고 닫기',exact:true}).click()
 await expect(popup).toBeHidden()
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('routel:push-token',{detail:{token:'test-issued-token',platform:'APP'}})))
 await expect.poll(()=>calls.filter(c=>c.path==='/api/managers/me/device-tokens'&&c.method==='POST').length).toBeGreaterThan(1)
 urgent=[]
 for(const width of [320,430]) {
  await page.setViewportSize({width,height:844})
  for(const path of ['/admin-app/pm-settings','/admin-app/pm-daily']) {
   await page.goto(base+path)
   await expect(page.locator('.pm-admin-tools .service-filters')).toBeVisible()
   for(const theme of ['light','dark']) {
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
    const layout=await page.locator('.pm-admin-tools').evaluate(el=>{
     const box=el.getBoundingClientRect(),filter=el.querySelector('.service-filters'),control=filter.querySelector('select,input'),action=el.querySelector('.service-actions button')
     return {width:box.width,overflow:el.scrollWidth>el.clientWidth+1,filterRadius:getComputedStyle(filter).borderRadius,controlHeight:control.getBoundingClientRect().height,actionWidth:action.getBoundingClientRect().width}
    })
    assert(!layout.overflow,path+' fits '+width+'px '+theme)
    assert.equal(layout.filterRadius,'14px')
    assert.equal(layout.controlHeight,44)
    assert(Math.abs(layout.actionWidth-layout.width)<2,'Primary page action fills app content width')
   }
  }
 }
 await page.setViewportSize({width:1600,height:1000})
 const geometry=[]
 for(const path of ['/pm-settings','/pm-daily']) {
  await page.goto(base+path)
  await expect(page.locator('.pm-admin-tools')).toBeVisible()
  if(path==='/pm-settings') {
   await expect(page.locator('.pm-settings-table')).toBeVisible()
   await expect(page.locator('.pm-settings-list')).toHaveCount(0)
  } else {
   await expect(page.locator('.daily-web-section table')).toHaveCount(2)
   await expect(page.locator('.daily-distribution-row')).toHaveCount(2)
   const chartSegments=await page.locator('.daily-distribution-row').first().locator('.daily-distribution-track>span').evaluateAll(es=>es.map(el=>el.style.width))
   assert.deepEqual(chartSegments,['50%','0%','25%','0%'],'Distribution chart uses actual counts against the same maximum')
   await expect(page.locator('.daily-section')).toHaveCount(0)
   for(const label of ['미수신 설비','처리 중인 점검','점검 기록','신규 점검 대기','점검 권장 설비']) {
    await page.getByRole('navigation',{name:'리포트 기록 구분'}).getByRole('button',{name:new RegExp(label)}).click()
    await expect(page.locator('.daily-web-grid h2')).toHaveText(label)
    await expect(page.locator('.daily-web-grid table')).toHaveCount(1)
   }
   await expect(page.locator('.daily-web-grid tbody tr')).toHaveCount(5)
   await page.getByRole('navigation',{name:'리포트 기록 페이지'}).getByRole('button',{name:'다음'}).click()
   await expect(page.locator('.daily-web-grid tbody tr')).toHaveCount(2)
   await expect(page.locator('.daily-web-grid')).toContainText('P-1-6')
   const groups=await page.locator('.daily-web-grid').evaluate(el=>({width:el.getBoundingClientRect().width,boxes:[...el.children].map(child=>{const r=child.getBoundingClientRect();return {left:r.left,top:r.top,bottom:r.bottom,width:r.width}})}))
   assert(groups.boxes.every(box=>Math.abs(box.width-groups.width)<1),'Daily report tables use full width')
   assert(groups.boxes.every((box,i)=>i===0||Math.abs(box.top-groups.boxes[i-1].bottom-24)<1),'Report sections have consistent 24px spacing')
  }
  const size=await page.locator('.pm-admin-tools').evaluate(el=>{
   const box=el.getBoundingClientRect(),heading=el.querySelector('.service-heading').getBoundingClientRect(),button=el.querySelector('.service-actions button').getBoundingClientRect()
   return {x:box.x,width:box.width,titleTop:heading.top,buttonRight:button.right,buttonHeight:button.height}
  })
  assert.equal(size.buttonHeight,44)
  assert(Math.abs(size.buttonRight-size.x-size.width)<2,'Header action aligns with content right edge')
  geometry.push(size)
 }
 assert.equal(geometry[1].width,geometry[0].width,'Daily report shares the administrator workspace width')
 assert.equal(geometry[1].x,geometry[0].x,'Daily report shares the administrator left alignment')
 assert.equal(geometry[0].titleTop,geometry[1].titleTop)
 const tokenPosts=calls.filter(c=>c.path==='/api/managers/me/device-tokens'&&c.method==='POST').length
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('routel:push-token',{detail:{token:'test-issued-token',platform:'APP'}})))
 await expect.poll(()=>calls.filter(c=>c.path==='/api/managers/me/device-tokens'&&c.method==='POST').length).toBeGreaterThan(tokenPosts)
 await page.getByRole('button',{name:'로그아웃',exact:true}).click()
 await expect.poll(()=>calls.some(c=>c.path==='/api/managers/me/device-tokens'&&c.method==='DELETE'&&c.query.token==='test-issued-token')).toBe(true)
 await expect.poll(()=>calls.some(c=>c.path==='/api/auth/logout')).toBe(true)
 assert(calls.findIndex(c=>c.path==='/api/managers/me/device-tokens'&&c.method==='DELETE')<calls.findIndex(c=>c.path==='/api/auth/logout'),'Token deactivates before session logout')
 assert.deepEqual(errors,[])
 console.log('PASS urgent initial/SSE/reconnect/retry, PM thresholds/register/delete-confirmation, daily PDF, handover staff/actor/create/memo')
}finally{await browser.close();await server.close()}
