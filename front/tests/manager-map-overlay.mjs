import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],calls=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{
  const handlers=new WeakMap(),emit=(target,type,data)=>(handlers.get(target)?.[type]||[]).forEach(fn=>fn(data))
  const event={addListener(target,type,fn){const all=handlers.get(target)||{};(all[type]??=[]).push(fn);handlers.set(target,all)},removeListener(){}}
  class MapStub{constructor(host,options){this.host=host;this.center=options.center;this.level=options.level;window.managerMap=this;host.style.background='#dce8ef'}setZoomable(){}getCenter(){return this.center}setCenter(p){this.center=p}panTo(p){this.center=p}getLevel(){return this.level}setLevel(v){this.level=v}setBounds(bounds){this.bounds=bounds.points;this.level=11}relayout(){}}
  class Marker{constructor(options){this.options=options;this.el=document.createElement('button');this.el.className='test-map-marker';this.el.textContent=options.title;Object.assign(this.el.style,{position:'absolute',top:'160px',left:options.title.includes('Facility 1')?'100px':options.title.includes('Facility 2')?'240px':'380px'});options.map.host.append(this.el);this.el.onclick=()=>emit(this,'click')}setMap(value){if(!value)this.el.remove()}}
  class MarkerClusterer{constructor(options){this.map=options.map;window.openManagerCluster=()=>emit(this,'clusterclick',{getMarkers:()=>this.markers.slice(0,2)})}clear(){this.markers=[]}addMarkers(markers){this.markers=markers;window.managerMarkers=markers}redraw(){}}
  class LatLng{constructor(lat,lng){this.lat=lat;this.lng=lng}}
  class LatLngBounds{constructor(){this.points=[]}extend(p){this.points.push(p)}}
  class MarkerImage{};class Size{};class Point{};class InfoWindow{close(){}open(){}setContent(){}}
  window.kakao={maps:{Map:MapStub,Marker,MarkerClusterer,LatLng,LatLngBounds,MarkerImage,Size,Point,InfoWindow,event,load:fn=>fn()}}
 })
 const rows=[{id:1,name:'Facility 1',regionId:1,regionName:'부산광역시',roadAddress:'부산광역시 중구 중앙대로',latitude:35.104,longitude:129.03,currentStatus:'NORMAL',currentRiskLevel:'WARNING',riskScore:55,remainingCount:2,pendingReviewCount:1},{id:2,name:'Facility 2',regionId:1,regionName:'부산광역시',roadAddress:'부산광역시 서구 충무대로',latitude:35.11,longitude:129.02,currentStatus:'BLOCKED',currentRiskLevel:'DANGER',riskScore:80,remainingCount:0,pendingReviewCount:0},{id:3,name:'Facility 3',regionId:1,regionName:'부산광역시',roadAddress:'부산광역시 해운대구 해운대로',latitude:35.16,longitude:129.16,currentStatus:'NORMAL',currentRiskLevel:'SAFE',riskScore:20,remainingCount:0,pendingReviewCount:0}]
 await page.route('**/api/**',r=>{
  const url=new URL(r.request().url()),path=url.pathname;calls.push({path,method:r.request().method()})
  let data=[]
  if(path==='/api/customers/me')data=null
  if(path==='/api/managers/me')data={id:7,name:'Manager',role:'REGIONAL_ADMIN',regions:[{id:8,name:'중구'},{id:9,name:'서구'}]}
  if(path==='/api/underpasses')data={items:rows,page:1,totalItems:3,totalPages:1}
  if(/^\/api\/underpasses\/\d+$/.test(path))data=rows.find(row=>row.id===Number(path.split('/').at(-1)))
  if(path.endsWith('/risk-scores'))data=[{riskScore:55,rainfallMm:2,predictedAt:new Date().toISOString()}]
  if(path==='/api/navigation/weather')data={temperature:16,condition:'맑음',humidity:60,rainfall:0,observedAt:new Date().toISOString()}
  if(path==='/api/dashboard/facility-kpi')data={facilityCount:3,blockedCount:1,dangerLevelCount:1,pendingReviewCount:1,remainingCount:2,alertsToday:0}
  return r.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 await page.goto(base+'/admin-dashboard')
 await page.locator('.handover-x').click()
 await page.locator('.test-map-marker').nth(2).waitFor()
 assert.equal(await page.locator('.map-sidebar,.underpass-map-table,.live-cluster-list').count(),0)
 const initial=await page.evaluate(()=>({bounds:window.managerMap.bounds,level:window.managerMap.level}))
 assert.equal(initial.bounds.length,2,'initial bounds use the two assigned districts')
 assert(initial.bounds.every(p=>p.lng<129.04));assert(initial.level<=6,'initial assigned view is closer')
 await page.locator('.test-map-marker').filter({hasText:'Facility 1'}).click()
 const panel=page.getByRole('region',{name:'선택 시설',exact:true})
 await panel.locator('.manager-facility-heading').getByText('Facility 1',{exact:true}).waitFor()
 await panel.getByText('16°C',{exact:false}).waitFor()
 await panel.getByRole('button',{name:'상세 접기 ▴',exact:true}).click()
 assert.equal(await panel.locator('.manager-panel-body').isVisible(),false)
 await page.locator('.test-map-marker').filter({hasText:'Facility 2'}).click()
 assert.equal(await panel.locator('.manager-panel-body').isVisible(),true,'marker selection expands details')
 await panel.getByRole('button',{name:'통제 해제',exact:true}).click()
 await page.locator('dialog[open]').waitFor()
 assert.equal(calls.some(c=>c.method==='POST'),false,'control still requires confirmation')
 await page.getByRole('button',{name:'취소',exact:true}).click()
 const district=page.getByRole('combobox',{name:'부산 구·군 선택',exact:true})
 await district.selectOption('해운대구')
 await page.locator('.test-map-marker').filter({hasText:'Facility 3'}).waitFor()
 assert.equal(await page.locator('.test-map-marker').count(),1)
 await page.getByRole('button',{name:'담당 지역 보기',exact:true}).click()
 await page.waitForFunction(()=>window.managerMap.bounds.length===2)
 await page.evaluate(()=>window.openManagerCluster())
 await panel.getByRole('heading',{name:'묶음 시설 2곳',exact:true}).waitFor()
 await panel.getByRole('button',{name:'Facility 1',exact:false}).click()
 await panel.locator('.manager-facility-heading').getByText('Facility 1',{exact:true}).waitFor()
 for(const width of [1600,768,390]){
  await page.setViewportSize({width,height:844})
  await page.locator('.test-map-marker').filter({hasText:'Facility 1'}).click()
  const outer=await page.locator('.manager-map-stage').boundingBox(),inner=await panel.boundingBox()
  assert(inner.x>=outer.x&&inner.y>=outer.y&&inner.x+inner.width<=outer.x+outer.width+1&&inner.y+inner.height<=outer.y+outer.height+1,'details stay over the map')
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
  if(width===390)assert((await page.getByRole('button',{name:'담당 지역 보기',exact:true}).boundingBox()).height<=46,'toolbar labels stay on one line')
 }
 await page.screenshot({path:'tests/manager-overlay-preview.png',fullPage:true})
 assert.deepEqual(errors,[])
 console.log('PASS map overlay details/collapse/marker selection, confirmation preserved, assigned bounds/closer zoom, district filtering, return to assigned area and responsive overlay bounds')
}finally{await browser.close();await server.close()}
