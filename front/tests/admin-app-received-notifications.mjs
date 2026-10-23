import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}), calls=[], errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.addInitScript(()=>localStorage.setItem('routel-session-kind','manager'))
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname
  calls.push({path,method:route.request().method()})
  let data=[]
  if(path==='/api/managers/me')data={id:7,name:'Manager',role:'REGIONAL_ADMIN',regions:[]}
  if(path==='/api/managers/me/notifications')data={items:[{id:21,category:'RISK',title:'자동 위험 알림',body:'시설 위험 상태 변경',read:false,createdAt:'2026-10-23T09:00:00'}],page:1,size:20,totalItems:1,totalPages:1}
  if(path.endsWith('unread-count'))data={count:1}
  return route.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 for(const path of ['/admin-app/notifications','/admin-app/screen-13']) {
  await page.goto(base+path)
  await page.waitForURL('**/admin-app/notifications')
  await page.getByRole('heading',{name:'내 관리자 알림',exact:true}).waitFor()
  await page.locator('.service-table td[data-label="제목"]').filter({hasText:'자동 위험 알림'}).waitFor()
  assert.equal(await page.locator('.admin-app-bottom-nav').getByRole('link',{name:'알림',exact:true}).getAttribute('href'),'/admin-app/notifications')
  assert.equal(await page.locator('.admin-app-bottom-nav').getByRole('link',{name:'알림',exact:true}).getAttribute('aria-current'),'page')
  for(const label of ['차량 번호','고객 번호','시작일','종료일'])assert.equal(await page.getByText(label,{exact:true}).count(),0)
  assert.equal(await page.getByRole('link',{name:'알림 발송 기록',exact:true}).count(),0)
 }
 assert(calls.some(call=>call.path==='/api/managers/me/notifications'))
 assert(!calls.some(call=>call.path==='/api/alert-logs'))
 assert(!calls.some(call=>call.method==='POST'))
 assert.deepEqual(errors,[])
 console.log('PASS admin app: notification tab opens received notifications, legacy route redirects, no dispatch-log filters or send requests')
} finally {await browser.close();await server.close()}
