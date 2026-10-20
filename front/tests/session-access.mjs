import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'

const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const base=`http://127.0.0.1:${server.httpServer.address().port}`
let browser
try{
 browser=await chromium.launch({headless:true,channel:'msedge'})
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 let session=null,failLogout=false
 const errors=[],calls=[]
 const customer={id:11,name:'고객테스트',loginId:'customer1',phone:'01012345678'}
 const manager={id:22,name:'관리테스트',role:'REGIONAL_ADMIN',regions:[]}
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname
  calls.push({path,method:request.method()})
  const ok=data=>route.fulfill({json:{success:true,data}})
  const denied=()=>route.fulfill({status:401,json:{success:false,message:'로그인이 필요합니다.',data:null}})
  if(path==='/api/auth/logout'){
   if(failLogout)return route.fulfill({status:500,json:{success:false,message:'로그아웃 실패',data:null}})
   session=null;return ok(null)
  }
  if(path==='/api/customers/login'){session='customer';return ok(customer)}
  if(path==='/api/managers/login'){session='manager';return ok(manager)}
  if(path==='/api/customers/me')return session==='customer'?ok(customer):denied()
  if(path==='/api/managers/me')return session==='manager'?ok(manager):denied()
  if(path.includes('/me/'))return session==='customer'?ok([]):denied()
  if(path.includes('/dashboard/'))return ok(path.endsWith('facility-kpi')?{}:[])
  return ok([])
 })
 const login=async(managerLogin=false)=>{
  await page.getByLabel('아이디',{exact:true}).fill(managerLogin?'manager1':'customer1')
  await page.getByLabel('비밀번호',{exact:true}).fill('Password1!')
  await page.getByRole('checkbox',{name:'아이디 저장',exact:true}).check()
  await page.getByRole('button',{name:'로그인',exact:true}).click()
 }
 for(const path of ['/login','/c-auth','/admin-login','/customer-app/screen-1','/admin-app/screen-1']){
  await page.goto(base+path)
  const managerLogin=path.includes('admin-'),key=`routel-remembered-login-id:${managerLogin?'manager':'customer'}`
  await page.evaluate(key=>localStorage.setItem(key,'saved-user'),key)
  await page.reload()
  await page.getByRole('checkbox',{name:'아이디 저장',exact:true}).waitFor()
  assert.equal(await page.getByLabel('아이디',{exact:true}).inputValue(),'saved-user')
  assert.equal(await page.getByLabel('비밀번호',{exact:true}).inputValue(),'')
  assert(await page.getByRole('checkbox',{name:'아이디 저장',exact:true}).isChecked())
  await page.getByRole('checkbox',{name:'아이디 저장',exact:true}).uncheck()
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null)
 }
 const blocked=async(path,loginPath)=>{
  await page.goto(base+path)
  await page.waitForURL(url=>url.pathname===loginPath)
  assert.equal(new URL(page.url()).searchParams.get('next'),({'/my-account':'/my-home#account-settings','/my-cars':'/my-home#account-cars'})[path]||path)
  assert.equal(await page.locator('.mypage-layout,.guest-inquiry-form,.app-account-menu').count(),0)
 }
 await page.goto(base+'/')
 await page.locator('.customer-footer').waitFor()
 assert.equal(await page.locator('.customer-header a[href="/my-home"]').count(),0)
 assert.equal(await page.locator('.customer-header .header-admin-link').count(),0)
 assert.equal(await page.getByRole('button',{name:'로그아웃',exact:true}).count(),0)
 assert.equal(await page.getByText(/미리보기|둘러보기|마이페이지 화면 확인/).count(),0)
 await page.locator('.customer-footer').getByRole('link',{name:'관리자 페이지',exact:true}).click()
 await page.waitForURL('**/admin-login')
 console.log('PASS guest header and footer administrator login entry')
 for(const path of ['/my-home','/my-account','/my-cars','/my-alerts','/my-inquiries','/my-inquiry-new','/my-withdraw'])await blocked(path,'/login')
 for(const path of ['/customer-app/screen-12','/customer-app/screen-13','/customer-app/account/profile','/customer-app/account/inquiries'])await blocked(path,'/customer-app/screen-1')
 for(const path of ['/admin-dashboard','/admin-profile','/admin-data/reviews','/verify'])await blocked(path,'/admin-login')
 await blocked('/admin-app/screen-3','/admin-app/screen-1')
 // Old preview flags and a forged client-side session marker grant no access.
 await page.evaluate(()=>{sessionStorage.setItem('routel-member-preview','1');localStorage.setItem('routel-session-kind','customer')})
 await blocked('/my-home?preview=1','/login')
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('routel-member-preview')),null)
 console.log('PASS direct guest access blocked, including old preview flags')
 await blocked('/my-inquiries?page=2','/login')
 await login()
 await page.waitForURL(url=>url.pathname==='/my-inquiries'&&url.searchParams.get('page')==='2')
 await page.locator('.mypage-layout').waitFor()
 assert.equal(await page.evaluate(()=>localStorage.getItem('routel-remembered-login-id:customer')),'customer1')
 assert.equal(await page.locator('.customer-header').getByRole('link',{name:'마이페이지',exact:true}).count(),1)
 assert.equal(await page.locator('.customer-header').getByRole('button',{name:'로그아웃',exact:true}).count(),0)
 assert.equal(await page.locator('.mypage-sidebar').getByRole('button',{name:'로그아웃',exact:true}).count(),1)
 assert.equal(await page.getByText(/미리보기|회원 화면 보기|비회원 화면 보기/).count(),0)
 // Restoring a real cookie session works even when no storage hint remains.
 await page.evaluate(()=>localStorage.removeItem('routel-session-kind'))
 await page.reload();await page.locator('.mypage-layout').waitFor()
 await blocked('/admin-profile','/admin-login')
 await page.goto(base+'/my-home');await page.locator('.mypage-layout').waitFor()
 failLogout=true
 await page.locator('.mypage-sidebar').getByRole('button',{name:'로그아웃',exact:true}).click()
 await page.locator('.mypage-sidebar [role="alert"]').waitFor()
 assert.equal(new URL(page.url()).pathname,'/my-home')
 failLogout=false
 await page.locator('.mypage-sidebar').getByRole('button',{name:'로그아웃',exact:true}).click()
 await page.waitForURL('**/login')
 assert(calls.some(c=>c.path==='/api/auth/logout'&&c.method==='POST'))
 await page.goBack();await page.waitForURL(url=>url.pathname==='/login')
 assert.equal(await page.locator('.mypage-layout').count(),0)
 console.log('PASS customer session restore, next destination, logout success/failure, back navigation')
 await blocked('/customer-app/account/profile','/customer-app/screen-1')
 await login();await page.waitForURL('**/customer-app/account/profile')
 await page.getByRole('button',{name:'로그아웃',exact:true}).first().click()
 await page.waitForURL('**/customer-app/screen-1')
 await blocked('/admin-profile','/admin-login')
 await login(true);await page.waitForURL('**/admin-profile')
 await page.locator('.backend-header').getByRole('button',{name:'로그아웃',exact:true}).waitFor()
 await page.goto(base+'/')
 assert.equal(await page.locator('.customer-header .header-mypage').getAttribute('href'),'/my-home')
 await page.locator('.customer-header .header-mypage').click()
 await page.waitForURL(url=>url.pathname==='/login'&&url.searchParams.get('next')==='/my-home')
 await page.goto(base+'/')
 assert.equal(await page.locator('.customer-header').getByRole('button',{name:'로그아웃',exact:true}).count(),0)
 const footer=page.locator('.customer-footer').getByRole('link',{name:'관리자 페이지',exact:true})
 assert.equal(await footer.getAttribute('href'),'/admin-dashboard')
 await blocked('/my-home','/login')
 await page.goto(base+'/admin-profile')
 await page.locator('.backend-header').getByRole('button',{name:'로그아웃',exact:true}).click()
 await page.waitForURL('**/admin-login')
 await blocked('/admin-profile','/admin-login')
 // Expiration is checked at the next protected navigation.
 session='customer'
 await page.goto(base+'/my-home');await page.locator('.mypage-layout').waitFor()
 session=null
 await page.locator('.mypage-sidebar').getByRole('link',{name:'알림 내역',exact:true}).click()
 await page.waitForURL(url=>url.pathname==='/login')
 assert.deepEqual(errors,[])
 console.log('PASS app logout, manager access/logout, expired session, no runtime errors')
}finally{await browser?.close();await server.close()}
