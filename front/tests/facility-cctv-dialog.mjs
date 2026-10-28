import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage(),requests=[]
 page.on('request',r=>requests.push(r.url()))
 await page.route('**/tunnel-source/**',r=>{
  if(r.request().url().includes('getCctvInfo')) {
   const id=new URLSearchParams(r.request().postData()).get('cctvId')
   return r.fulfill({json:{info:{CCTV_ID:id,CCTV_NM:'Tunnel '+id,DRC:'Entrance',STREAMING2_ADRES:'https://www.seoultunnel.co.kr/live/'+id+'.m3u8'}}})
  }
  return r.fulfill({json:{list:[{CCTV_ID:'A'},{CCTV_ID:'B'}]}})
 })
 await page.route('https://www.seoultunnel.co.kr/live/**',r=>r.fulfill({status:503,body:'Offline'}))
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/facility-cctv-dialog-fixture.html`)
 await page.locator('.tunnel-cctv-trigger').click()
 const dialog=page.locator('dialog[open]')
 await expect(dialog.locator('h2')).toContainText('CCTV')
 await expect(dialog.locator('.tunnel-cctv-source-note')).toContainText('\uC2E0\uC6D4\uC5EC\uC758')
 await expect(dialog.locator('select option')).toHaveCount(2)
 await expect(dialog.locator('.tunnel-cctv-player h3')).toContainText('Tunnel A')
 await dialog.locator('select').selectOption('B')
 await expect(dialog.locator('.tunnel-cctv-player h3')).toContainText('Tunnel B')
 assert(!requests.some(url=>/api\/underpasses\/.*\/cameras/.test(url)))
 await dialog.locator('.tunnel-cctv-close').click()
 await expect(page.locator('dialog[open]')).toHaveCount(0)
 console.log('PASS internal CCTV restores Seoul tunnel list, camera switching and closes playback without facility camera lookup')
}finally{await browser.close();await server.close()}
