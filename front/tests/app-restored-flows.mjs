import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],calls=[]
 let session='manager'
 page.on('pageerror',e=>errors.push(e.message))
 const facilities=Array.from({length:45},(_,i)=>({id:i+1,name:`Facility ${i+1}`,regionId:1,regionName:'부산광역시',roadAddress:'부산광역시 부산진구',latitude:35.17,longitude:129.07,currentStatus:'NORMAL',currentRiskLevel:'SAFE',riskScore:15,remainingCount:1,pendingReviewCount:0}))
 await page.route('**/api/**',r=>{
  const u=new URL(r.request().url()),path=u.pathname;calls.push({path,method:r.request().method()})
  let data=[]
  if(path==='/api/managers/me')data=session==='manager'?{id:1,name:'Manager',role:'REGIONAL_ADMIN',regions:[{id:1,name:'부산광역시'}],phone:'01012345678',email:'manager@example.com'}:null
  if(path==='/api/customers/me')data=session==='customer'?{id:2,name:'Customer',phone:'01012345678',email:'customer@example.com'}:null
  if(path==='/api/auth/logout'){session=null;data=null}
  if(path==='/api/dashboard/facility-kpi')data={facilityCount:45,blockedCount:0,pendingReviewCount:0,remainingCount:1,alertsToday:3}
  if(path==='/api/dashboard/region-risk-level')data=[{safeCount:40,warningCount:4,dangerCount:1,totalCount:45}]
  if(path==='/api/regions')data=[{id:1,name:'부산광역시'}]
  if(path==='/api/underpasses'){const size=Number(u.searchParams.get('size')||20),p=Number(u.searchParams.get('page')||1);data={items:facilities.slice((p-1)*size,p*size),page:p,totalItems:45,totalPages:Math.ceil(45/size)}}
  if(/^\/api\/underpasses\/\d+$/.test(path))data=facilities.find(f=>f.id===Number(path.split('/').at(-1)))
  if(path==='/api/customers/me/notifications')data={items:[{id:7,category:'NOTICE',title:'Test notice',body:'Notification body',read:false,createdAt:'2026-10-20T10:00:00'}],page:1,totalItems:1,totalPages:1}
  if(path==='/api/customers/me/notifications/unread-count')data={total:1,byCategory:{NOTICE:1}}
  return r.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 await page.goto(base+'/admin-app/screen-3')
 await page.locator('.app-overview .kv b').first().filter({hasText:'40'}).waitFor()
 assert.equal(await page.getByRole('navigation',{name:'관리자앱 메뉴'}).locator('a').count(),5)
 assert.equal(await page.locator('.backend-header').count(),0)
 await page.getByRole('navigation',{name:'관리자앱 메뉴'}).getByRole('link',{name:'통제',exact:true}).click()
 await page.locator('.app-facility-rows>a').nth(19).waitFor()
 assert.equal(await page.locator('.service-table').count(),0)
 await page.getByRole('button',{name:'다음',exact:true}).click()
 await page.locator('.app-facility-rows>a').first().filter({hasText:'Facility 21'}).waitFor()
 await page.locator('.app-facility-rows>a').first().click()
 await page.waitForURL('**/admin-app/screen-5?id=21')
 await page.getByRole('button',{name:'통제 시작',exact:true}).click()
 await page.locator('dialog[open]').waitFor()
 assert.equal(calls.some(c=>c.method==='POST'),false)
 await page.getByRole('button',{name:'취소',exact:true}).click()
 await page.getByRole('navigation',{name:'관리자앱 메뉴'}).getByRole('link',{name:'더보기',exact:true}).click()
 await page.locator('summary').filter({hasText:'기본 정보 수정'}).click()
 await page.getByRole('button',{name:'기본 정보 저장'}).waitFor()
 for(const [width,height] of [[1440,900],[390,844],[360,640],[844,390]]){
  await page.setViewportSize({width,height})
  const rect=await page.locator('.service-app-layout').boundingBox();assert(rect.width<=430&&rect.height===height)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
 }
 await page.getByRole('button',{name:'로그아웃',exact:true}).click()
 await page.waitForURL('**/admin-app/screen-1')
 session='customer'
 await page.goto(base+'/customer-app/screen-12')
 await page.getByRole('button',{name:/알림 1건/}).click()
 const popup=page.locator('#customer-notification-popup')
 await popup.getByText('Test notice',{exact:true}).waitFor()
 assert.equal(await popup.locator('footer a').getAttribute('href'),'/customer-app/screen-12')
 await popup.getByRole('button',{name:'알림 창 닫기'}).click()
 await page.locator('.notification-settings-details>summary').click()
 await page.getByRole('heading',{name:'알림 수신 설정'}).waitFor()
 assert.equal(await page.locator('.customer-app-nav').count(),1)
 assert.deepEqual(errors,[])
 console.log('PASS original app shell, manager five tabs/overview/list/details/settings/logout, customer notifications and responsive sizes')
}finally{await browser.close();await server.close()}
