import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage({viewport:{width:390,height:844}})
  const queries=[]
  const facilityQueries=[]
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url()),path=url.pathname
    let data={items:[],page:1,totalItems:0,totalPages:1}
    if(path==='/api/managers/me') data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:3,name:'동구'},{id:4,name:'남구'}]}
    else if(path==='/api/customers/me') data=null
    else if(path==='/api/regions') data=[{id:1,name:'중구'},{id:3,name:'동구'},{id:4,name:'남구'}]
    else if(path==='/api/underpasses') {
      facilityQueries.push(Object.fromEntries(url.searchParams))
      data={...data,items:url.searchParams.get('scope')==='MINE'?[{id:7,name:'담당 지하차도',regionId:3}]:[{id:7,name:'담당 지하차도',regionId:3},{id:8,name:'담당 외 지하차도',regionId:1}]}
    }
    if(path==='/api/plate-logs'||path==='/api/underpasses/transits') queries.push(Object.fromEntries(url.searchParams))
    return route.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  for(const path of ['/admin-app/ocr','/admin-app/reviews','/admin-app/transits','/admin-data/ocr']) {
    queries.length=0
    facilityQueries.length=0
    await page.goto(base+path)
    const select=page.locator('select').filter({has:page.locator('option[value="3"]')}).first()
    await expect(select).toHaveValue('')
    await expect.poll(()=>queries.length).toBeGreaterThan(0)
    assert(!queries[0].regionId,'Multiple assigned regions are included without forcing the first region')
    await expect(page.locator('option[value="7"]')).toHaveCount(1)
    await expect(page.locator('option[value="8"]')).toHaveCount(0)
    assert(facilityQueries.length>0&&facilityQueries.every(query=>query.scope==='MINE'),'Only assigned underpasses are requested')
  }
  await page.goto(base+'/admin-app/ocr?regionId=4')
  await expect(page.locator('select').filter({has:page.locator('option[value="4"]')}).first()).toHaveValue('4')
  queries.length=0
  await page.goto(base+'/admin-app/ocr?underpassId=7')
  await expect.poll(()=>queries.length).toBeGreaterThan(0)
  assert.equal(queries[0].underpassId,'7')
  assert(!queries[0].regionId,'Explicit facility scope is preserved')
  console.log('PASS assigned region and underpass choices across 4 record pages, explicit region and facility preserved')
} finally {await browser.close();await server.close()}
