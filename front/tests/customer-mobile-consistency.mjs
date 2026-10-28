import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage({viewport:{width:430,height:932}})
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.addInitScript(()=>{
    const handlers=new WeakMap()
    const event={addListener(target,type,fn){const all=handlers.get(target)||{};(all[type]??=[]).push(fn);handlers.set(target,all)},removeListener(){},preventMap(){}}
    class LatLng{constructor(lat,lng){this.lat=lat;this.lng=lng}getLat(){return this.lat}getLng(){return this.lng}}
    class Map{constructor(host,opts){this.host=host;this.center=opts.center;this.level=opts.level}getCenter(){return this.center}setCenter(p){this.center=p}panTo(p){this.center=p}getBounds(){return {getSouthWest:()=>new LatLng(35,129),getNorthEast:()=>new LatLng(35.5,129.5)}}getLevel(){return this.level}setLevel(n){this.level=n}setBounds(){}relayout(){}setZoomable(){}getProjection(){return {containerPointFromCoords:()=>({x:210,y:350})}}}
    class Marker{constructor(opts){this.opts=opts;window.testFacilityMarker=()=>{(handlers.get(this)?.click||[]).forEach(fn=>fn())}}setMap(){}getPosition(){return this.opts.position}}
    class MarkerClusterer{constructor(){}clear(){}addMarkers(){}redraw(){}}
    class InfoWindow{close(){}open(){}setContent(){}}
    class Bounds{extend(){}}
    window.kakao={maps:{Map,Marker,MarkerClusterer,InfoWindow,LatLng,LatLngBounds:Bounds,MarkerImage:class{},Size:class{},Point:class{},event,load:fn=>fn()}}
  })
  const facilities=Array.from({length:45},(_,i)=>({id:i+1,name:'지하차도 '+(i+1),roadAddress:'부산광역시 동구',regionName:'동구',latitude:35.1+i*.001,longitude:129.1,currentRiskLevel:'SAFE',currentStatus:'NORMAL',updatedAt:'2026-10-28T12:00:00'}))
  await page.route('**/api/**',r=>{
    const path=new URL(r.request().url()).pathname
    let data={items:[],totalItems:0,totalPages:1,page:1}
    if(path==='/api/customers/me')data={id:1,name:'고객',loginId:'customer01',role:'customer'}
    else if(path==='/api/managers/me')data=null
    else if(path==='/api/underpasses')data={items:facilities,totalItems:45,totalPages:1,page:1}
    else if(/^\/api\/underpasses\/\d+$/.test(path))data=facilities[Number(path.split('/').at(-1))-1]
    else if(path.endsWith('/risk-scores'))data=[]
    else if(path.includes('/popular'))data=[]
    return r.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  for(const width of [430,360]) {
    await page.setViewportSize({width,height:932})
    let baseline
    for(const path of ['/customer-app/screen-5','/customer-app/screen-7','/customer-app/screen-13','/customer-app/notices']) {
      await page.goto(base+path)
      const header=page.locator('.customer-mobile-header')
      await expect(header).toBeVisible()
      for(const theme of ['light','dark']) {
        await page.evaluate(value=>document.documentElement.dataset.theme=value,theme)
        const toggle=header.locator('.theme-toggle')
        await toggle.focus()
        await toggle.hover()
        await expect(toggle).toHaveCSS('height','40px')
        await expect(toggle).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
      }
      const bell=header.getByRole('button',{name:/^알림/})
      await expect(bell).toBeVisible()
      const bellBox=await bell.boundingBox(),themeBox=await header.locator('.theme-toggle').boundingBox()
      assert(bellBox.width>=36&&bellBox.x+bellBox.width<=themeBox.x,'notification bell remains visible beside theme control')
      const geometry=await header.evaluate(el=>{const t=el.querySelector('.customer-header-title'),box=el.getBoundingClientRect(),text=t.getBoundingClientRect(),style=getComputedStyle(t);return {height:box.height,titleY:text.y-box.y,centerOffset:Math.round(text.x+text.width/2-box.x-box.width/2),font:style.fontFamily,size:style.fontSize,weight:style.fontWeight}})
      baseline??=geometry
      assert.deepEqual(geometry,baseline,path+' consistent header')
      assert.equal(geometry.centerOffset,0,path+' title is centered in the whole header')
    }
  }
  await page.goto(base+'/customer-app/screen-5')
  await page.getByRole('button',{name:/목록 펼치기/}).click()
  await expect(page.locator('.facility-list-panel .lst .it')).toHaveCount(45)
  await expect(page.locator('.app-number-pagination,.customer-list-pagination')).toHaveCount(0)
  await expect.poll(()=>page.locator('.facility-list-panel .lst').evaluate(el=>{el.scrollTop=1000;return {scroll:el.scrollTop>0,height:el.clientHeight>0,overflow:el.scrollHeight>el.clientHeight}})).toEqual({scroll:true,height:true,overflow:true})
  await page.getByRole('button',{name:/목록 접기/}).click()
  await page.evaluate(()=>window.testFacilityMarker())
  const card=page.locator('.routel-map-popup')
  await expect(card).toBeVisible()
  await expect(page).toHaveURL(base+'/customer-app/screen-5')
  await expect(page.locator('.swapped-detail')).toHaveCount(0)
  await card.locator('.routel-map-popup__title').click()
  await expect(page).toHaveURL(/\/customer-app\/screen-6\?id=/)
  await page.goto(base+'/customer-app/screen-13')
  await page.getByRole('button',{name:'AI 도우미'}).click()
  const composer=page.locator('.public-chat-form')
  await expect(composer).toBeVisible()
  const layout=await composer.evaluate(el=>{
    const box=el.getBoundingClientRect(),host=el.closest('.app-account-body').getBoundingClientRect(),input=el.querySelector('input').getBoundingClientRect(),button=el.querySelector('button').getBoundingClientRect()
    return {sameWidth:Math.abs(box.width-host.width)<1,inBounds:box.left>=host.left&&box.right<=host.right+1&&box.bottom<=host.bottom+1,aligned:Math.abs(input.y-button.y)<1&&Math.abs(input.height-button.height)<1,box:box.toJSON(),host:host.toJSON(),input:input.toJSON(),button:button.toJSON()}
  })
  await page.screenshot({path:'test-results/customer-chat-composer.png'})
  assert(layout.sameWidth&&layout.inBounds&&layout.aligned,'chat composer fills app width with aligned input and send button')
  await expect(composer.getByRole('link',{name:'FAQ',exact:true})).toHaveAttribute('href','/customer-app/faq')
  assert.deepEqual(errors,[])
  console.log('PASS customer headers, full scrolling list, marker summary then detail, app chat composer and app links')
} finally {await browser.close();await server.close()}
