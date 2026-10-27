import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage(),requests=[]
 page.on('request',r=>requests.push(r.url()))
 await page.route('**/api/underpasses/*/cameras',route=>{
  const id=Number(new URL(route.request().url()).pathname.split('/')[3])
  return route.fulfill({json:{success:true,data:id===7?[
   {id:227,underpassId:7,name:'초량 입구',streamUrl:'/stream/227'},
   {id:999,underpassId:8,name:'다른 시설',streamUrl:'/stream/999'},
  ]:[]}})
 })
 await page.route('**/api/cctv/*/stream?*',route=>route.fulfill({status:503,body:'영상 정지 상태'}))
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/facility-cctv-dialog-fixture.html`)
 await page.getByRole('button',{name:'내부 CCTV 보기',exact:true}).click()
 const dialog=page.locator('dialog[open]')
 await expect(dialog.getByRole('heading',{name:'초량지하차도 CCTV',exact:true})).toBeVisible()
 await expect(dialog.locator('select option')).toHaveCount(1)
 await expect(dialog.locator('select')).toHaveValue('227')
 await expect.poll(()=>requests.some(url=>url.includes('/api/cctv/227/stream'))).toBe(true)
 await expect(dialog).not.toContainText('신월여의')
 assert(!requests.some(url=>/seoultunnel|seoul-tunnel|usage\/getCctv/.test(url)))
 await dialog.getByRole('button',{name:'내부 CCTV 창 닫기'}).click()
 await page.getByRole('button',{name:'시설 변경',exact:true}).click()
 await page.getByRole('button',{name:'내부 CCTV 보기',exact:true}).click()
 await expect(dialog.getByRole('heading',{name:'북항지하차도 CCTV',exact:true})).toBeVisible()
 await expect(dialog).toContainText('북항지하차도에 등록된 CCTV가 없습니다.')
 await expect(dialog.locator('video,img')).toHaveCount(0)
 console.log('PASS selected facility title, scoped camera/stream, no Seoul fallback, empty facility resets playback')
} finally {await browser.close();await server.close()}
