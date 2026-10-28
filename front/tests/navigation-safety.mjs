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
  else if(u.pathname==='/api/navigation/places')data=[{name:u.searchParams.get('q'),lat:u.searchParams.get('q')==='부산역'?35.1:35.12,lng:129}]
  else if(u.pathname==='/api/navigation/route')data={distance:2200,duration:1200,path,guides,mandatory:mode!=='advisory',detoured:mode==='mandatory',blockedHazards:mode==='advisory'?[]:['초량지하차도'],advisoryHazards:mode==='advisory'?['초량지하차도']:[],message:mode==='unavailable'?'통제 구간 우회 경로를 찾지 못했습니다.':'위험 구간 우회 안내',suggestedDetour:mode==='advisory'?{distance:2500,duration:1320,path,guides,extraSec:120}:null}
  else if(u.pathname==='/api/navigation/weather')data={temperature:15,humidity:50,rainfall:0,condition:'맑음'}
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
 await popup.getByRole('button',{name:'확인',exact:true}).click()
 mode='unavailable'
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('routel-backend-event',{detail:{name:'data-changed',data:{resource:'navigation-hazard'}}})))
 await expect(popup).toContainText('안전한 우회 경로를 찾지 못했습니다')
 await expect(page.getByRole('button',{name:'안내 시작',exact:true})).toHaveCount(0)
 assert.equal(calls.filter(path=>path==='/api/navigation/directions').length,0,'Authenticated routing uses backend safety assessment')
 assert(calls.filter(path=>path==='/api/navigation/route').length>=3)
 assert.deepEqual(errors,[])
 console.log('PASS advisory detour selection, mandatory safe reroute, SSE refresh and spoken rerouting, unsafe route blocked')
}finally{await browser.close();await server.close()}
