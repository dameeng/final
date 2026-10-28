import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage({viewport:{width:430,height:932}})
  let empty=false
  const byType=[{type:'CCTV',total:3,safe:3,caution:0,danger:0,noData:0},{type:'PUMP',total:5,safe:2,caution:1,danger:1,noData:1},{type:'WATER',total:10,safe:0,caution:0,danger:0,noData:10}]
  await page.route('**/api/**',r=>{
    const path=new URL(r.request().url()).pathname
    let data=[]
    if(path==='/api/managers/me')data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[]}
    else if(path==='/api/customers/me')data=null
    else if(path==='/api/pm/reports/daily')data={generatedAt:'2026-10-28T14:00:00',summary:{byType:empty?[]:byType,neverReceived:2,levelCounts:{safe:5,caution:1,danger:1,noData:11}}}
    return r.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  for(const width of [430,320]) {
    await page.setViewportSize({width,height:932})
    await page.goto(base+'/admin-app/pm-daily')
    await expect(page.locator('.daily-mobile-chart-row')).toHaveCount(3)
    await expect(page.locator('.daily-mobile-chart-total')).toContainText('18')
    const segments=await page.locator('.daily-mobile-chart-row').nth(1).locator('.daily-mobile-chart-track>span').evaluateAll(els=>els.map(el=>el.style.width))
    assert.deepEqual(segments,['20%','10%','10%','10%'],'stacked segment widths follow actual counts on one scale')
    await expect(page.locator('.daily-mobile-chart-row').nth(1).getByRole('img')).toHaveAttribute('aria-label',/안전 2대, 주의 1대, 위험 1대, 미수신 1대/)
    for(const theme of ['light','dark']) {
      await page.evaluate(t=>document.documentElement.dataset.theme=t,theme)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width} ${theme} no horizontal overflow`)
      await page.locator('.daily-mobile-chart').scrollIntoViewIfNeeded()
      await page.locator('.daily-mobile-chart').screenshot({path:`test-results/pm-daily-chart-${width}-${theme}.png`})
    }
  }
  empty=true
  await page.reload()
  await expect(page.locator('.daily-mobile-chart-empty')).toBeVisible()
  await expect(page.locator('.daily-mobile-chart-row')).toHaveCount(0)
  console.log('PASS mobile daily chart: real counts, mixed states, shared scale, accessible labels, light/dark at 320/430 and empty state')
} finally {await browser.close();await server.close()}
