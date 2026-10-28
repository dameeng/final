import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage({viewport:{width:430,height:932}})
  let signedIn=false,accountId=77,signups=0
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/v2/maps/sdk.js*',r=>r.abort())
  await page.route('**/api/**',r=>{
    const path=new URL(r.request().url()).pathname,body=r.request().postDataJSON()
    let data={items:[],page:1,totalItems:0,totalPages:1}
    if(path==='/api/managers/me')data=null
    else if(path==='/api/customers/me')data=signedIn?{id:accountId,name:'새 회원',loginId:'newmember',phone:'01012345678'}:null
    else if(path.includes('/check-'))data={available:true}
    else if(path==='/api/customers/signup'){signups++;data={id:77}}
    else if(path==='/api/customers/login'){
      if(body.password==='bad')return r.fulfill({status:401,json:{success:false,message:'로그인 정보를 확인해 주세요.'}})
      signedIn=true;data={id:accountId,name:'새 회원'}
    }else if(path==='/api/customers/phone-code/send')data={expiresInSeconds:180,resendAfterSeconds:60}
    else if(path==='/api/dev/sms/last')data={code:'123456'}
    return r.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  await page.goto(base+'/customer-app/screen-2')
  await page.getByRole('button',{name:'문자 인증',exact:true}).click()
  for(const [part,value] of [['앞자리','010'],['가운데 자리','1234'],['마지막 자리','5678']])await page.getByLabel('휴대전화 '+part,{exact:true}).fill(value)
  await page.locator('.auth-service button[type=submit]').click()
  await page.getByLabel('인증번호 1번째 자리',{exact:true}).fill('123456')
  await page.locator('.auth-service button[type=submit]').click()
  await page.getByLabel('아이디',{exact:true}).fill('newmember')
  await page.getByLabel('비밀번호',{exact:true}).fill('Safe1234!')
  await page.getByLabel('비밀번호 확인',{exact:true}).fill('Safe1234!')
  await page.getByLabel('이름',{exact:true}).fill('새 회원')
  for(const [part,value] of [['연도','2000'],['월','1'],['일','1']])await page.getByRole('combobox',{name:'생년월일 '+part,exact:true}).fill(value)
  await page.getByLabel('이메일',{exact:true}).fill('new@example.com')
  await page.locator('.auth-service button[type=submit]').click()
  await expect(page).toHaveURL(base+'/customer-app/screen-1')
  assert.equal(signups,1,'actual successful signup records onboarding eligibility')
  await page.getByLabel('아이디',{exact:true}).fill('newmember')
  await page.getByLabel('비밀번호',{exact:true}).fill('bad')
  await page.locator('.auth-service button[type=submit]').click()
  await expect(page.locator('.service-error')).toBeVisible()
  assert.equal(await page.evaluate(()=>localStorage.getItem('routel-customer-guide-v1:signup:newmember')),'pending','failed login retains pending signup guide')
  await page.getByLabel('비밀번호',{exact:true}).fill('Safe1234!')
  await page.locator('.auth-service button[type=submit]').click()
  const dialog=page.locator('.ru-guide-dialog')
  await expect(dialog).toHaveAttribute('open','')
  await expect(dialog.getByRole('heading')).toContainText('안녕하세요')
  await dialog.getByRole('button',{name:'루와 둘러보기'}).click()
  await expect(page).toHaveURL(base+'/customer-app/screen-5')
  await expect(dialog.getByRole('heading')).toContainText('지나갈 지하차도')
  await expect(dialog.locator('.ru-guide-spotlight')).toBeVisible()
  await page.setViewportSize({width:1690,height:940})
  await expect.poll(()=>page.evaluate(()=>{
    const frame=document.querySelector('.customer-mobile-header').getBoundingClientRect()
    const card=document.querySelector('.ru-guide-card').getBoundingClientRect()
    const actor=document.querySelector('.ru-guide-actor').getBoundingClientRect()
    return card.left>=frame.left&&card.right<=frame.right&&Math.abs(actor.left-card.left-16)<2&&Math.abs(actor.bottom-card.top-4)<2
  })).toBe(true)
  await page.setViewportSize({width:430,height:932})
  assert.equal(await dialog.evaluate(el=>getComputedStyle(el,'::backdrop').backgroundColor),'rgba(0, 0, 0, 0)','highlighted content keeps its original brightness')
  const guideTitles=[]
  while(await dialog.getByRole('button',{name:'다음',exact:true}).count()) {
    const progress=Number(await dialog.getByRole('progressbar').getAttribute('aria-valuenow'))
    if([4,5,6].includes(progress))await expect(page.locator('.app-map-sheet .mobile-sheet-handle')).toHaveAttribute('aria-expanded','true')
    if(progress===7)await expect(page.locator('.app-map-sheet .mobile-sheet-handle')).toHaveAttribute('aria-expanded','false')
    guideTitles.push(await dialog.getByRole('heading').innerText())
    await dialog.getByRole('button',{name:'다음',exact:true}).click()
    await expect(dialog.getByRole('button',{name:'이전',exact:true})).toBeEnabled()
  }
  assert(guideTitles.length>=12,'Expanded guide covers map, demo, detour and account features')
  await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuenow','16')
  await dialog.getByRole('button',{name:'안내 마치기'}).click()
  await expect(dialog).not.toHaveAttribute('open','')
  await expect(page).toHaveURL(base+'/customer-app/screen-5')
  await page.reload()
  await expect(dialog).not.toHaveAttribute('open','')
  assert.equal(await page.evaluate(()=>localStorage.getItem('routel-customer-guide-v1:account:77')),'done')
  await page.goto(base+'/customer-app/screen-13')
  await page.getByRole('button',{name:'루와 사용법 보기'}).click()
  await expect(dialog).toHaveAttribute('open','')
  for(const [width,height,theme] of [[320,568,'light'],[430,932,'dark'],[844,390,'dark']]){
    await page.setViewportSize({width,height})
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme)
    const card=await dialog.locator('.ru-guide-card').boundingBox()
    assert(card.x>=0&&card.y>=0&&card.x+card.width<=width+1&&card.y+card.height<=height,`${width} guide fits viewport`)
    await dialog.locator('.ru-guide-card').screenshot({path:`test-results/ru-guide-${width}-${theme}.png`})
  }
  await page.keyboard.press('Escape')
  await expect(dialog).not.toHaveAttribute('open','')
  accountId=88
  await page.goto(base+'/my-home')
  await expect(dialog).not.toHaveAttribute('open','')
  await page.getByRole('button',{name:'루와 사용법 보기'}).click()
  await expect(dialog).toHaveAttribute('open','')
  await dialog.getByRole('button',{name:'루와 둘러보기'}).click()
  await expect(page).toHaveURL(base+'/c-map')
  await dialog.getByRole('button',{name:'다음',exact:true}).click()
  await expect(page).toHaveURL(base+'/c-map')
  await dialog.getByRole('button',{name:/건너뛰기/}).click()
  await expect(dialog).not.toHaveAttribute('open','')
  assert.equal(await page.evaluate(()=>localStorage.getItem('routel-customer-guide-v1:account:88')),'done')
  await page.evaluate(()=>{
    const blocker=document.createElement('dialog');blocker.id='test-safety-dialog';blocker.textContent='안전 알림';document.body.append(blocker);blocker.showModal()
    localStorage.setItem('routel-customer-guide-v1:account:88','pending')
    window.dispatchEvent(new Event('routel-customer-guide-ready'))
  })
  await expect(dialog).not.toHaveAttribute('open','')
  await page.evaluate(()=>{const el=document.getElementById('test-safety-dialog');el.close();el.remove()})
  await expect(dialog).toHaveAttribute('open','')
  await page.keyboard.press('Escape')
  assert.deepEqual(errors,[])
  console.log('PASS signup/login guide, failed login isolation, five app steps, previous/finish, account-scoped persistence, replay, Escape/skip, web steps and responsive light/dark')
}finally{await browser.close();await server.close()}
