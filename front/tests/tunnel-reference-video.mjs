import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser = await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage(), calls=[]
  await page.route('**/tunnel-source/**', route=>{
    const id=new URLSearchParams(route.request().postData()).get('cctvId')
    calls.push(id)
    return route.fulfill({json:route.request().url().includes('getCctv-data') ? {list:[{CCTV_ID:'0121CTE02052'},{CCTV_ID:'second'}]} : {info:{CCTV_NM:id,DRC:'여의도방향',STREAMING2_ADRES:'http://211.61.148.68:1935/live/005.stream/playlist.m3u8'}}})
  })
  await page.route('https://www.seoultunnel.co.kr/**',route=>route.fulfill({status:503}))
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/traffic-layers-fixture.html?tunnel=1`)
  await page.getByText('0121CTE02052 · 여의도방향',{exact:true}).waitFor()
  assert.match(await page.locator('.reference-notice').textContent(),/실제 초량 지하차도 내부 영상과 다릅니다/)
  await page.getByLabel('영상 지점').selectOption('second')
  await page.getByText('second · 여의도방향',{exact:true}).waitFor()
  assert(calls.includes('second'))
  console.log('통과: 참고 영상 출처 안내, CCTV 목록·영상 조회, 지점 전환')
} finally {await browser.close();await server.close()}
