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
  class MarkerImage{constructor(src){this.src=src}};class Size{};class Point{};class InfoWindow{close(){}open(){}setContent(){}}
  window.kakao={maps:{Map:MapStub,Marker,MarkerClusterer,LatLng,LatLngBounds,MarkerImage,Size,Point,InfoWindow,event,load:fn=>fn()}}
 })
 const rows=[{id:1,manageable:true,name:'Facility 1',regionId:1,regionName:'부산광역시',roadAddress:'부산광역시 중구 중앙대로',latitude:35.104,longitude:129.03,currentStatus:'NORMAL',currentRiskLevel:'WARNING',riskScore:55,remainingCount:2,pendingReviewCount:1},{id:2,manageable:true,name:'Facility 2',regionId:1,regionName:'부산광역시',roadAddress:'부산광역시 서구 충무대로',latitude:35.11,longitude:129.02,currentStatus:'BLOCKED',currentRiskLevel:'DANGER',riskScore:80,remainingCount:0,pendingReviewCount:0},{id:3,manageable:false,name:'Facility 3',regionId:1,regionName:'부산광역시',roadAddress:'부산광역시 해운대구 해운대로',latitude:35.16,longitude:129.16,currentStatus:'NORMAL',currentRiskLevel:'SAFE',riskScore:20,remainingCount:0,pendingReviewCount:0}]
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


 await page.setViewportSize({width:390,height:844})
 await page.goto(base+'/admin-app/screen-3')
 let baseline
 for(const path of ['/admin-app/screen-3','/admin-app/screen-4','/admin-app/screen-9','/admin-app/screen-13','/admin-app/screen-14']){
  if(path.endsWith('screen-11')){await page.getByRole('button',{name:/3/}).last().click()}else await page.getByRole('navigation',{name:'\uAD00\uB9AC\uC790\uC571 \uBA54\uB274'}).locator(`a[href="${path}"]`).click()
  await page.waitForURL('**'+path)
  const nav=page.locator('.admin-app-bottom-nav');await nav.waitFor()
  const geometry=await nav.evaluate(el=>({height:el.getBoundingClientRect().height,bottom:el.getBoundingClientRect().bottom,items:[...el.querySelectorAll('a')].map(a=>{const b=a.getBoundingClientRect(),svg=a.querySelector('svg').getBoundingClientRect(),label=a.querySelector('span').getBoundingClientRect();return {width:b.width,height:b.height,svgWidth:svg.width,svgHeight:svg.height,labelHeight:label.height,weight:getComputedStyle(a).fontWeight}})}))
  assert.equal(geometry.height,64);assert.equal(geometry.bottom,844)
  for(const item of geometry.items){assert.equal(item.svgWidth,22);assert.equal(item.svgHeight,22);assert.equal(item.height,63);assert.equal(item.labelHeight,16);assert.equal(item.weight,'500')}
  if(baseline)assert.deepEqual(geometry,baseline,'menu geometry remains identical on '+path);else baseline=geometry
  assert.equal(await nav.locator('[aria-current=page]').count(),1)
 }
 assert.deepEqual(errors,[])
 console.log('PASS admin app icons: 22px SVG, 64px navigation, fixed labels/weight, identical dimensions across API and original screens including selected states')
}finally{await browser.close();await server.close()}
