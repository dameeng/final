import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname
  let data={items:[],page:1,totalItems:0,totalPages:1}
  if(path==='/api/managers/me')data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:1,name:'동구'}]}
  else if(path==='/api/customers/me')data=null
  else if(path==='/api/underpasses/7')data={id:7,name:'초량지하차도',regionId:1,currentRiskLevel:'SAFE',currentStatus:'NORMAL',roadAddress:'부산광역시 동구',heightM:4.7,lanes:4}
  else if(path==='/api/underpasses/7/cameras')data=[{id:227,cameraRole:'FINAL_LPR',streamUrl:'/api/cctv/227/stream'}]
  else if(path==='/api/regions')data=[]
  else if(path.endsWith('/urgent')||path.endsWith('/device-tokens'))data=[]
  else if(path==='/api/pm/equipments/15')data={equipment:{equipId:15,name:'P-7-1',type:'PUMP',underpassId:7,underpassName:'초량지하차도',score:20,level:'SAFE'},detail:{features:[],extra:{}},cautionMin:40,dangerMin:70,topCauses:[],recentActions:[]}
  else if(path.endsWith('/scores'))data=[]
  else if(path.endsWith('/sensor-trend'))data={points:[],band:null}
  return r.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 for(const width of [320,430]){
  await page.setViewportSize({width,height:900})
  let headerBounds
  for(const path of ['/admin-app/screen-5?id=7','/admin-app/screen-9','/admin-app/screen-10?id=15','/admin-app/screen-11','/admin-app/history','/admin-app/notifications','/admin-app/screen-14','/admin-app/pm-settings','/admin-app/pm-daily']){
   await page.goto(base+path)
   await page.locator('.app-restored-body').waitFor()
   const metrics=await page.evaluate(()=>{
    const body=document.querySelector('.app-restored-body'),style=getComputedStyle(body)
    const header=document.querySelector('.manager-app-header').getBoundingClientRect()
    const buttons=[...body.querySelectorAll('.pm-head-actions>a,.pm-detail-actions>button,.pm-detail-actions>a,.service-filters button,.pm-settings-card button,.account-panel button')].filter(el=>el.getClientRects().length)
    const cards=[...body.querySelectorAll('.app-facility-detail>.app-facility-summary,.app-facility-detail>.app-facility-metrics,.app-facility-detail>.app-facility-records')]
    return {cardGaps:cards.slice(1).map((el,i)=>el.getBoundingClientRect().top-cards[i].getBoundingClientRect().bottom),padding:[style.paddingTop,style.paddingLeft,style.paddingRight],header:{x:header.x,y:header.y,width:header.width,height:header.height},overflow:body.scrollWidth>body.clientWidth+1,buttons:buttons.map(el=>({text:el.textContent,height:el.getBoundingClientRect().height,font:getComputedStyle(el).fontSize}))}
   })
   assert.deepEqual(metrics.padding,['16px','16px','16px'],path+' shared page padding')
   if(!headerBounds)headerBounds=metrics.header
   else assert.deepEqual(metrics.header,headerBounds,path+' header stays fixed')
   assert(!metrics.overflow,path+' no horizontal overflow')
   for(const gap of metrics.cardGaps)assert(Math.abs(gap-24)<1,path+' card sections use a 24px gap')
   for(const button of metrics.buttons){assert(button.height>=44,path+' '+button.text+' touch height');assert.equal(button.font,'13px',path+' button typography')}
  }
 }
 await page.setViewportSize({width:1440,height:1000})
 await page.goto(base+'/fac-detail?id=7&tab=overview')
 const tabs=page.getByRole('navigation',{name:'지하차도 상세 탭'})
 await expect(tabs).toBeVisible()
 let position
 for(const label of ['개요','설비','전광판','CCTV','설정']){
  await tabs.getByRole('link',{name:label,exact:true}).click()
  await expect(tabs.getByRole('link',{name:label,exact:true})).toHaveAttribute('aria-current','page')
  const sizes=await tabs.locator('a').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height}}))
  assert(sizes.every(size=>size.height===44),'All facility tabs have the same height')
  assert(Math.max(...sizes.map(s=>s.width))-Math.min(...sizes.map(s=>s.width))<1,'All tabs have equal widths: '+JSON.stringify(sizes))
  const box=await tabs.boundingBox()
  if(!position)position={x:box.x,y:box.y}
  else assert.deepEqual({x:box.x,y:box.y},position,'Tabs do not move between facility pages')
 }
 assert.deepEqual(errors,[])
 console.log('PASS nine manager pages at 320/430px: shared padding, fixed header, action button geometry; five web facility tabs keep equal size and position')
}finally{await browser.close();await server.close()}
