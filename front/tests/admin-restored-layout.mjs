import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],calls=[]
 page.on('pageerror',e=>errors.push(e.message))
 const facilities=Array.from({length:25},(_,i)=>({id:i+1,name:`Facility ${i+1}`,regionId:1,regionName:'부산광역시',latitude:35.17,longitude:129.07,currentStatus:i===0?'BLOCKED':'NORMAL',currentRiskLevel:i===24?'DANGER':'SAFE',riskScore:i===24?78:12,remainingCount:2,pendingReviewCount:0,roadAddress:`부산광역시 ${i===24?'해운대구':'부산진구'} 테스트로 1`}))
 await page.route('**/api/**',async r=>{
  const u=new URL(r.request().url()),path=u.pathname;calls.push({path,method:r.request().method(),body:r.request().postData()})
  let data=[]
  if(path==='/api/customers/me')data=null
  if(path==='/api/managers/me')data={id:1,name:'Manager',role:'REGIONAL_ADMIN',regions:[{id:1,name:'Busan'}]}
  if(path==='/api/regions')data=[{id:1,name:'Busan'}]
  if(path==='/api/underpasses'){const size=Number(u.searchParams.get('size')||20),p=Number(u.searchParams.get('page')||1);data={items:facilities.slice((p-1)*size,p*size),page:p,totalItems:25,totalPages:Math.ceil(25/size)}}
  if(/^\/api\/underpasses\/\d+$/.test(path))data=facilities.find(f=>f.id===Number(path.split('/').at(-1)))
  if(path==='/api/dashboard/facility-kpi')data={facilityCount:25,blockedCount:1,dangerLevelCount:1,pendingReviewCount:1,remainingCount:2,alertsToday:3}
  if(path==='/api/dashboard/risk-margin')data=[{underpassId:25,underpassName:'Facility 25',riskScore:78,margin:2}]
  if(path==='/api/plate-logs')data={items:[{id:7,underpassName:'Facility 1',detectedNum:'12A3456',reviewStatus:'PENDING',reviewDeadline:new Date(Date.now()+60000).toISOString()}],page:1,totalItems:1,totalPages:1}
  if(path==='/api/customers')data={items:[{id:2,name:'Customer',email:'customer@example.com',carNums:[]}],page:1,totalItems:1,totalPages:1}
  if(path==='/api/notices')data={items:[],page:1,totalItems:0,totalPages:1}
  await r.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 await page.goto(base+'/fac-list')
 await page.locator('#tbl tbody tr').nth(19).waitFor()
 assert.equal(await page.locator('#tbl tbody tr').count(),20)
 await page.getByRole('button',{name:'다음',exact:true}).click()
 await page.locator('.row-open').filter({hasText:'Facility 25'}).waitFor()
 await page.getByRole('button',{name:'위험',exact:true}).click()
 await page.locator('#tbl tbody tr').first().filter({hasText:'Facility 25'}).waitFor()
 assert.equal(await page.locator('#tbl tbody tr').count(),1)
 await page.locator('.row-open').click()
 const dialog=page.locator('dialog[open]')
 await dialog.waitFor();assert.equal(await dialog.evaluate(el=>el.classList.contains('restored-summary-drawer')),true)
 await page.getByRole('button',{name:'닫기',exact:true}).click()
 await page.goto(base+'/fac-detail?id=1')
 await page.getByRole('navigation',{name:'지하차도 상세 탭'}).waitFor()
 await page.locator('.restored-overview-grid .card').nth(3).waitFor()
 await page.getByRole('link',{name:'설정',exact:true}).click()
 await page.getByRole('button',{name:'시설 정보 수정',exact:true}).click()
 await page.locator('dialog[open] input').first().waitFor()
 assert.equal(await page.locator('dialog[open] input').first().inputValue(),'Facility 1')
 await page.getByRole('button',{name:'취소',exact:true}).click()
 await page.goto(base+'/fac-list')
 await page.locator('#tbl tbody tr').nth(19).waitFor()
 await page.getByRole('button',{name:'전체',exact:true}).click()
 await page.locator('#tbl tbody tr').nth(19).waitFor()
 await page.locator('.control-action').first().click()
 await page.locator('dialog[open]').waitFor()
 assert.equal(calls.some(c=>c.method==='POST'),false,'control requires confirmation')
 await page.getByRole('button',{name:'취소',exact:true}).click()
 await page.goto(base+'/verify')
 await page.locator('.restored-review-grid .pcard').waitFor()
 await page.getByRole('button',{name:'맞음',exact:true}).click()
 await page.locator('dialog[open] input').waitFor()
 assert.equal(await page.locator('dialog[open] input').inputValue(),'12A3456')
 await page.getByRole('button',{name:'취소',exact:true}).click()
 await page.goto(base+'/cs-customers');await page.getByRole('navigation',{name:'고객 서비스 탭'}).waitFor()
 await page.goto(base+'/admin-dashboard');await page.locator('.fixed-summary .tile').nth(4).waitFor()
 await page.locator('.handover-x').click()
 const district=page.getByRole('combobox',{name:'부산 구·군 선택',exact:true})
 assert.equal(await district.locator('option').count(),17)
 await district.selectOption('해운대구')
 assert.equal(await page.locator('.underpass-map-table').count(),0)
 await page.getByRole('region',{name:'선택 시설',exact:true}).waitFor()
 await district.selectOption('중구')
 await page.getByText('조회 조건에 맞는 지하차도가 없습니다.',{exact:true}).waitFor()
 await page.getByRole('button',{name:'부산 전체 보기',exact:true}).click()
 assert.equal(await district.inputValue(),'')
 assert.equal(await page.locator('.dashboard-bottom .dashboard-fixed-item').count(),4)
 await page.screenshot({path:'tests/admin-restored-desktop.png',fullPage:true})
 for(const width of [390,768,1366]){
  await page.setViewportSize({width,height:844})
  for(const path of ['/fac-list','/fac-detail?id=1','/verify','/cs-customers','/admin-dashboard']){
   await page.goto(base+path);await page.locator('.backend-main').waitFor();await page.waitForTimeout(100)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`overflow ${path} ${width}`)
  }
 }
 assert.deepEqual(errors,[])
 console.log('PASS original facility table/drawer, pagination/risk filtering across pages, review cards, customer tabs, dashboard widgets, responsive widths and no accidental control writes')
}finally{await browser.close();await server.close()}
