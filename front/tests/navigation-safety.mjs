import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],calls=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{
  class LatLng {constructor(lat,lng){this.lat=lat;this.lng=lng}getLat(){return this.lat}getLng(){return this.lng}}
  class Map {constructor(host,options){this.center=options.center}getCenter(){return this.center}setCenter(p){this.center=p}panTo(p){this.center=p}setLevel(){}setBounds(){}setCursor(){}setZoomable(){}relayout(){}}
  class Shape {setMap(){}setPosition(){}}
  class Bounds {extend(){}}
  window.kakao={maps:{Map,LatLng,LatLngBounds:Bounds,Polyline:Shape,Marker:Shape,CustomOverlay:Shape,event:{addListener(){},removeListener(){}}}}
  window.spoken=[]
  Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(message){window.spoken.push(message.text)}}})
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}}
 })
 let mode='advisory'
 const path=[[35.1,129],[35.11,129],[35.12,129]]
 const guides=[{lat:35.11,lng:129,name:'교차로',text:'직진',at:1000}]
 await page.route('**/api/**',r=>{
  const u=new URL(r.request().url());calls.push(u.pathname)
  let data=null
  if(u.pathname==='/api/customers/me')data={id:1,name:'고객'}
  else if(u.pathname==='/api/navigation/places')data=[{name:u.searchParams.get('q'),lat:u.searchParams.get('q')==='부산 동구청'?35.1:35.12,lng:129}]
  else if(u.pathname==='/api/navigation/route')data={distance:2200,duration:1200,path,guides,mandatory:mode!=='advisory',detoured:mode==='mandatory',blockedHazards:mode==='advisory'?[]:['초량지하차도'],advisoryHazards:mode==='advisory'?['초량지하차도']:[],message:mode==='unavailable'?'통제 구간 우회 경로를 찾지 못했습니다.':'위험 구간 우회 안내',suggestedDetour:mode==='advisory'?{distance:2500,duration:1320,path,guides,extraSec:120}:null}
  else if(u.pathname==='/api/navigation/weather')data={temperature:15,humidity:50,rainfall:0,condition:'맑음'}
  else if(u.pathname==='/api/navigation/directions')data=[{result_code:0,summary:{distance:5000,duration:1500},sections:[{roads:[{vertexes:[129,35.1,129.02,35.1,129.02,35.12,129,35.12]}],guides:[]}]}]
  else if(u.pathname.endsWith('/unread-count'))data={total:0}
  return r.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 await page.goto(base+'/customer-app/screen-7')
 await page.locator('.directions-form .btn.p').click()
 const popup=page.locator('.navigation-safety-dialog')
 await expect(popup).toBeVisible()
 await expect(popup).toContainText('2분 추가')
 await popup.getByRole('button',{name:'우회 경로 선택'}).click()
 await expect(popup).toBeHidden()
 await expect(page.locator('.navigation-route-options button').nth(1)).toHaveAttribute('aria-pressed','true')
 await page.locator('.navigation-demo-controls select').first().selectOption('demo')
 await page.getByRole('button',{name:'안내 시작',exact:true}).click()
 await page.getByRole('button',{name:'음성 안내 꺼짐',exact:true}).click()
 mode='mandatory'
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('routel-backend-event',{detail:{name:'data-changed',data:{resource:'navigation-hazard'}}})))
 await expect(popup).toBeVisible()
 await expect(popup).toContainText('통제 구간을 피하는 경로입니다')
 await expect.poll(()=>page.evaluate(()=>window.spoken.some(text=>text.includes('재탐색')))).toBe(true)
 await expect(popup).toContainText('초량지하차도 통제 중')
 for(const theme of ['light','dark']) {
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
   await expect(popup).toHaveCSS('background-color','rgb(25, 41, 59)')
   await expect(popup.locator('.navigation-blocked-instruction')).toHaveCSS('background-color','rgb(59, 48, 62)')
 }
 await expect(popup).toContainText('진입하지 말고 우회')
 await expect(popup.getByRole('button',{name:'기존 경로 유지'})).toHaveCount(0)
 await popup.getByRole('button',{name:'우회 경로로 안내 시작',exact:true}).click()
 await expect(popup).toBeHidden()
 await expect(page.locator('.navigation-detour-banner')).toContainText('초량지하차도')
 mode='unavailable'
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('routel-backend-event',{detail:{name:'data-changed',data:{resource:'navigation-hazard'}}})))
 await expect(popup).toContainText('안전한 우회 경로를 찾지 못했습니다')
 await expect(popup.getByRole('button',{name:'경로 다시 찾기',exact:true})).toBeVisible()
 await expect(popup.getByRole('button',{name:'우회 경로로 안내 시작',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'안내 시작',exact:true})).toHaveCount(0)
 mode='mandatory'
 await popup.getByRole('button',{name:'경로 다시 찾기',exact:true}).click()
 await expect(popup.getByRole('button',{name:'우회 경로로 안내 시작',exact:true})).toBeVisible()
 await popup.getByRole('button',{name:'우회 안내 닫기',exact:true}).click()
 const beforeControl=calls.filter(path=>path==='/api/navigation/route').length
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('routel-backend-event',{detail:{name:'control-change',data:{underpassId:1,status:'BLOCKED'}}})))
 await expect.poll(()=>calls.filter(path=>path==='/api/navigation/route').length).toBeGreaterThan(beforeControl)
 assert.equal(calls.filter(path=>path==='/api/navigation/directions').length,0,'Authenticated routing uses backend safety assessment')
 assert(calls.filter(path=>path==='/api/navigation/route').length>=3)
 await expect(popup).toBeVisible()
 await popup.getByRole('button',{name:'우회 경로로 안내 시작',exact:true}).click()
 await page.getByRole('button',{name:'주행 중 통제 발생',exact:true}).click()
 await expect(popup).toContainText('전방 시연 구간 통제 중')
 await expect(popup).toContainText('실제 시설 통제에는 영향을 주지 않습니다')
 await popup.getByRole('button',{name:'우회 경로로 안내 시작',exact:true}).click()
 await expect(popup).toBeHidden()
 await expect(page.getByRole('button',{name:'안내 종료',exact:true})).toBeVisible()
 await page.goto(base+'/customer-app/screen-7')
 await expect(page.locator('.directions-form input').first()).toHaveValue('부산 동구청')
 await expect(page.locator('.directions-form input').nth(1)).toHaveValue('부산 오페라하우스')
 await page.getByRole('button',{name:'시연 바로 시작',exact:true}).click()
 await popup.getByRole('button',{name:'우회 경로로 안내 시작',exact:true}).click()
 await expect(page.getByRole('button',{name:'안내 종료',exact:true})).toBeVisible()
 await expect(page.locator('.navigation-demo-controls select').first()).toHaveValue('demo')
 assert.deepEqual(errors,[])
 console.log('PASS advisory detour selection, mandatory safe reroute, SSE refresh and spoken rerouting, unsafe route blocked')
}finally{await browser.close();await server.close()}
