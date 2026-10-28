import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage(),calls=[]
 let profile={id:1,name:'김민수',loginId:'manager',role:'REGIONAL_ADMIN',phone:'01012345678',email:'manager@example.com',regions:[{id:3,name:'동구'}],shift:{name:'오전 근무',startTime:'09:00',endTime:'18:00'}}
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname,method=r.request().method()
  calls.push({path,method})
  let data=[]
  if(path==='/api/managers/me') {
   if(method==='PUT')profile={...profile,...r.request().postDataJSON()}
   data=profile
  }else if(path==='/api/customers/me')data=null
  return r.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 for(const width of [320,430]) {
  await page.setViewportSize({width,height:844})
  await page.goto(base+'/admin-app/screen-14')
  await expect(page.locator('.manager-mypage-profile')).toContainText('김민수님')
  await expect(page.locator('.manager-mypage-assignment')).toContainText('동구')
  await expect(page.locator('.manager-mypage-assignment')).toContainText('오전 근무')
  await expect(page.locator('.manager-mypage-assignment .ui-icon')).toHaveCount(1)
  const avatar=page.locator('.manager-mypage-identity img')
  await expect.poll(()=>avatar.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true)
  assert.equal(await avatar.evaluate(el=>getComputedStyle(el).filter),'grayscale(1)')
  assert(await page.locator('.manager-mypage-identity').evaluate(el=>{
    const avatar=el.firstElementChild.getBoundingClientRect(),text=el.lastElementChild.getBoundingClientRect()
    return Math.abs(avatar.top+avatar.height/2-text.top-text.height/2)<1
  }),'Mascot and name block align centrally')
  for(const theme of ['light','dark']) {
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
   assert(await page.locator('.manager-account-page').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'My page fits '+width+'px '+theme)
   assert.equal(await page.locator('.account-actions').evaluate(el=>getComputedStyle(el).borderTopWidth),'0px','Account section has no duplicate outer border')
   assert.equal(await page.locator('.account-actions').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','Account heading stays outside the menu card')
   await expect(page.locator('.account-actions>div>button>.ui-icon')).toHaveCount(2)
   assert.equal(await page.locator('.account-actions>div').evaluate(el=>getComputedStyle(el).borderRadius),'14px')
  }
 }
 await page.locator('.manager-profile-summary').click()
 await page.getByRole('button',{name:'수정',exact:true}).click()
 await page.getByLabel('이메일',{exact:true}).fill('updated@example.com')
 await page.getByRole('button',{name:'기본 정보 저장',exact:true}).click()
 await expect.poll(()=>profile.email).toBe('updated@example.com')
 await page.locator('.manager-mypage-devices>summary').click()
 await expect(page.locator('.manager-push-devices')).toBeVisible()
 await page.getByRole('button',{name:'비밀번호 변경',exact:true}).click()
 await expect(page.getByLabel('현재 비밀번호',{exact:true})).toBeVisible()
 const passwordBox=await page.getByLabel('현재 비밀번호',{exact:true}).evaluate(el=>({height:el.getBoundingClientRect().height,border:getComputedStyle(el).borderBottomWidth,boxBorder:getComputedStyle(el.parentElement).borderBottomWidth}))
 assert.equal(passwordBox.height,48)
 assert.equal(passwordBox.border,'0px')
 assert.equal(passwordBox.boxBorder,'1px')
 await page.getByRole('button',{name:'취소',exact:true}).click()
 await page.getByRole('button',{name:'회원탈퇴',exact:true}).click()
 const withdrawInput=page.getByLabel('본인 확인 비밀번호',{exact:true})
 await expect(withdrawInput).toBeVisible()
 assert.equal(await withdrawInput.evaluate(el=>el.getBoundingClientRect().height),48)
 assert.equal(await withdrawInput.evaluate(el=>getComputedStyle(el).borderBottomWidth),'0px')
 await page.getByRole('button',{name:'취소',exact:true}).click()
 await page.getByRole('button',{name:'로그아웃',exact:true}).click()
 await expect(page).toHaveURL(/\/admin-app\/screen-1$/)
 assert(calls.some(c=>c.path==='/api/auth/logout'&&c.method==='POST'))
 console.log('PASS manager mypage profile, assigned region/shift, responsive themes, edit, push devices, password flow and logout')
}finally{await browser.close();await server.close()}
