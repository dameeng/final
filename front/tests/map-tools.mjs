import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
let server
try{await fetch('http://localhost:8282')}catch{server=await createServer({configLoader:'runner'});await server.listen()}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['geolocation'],geolocation:{latitude:35.1796,longitude:129.0756}})
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://localhost:8282/c-map');await page.waitForFunction(()=>document.querySelector('.preview-map-status')?.hidden)
 await page.locator('.map-weather-marker').click();await page.getByRole('region',{name:'인근 날씨 상세'}).waitFor()
 assert.match(await page.locator('.map-weather-overview').innerText(),/18.2/)
 await page.getByRole('button',{name:'날씨 상세 닫기'}).click()
 await page.locator('#lst .it').nth(2).click()
 await page.locator('.map-weather-marker').click()
 assert.match(await page.locator('.map-weather-detail header').innerText(),/우장춘/)
 assert.match(await page.locator('.map-weather-overview').innerText(),/18.4/)
 await page.getByRole('button',{name:'날씨 상세 닫기'}).click()
 await page.evaluate(()=>{window.zoomChanges=[];const original=window.kakao.maps.Map.prototype.setLevel;window.kakao.maps.Map.prototype.setLevel=function(level,...rest){window.zoomChanges.push({before:this.getLevel(),after:level});return original.call(this,level,...rest)}})
 await page.getByRole('button',{name:'카카오 지도 확대',exact:true}).click()
 await page.getByRole('button',{name:'카카오 지도 축소',exact:true}).click()
 const changes=await page.evaluate(()=>window.zoomChanges)
 assert.equal(changes[0].after,changes[0].before-1);assert.equal(changes[1].after,changes[1].before+1)
 await page.getByRole('button',{name:'내 위치 찾기',exact:true}).click()
 await page.getByRole('img',{name:'내 현재 위치'}).waitFor()
 await page.locator('.customer-menu-link').first().hover()
 const cols=await page.locator('.header-dropdown-column').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right}}))
 for(let i=1;i<cols.length;i++)assert(cols[i].x-cols[i-1].right>=24)
 for(const width of [390,360]){await page.setViewportSize({width,height:1000});await page.mouse.move(5,500);await page.locator('.map-weather-marker').click();const panel=await page.locator('.map-weather-detail').boundingBox();assert(panel.x>=0&&panel.x+panel.width<=width);await page.getByRole('button',{name:'날씨 상세 닫기'}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)}
 assert.deepEqual(errors,[])
 console.log('PASS weather popup and facility data, real zoom +/- controls, geolocation marker, menu gaps, mobile widths, no runtime errors')
}finally{await browser.close();await server?.close()}
