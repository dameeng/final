import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
let browser
try{
 browser=await chromium.launch({channel:'msedge',headless:true})
 const page=await browser.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{
  const handlers=new WeakMap()
  const event={addListener(target,type,callback){const listeners=handlers.get(target)||{};(listeners[type]??=[]).push(callback);handlers.set(target,listeners)},removeListener(){}}
  const emit=(target,type,data)=>(handlers.get(target)?.[type]||[]).forEach(fn=>fn(data))
  window.markerImages=[]
  class MapStub{constructor(host,options){this.host=host;this.center=options.center;this.level=options.level}setZoomable(){}getCenter(){return this.center}setCenter(value){this.center=value}panTo(value){this.center=value}getLevel(){return this.level}setLevel(value){this.level=value}setBounds(){}relayout(){}}
  class Marker{constructor(options){this.options=options}setMap(){}}
  class MarkerImage{constructor(src,size,offset){this.src=src;this.size=size;this.offset=offset;window.markerImages.push({src,size,offset})}}
  class MarkerClusterer{
   constructor(options){this.map=options.map;this.styles=options.styles;window.previewMarkerGroups=specs=>{const groups=specs.map(spec=>{const content=document.createElement('div');content.textContent=String(spec.count);return {content,getMarkers:()=>Array(spec.count).fill(this.markers[spec.index]),getClusterMarker:()=>({getContent:()=>content})}});emit(this,'clustered',groups);return groups.map(group=>group.content.outerHTML)}}
   clear(){this.map.host.querySelectorAll('.sdk-cluster').forEach(el=>el.remove())}
   addMarkers(markers){this.markers=markers;this.redraw()}
   redraw(){
    this.clear();if(!this.markers?.length)return
    const groups=[this.markers.slice(0,3),this.markers.slice(3)]
    const clusters=groups.filter(group=>group.length>1).map(group=>{
     const el=document.createElement('button');el.className='sdk-cluster';el.textContent=String(group.length);Object.assign(el.style,this.styles[0],{position:'absolute',top:'160px',left:group.length===3?'100px':'200px'});this.map.host.append(el)
     const cluster={getMarkers:()=>group,getCenter:()=>new LatLng(35.12,129.1),getClusterMarker:()=>({getContent:()=>el})}
     el.onclick=()=>emit(this,'clusterclick',cluster)
     return cluster
    })
    emit(this,'clustered',clusters)
   }
  }
  class LatLng{constructor(lat,lng){this.lat=lat;this.lng=lng}getLat(){return this.lat}getLng(){return this.lng}}
  class LatLngBounds{extend(){}}
  class Size{constructor(width,height){this.width=width;this.height=height}}
  class Point{constructor(x,y){this.x=x;this.y=y}}
  class InfoWindow{close(){this.content?.remove()}open(map){if(this.content){Object.assign(this.content.style,{position:'absolute',top:'210px',left:'80px',zIndex:20});map.host.append(this.content)}}setContent(content){this.content?.remove();this.content=content}setPosition(position){window.popupPosition=position}}
  window.kakao={maps:{Map:MapStub,Marker,MarkerImage,MarkerClusterer,LatLng,LatLngBounds,Size,Point,InfoWindow,event,load:callback=>callback()}}
 })
 let facilityCount=5
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname
  const rows=Array.from({length:facilityCount},(_,i)=>({id:i+1,name:`시설 ${i+1}`,regionName:'부산광역시',roadAddress:'부산광역시 동구',latitude:35.1+i*.01,longitude:129.1,currentStatus:i===0?'BLOCKED':'NORMAL',currentRiskLevel:i===2?'DANGER':i===3?'주의':'안전'}))
  return route.fulfill({json:{success:true,data:path==='/api/underpasses'?{items:rows,page:1,totalPages:1,totalItems:facilityCount}:null}})
 })
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/c-map`)
 await page.waitForFunction(()=>document.querySelectorAll('.sdk-cluster').length===2)
 assert.equal(await page.locator('[aria-label="마커 색상 안내"]').getByText('미확인',{exact:true}).count(),0)

 for(const cluster of await page.locator('.sdk-cluster').all()){
  const svg=cluster.locator('svg');assert.equal(await svg.count(),1)
  const number=svg.locator('text');assert.equal(await number.getAttribute('x'),'22');assert.equal(await number.getAttribute('y'),'22');assert.equal(await number.getAttribute('text-anchor'),'middle')
  assert.equal(await svg.locator('circle[stroke-dasharray]').count(),1)
  assert.equal(await svg.locator('circle[fill-opacity]').getAttribute('r'),'16')
  assert(Number(await svg.locator('circle[fill-opacity]').getAttribute('fill-opacity'))>=.94)
  assert.equal(await cluster.evaluate(el=>getComputedStyle(el).padding),'0px')
 }
 const images=await page.evaluate(()=>window.markerImages.map(image=>decodeURIComponent(image.src.split(',')[1])))
 for(const svg of images){assert(svg.includes('stroke-dasharray="3 3"'));assert(svg.includes('r="16"'));assert(svg.includes('fill-opacity="0.940"'))}
 await page.locator('.sdk-cluster').first().click()
 const popup=page.locator('.routel-cluster-popup');await popup.waitFor()
 assert.equal(await page.locator('.sdk-cluster.routel-marker-selected').count(),1)
 const selected=page.locator('.sdk-cluster.routel-marker-selected circle.selected')
 assert.equal(await selected.getAttribute('stroke'),'#174f88');assert.equal(await selected.evaluate(el=>getComputedStyle(el).animationName),'selection')
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await selected.evaluate(el=>getComputedStyle(el).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'})
 await popup.locator('.routel-cluster-popup__item').first().click();await page.locator('.swapped-detail').waitFor()
 assert(await page.evaluate(()=>window.markerImages.some(image=>decodeURIComponent(image.src.split(',')[1]).includes('class="selected"'))),'single selection uses the same animated ring')
 await page.locator('.routel-map-popup__title').click()
 assert.equal(await page.locator('.routel-map-popup').count(),1,'clicking inside keeps popup open')
 await page.getByRole('button',{name:'지도 확대',exact:true}).click()
 assert.equal(await page.locator('.routel-map-popup').count(),0,'outside click closes the popup')
 assert.equal(await page.locator('.swapped-detail').count(),1,'detail selection remains available')
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('routel-backend-event',{detail:{name:'risk-update',data:{underpassId:1,riskScore:42,riskLevel:'ALERT',predictedAt:new Date().toISOString()}}})))
 await page.waitForTimeout(200)
 assert.equal(await page.locator('.routel-map-popup').count(),0,'live redraw does not reopen a dismissed popup')
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/marker-unified-qa.png'})
 assert.deepEqual(errors,[])
 console.log('PASS markers: centered SVG counts, uniform dashed rings/inset, 94-100% opacity, cluster and individual selection, reduced motion')
}finally{await browser?.close();await server.close()}
