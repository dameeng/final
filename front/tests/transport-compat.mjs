import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage(), calls=[]
 await page.route('**/api/**',r=>{
  const url=new URL(r.request().url());calls.push(url.pathname)
  if(url.pathname==='/api/cctv/1/stream')return r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPm0AAAAASUVORK5CYII=','base64')})
  return r.fulfill({json:{success:true,data:[{id:1,name:'ITS CCTV',lat:35.1,lng:129,streamUrl:'https://test.invalid/its.m3u8',distance:10}]}})
 })
 await page.route('**/map-cctv.json',r=>r.fulfill({json:[{id:2,name:'부산 CCTV',lat:35.12,lng:129,url:'https://test.invalid/city.m3u8'}]}))
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 await page.goto(base+'/tests/traffic-video-fixture.html')
 await expect(page.locator('#video-test img')).toBeVisible()
 await expect(page.locator('#video-test video')).toHaveCount(0)
 const rows=await page.evaluate(async()=>{
  const {getBusanCameras,getNearbyBusanCctvs}=await import('/src/services/busanCctv.ts')
  return {all:await getBusanCameras(),nearby:await getNearbyBusanCctvs(35.1,129)}
 })
 assert.deepEqual(rows.all.map(row=>row.name),['ITS CCTV','부산 CCTV'])
 assert.equal(rows.nearby[0].name,'ITS CCTV')
 assert(calls.includes('/api/its-cctvs/nearby'))
 await page.evaluate(()=>window.setVideoSource('/test.mp4'))
 await expect(page.locator('#video-test video')).toHaveCount(1)
 await expect(page.locator('#video-test img')).toHaveCount(0)
 console.log('PASS ITS list/nearby API with municipal cameras preserved; OCR MJPEG img and native MP4 video')
}finally{await browser.close();await server.close()}
