import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const base=server.resolvedUrls.local[0].replace(/\/$/,'')
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],writes=[]
 page.on('pageerror',error=>errors.push(error.message))
 let session=null
 const profile={id:2,name:'고객',loginId:'tester',phone:'01012345678',email:'test@example.com'}
 const facilities=[{id:1,name:'Facility 1',regionId:1,regionName:'부산광역시',roadAddress:'부산광역시 중구',latitude:35.104,longitude:129.03,currentStatus:'NORMAL',currentRiskLevel:'SAFE',riskScore:20},{id:2,name:'Facility 2',regionId:2,regionName:'부산광역시',roadAddress:'부산광역시 서구',latitude:35.11,longitude:129.02,currentStatus:'NORMAL',currentRiskLevel:'SAFE',riskScore:20}]
 await page.route('**/api/**',async r=>{
  const req=r.request(),url=new URL(req.url()),path=url.pathname;let data=[]
  if(req.method()!=='GET')writes.push({path,method:req.method()})
  if(path==='/api/customers/me')data=session==='customer'?profile:null
  if(path==='/api/customers/login'){session='customer';data=profile}
  if(path==='/api/managers/me')data=session==='manager'?{id:7,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:1,name:'부산광역시'}]}:null
  if(path.includes('/check-'))data={available:true}
  if(path==='/api/customers/me'&&req.method()==='PUT'){Object.assign(profile,req.postDataJSON());data=profile}
  if(path==='/api/underpasses')data={items:facilities,page:1,totalItems:2,totalPages:1}
  if(/^\/api\/underpasses\/\d+$/.test(path))data=facilities.find(f=>f.id===Number(path.split('/').at(-1)))
  if(path==='/api/faqs')data={items:[{id:1,question:'질문입니다'}],page:1,totalPages:1,totalItems:1}
  if(path==='/api/faqs/1')data={id:1,question:'질문입니다',answer:'답변입니다'}
  if(path==='/api/alert-logs')data={items:[],page:1,totalPages:1,totalItems:0}
  if(path==='/api/auth/logout'){session=null;data=null}
  await r.fulfill({json:{success:true,data}})
 })
 await page.goto(base+'/signup')
 await page.getByLabel('휴대전화',{exact:true}).fill('01012345678')
 await page.locator('.auth-service button[type=submit]').click()
 await page.getByLabel('인증번호',{exact:true}).fill('123456')
 await page.locator('.auth-service button[type=submit]').click()
 await page.getByRole('heading',{name:'필수 입력사항'}).waitFor()
 assert.equal(await page.locator('.required-star').first().innerText(),'*')
 await page.getByRole('button',{name:'직접 입력',exact:true}).click()
 await page.getByLabel('생년월일 직접 입력').fill('1990-01-02')
 await page.getByLabel('이메일',{exact:true}).fill('tester@example.com')
 await page.getByLabel('이메일 도메인 선택').selectOption('gmail.com')
 assert.equal(await page.getByLabel('이메일',{exact:true}).inputValue(),'tester@gmail.com')
 const pass=await page.locator('.auth-field-password').boundingBox(),confirm=await page.locator('.auth-field-passwordConfirm').boundingBox()
 assert(Math.abs(pass.y-confirm.y)<2,'password fields should share a row')
 for(const width of [390,360]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)}
 await page.setViewportSize({width:1440,height:1000})
 await page.goto(base+'/login');await page.getByLabel('아이디',{exact:true}).fill('tester');await page.getByLabel('비밀번호',{exact:true}).fill('password');await page.getByText('아이디 저장',{exact:true}).click();await page.locator('.auth-service button[type=submit]').click();await page.waitForURL(base+'/')
 assert(await page.locator('.customer-member-nav .customer-logout').isVisible())
 for(const width of [1920,1440,1024,768,390,360]){
  await page.setViewportSize({width,height:900})
  const blocked=await page.locator('.customer-member-nav a,.customer-member-nav button').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&!el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}).map(el=>el.textContent))
  assert.deepEqual(blocked,[],'header controls at '+width)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
 }
 await page.setViewportSize({width:1440,height:1000})
 await page.goto(base+'/my-home');await page.locator('.account-summary').first().waitFor()
 const settings=page.locator('#account-settings');assert.equal(await settings.locator('input').count(),0)
 await settings.getByRole('button',{name:'수정',exact:true}).click();await settings.getByLabel('연락처',{exact:true}).fill('01098765432');await settings.getByRole('button',{name:'변경 사항 저장'}).click()
 await settings.getByRole('button',{name:'수정',exact:true}).waitFor();assert.equal(await settings.locator('input').count(),0);assert((await settings.innerText()).includes('010-9876-5432'))
 const order=await page.locator('.account-panel h2').allTextContents();assert(order.indexOf('내 차량')<order.indexOf('비밀번호 변경'))
 await page.goto(base+'/my-withdraw');assert.equal(await page.locator('.account-panel summary').count(),0)
 await page.getByLabel('본인 확인 비밀번호').fill('password');page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'계정 탈퇴'}).click();assert(!writes.some(row=>row.path.endsWith('/withdraw')))
 // Reuse the project's map SDK stub; requests remain fully mocked.
 const source=readFileSync(new URL('./manager-map-overlay.mjs',import.meta.url),'utf8'),start=source.indexOf('await page.addInitScript(')+'await page.addInitScript('.length,end=source.indexOf('\n })',start)+3
 await page.addInitScript({content:'('+source.slice(start,end)+')()'})
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/customer-app/screen-5')
 await page.locator('.map-weather-marker').click();await page.locator('.map-weather-detail').waitFor();const weather=await page.locator('.map-weather-detail').boundingBox();assert(weather.height>20&&weather.y>=0)
 await page.locator('.mobile-sheet-handle').click();await page.waitForTimeout(350)
 const location=page.getByRole('button',{name:'내 위치 찾기',exact:true});assert(await location.isVisible());assert(await location.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}))
 session='manager';await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/admin-dashboard')
 await page.getByRole('button',{name:'인수인계 창 닫기'}).click()
 await page.locator('.test-map-marker').nth(1).click()
 await page.getByText('담당 외 시설 · 통제 권한 없음',{exact:true}).waitFor()
 assert(await page.locator('.manager-control-actions button').first().isDisabled())
 await page.locator('.test-map-marker').nth(0).click()
 await page.locator('.manager-assignment').filter({hasText:'담당 시설'}).waitFor()
 assert.equal(await page.locator('.manager-control-actions button').first().isDisabled(),false)
 await page.goto(base+'/fac-detail?id=2');await page.locator('button.btn.primary').waitFor();assert(await page.locator('button.btn.primary').isDisabled())
 await page.goto(base+'/notifications');await page.getByLabel('차량 번호',{exact:true}).fill('1234');await page.getByRole('button',{name:'조회',exact:true}).click()
 await page.locator('a[href="/admin-data/faqs"]').first().click();await page.getByRole('link',{name:'← 알림 발송 기록으로 돌아가기'}).click();assert.equal(await page.getByLabel('차량 번호',{exact:true}).inputValue(),'1234')
 await page.goto(base+'/fac-list');await page.locator('.control-action').first().waitFor();assert.equal(await page.locator('.control-action').nth(0).isDisabled(),false);assert.equal(await page.locator('.control-action').nth(1).isDisabled(),true)
 assert.deepEqual(errors,[])
 console.log('PASS requested QA: signup layout, date/email input, login home, readonly/save, cars order, withdrawal cancel, app weather/location, alert return, facility permission')
}finally{await browser.close();await server.close()}
