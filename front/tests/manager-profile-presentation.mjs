import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const profile={id:1,name:'김민수',loginId:'manager01',role:'REGIONAL_ADMIN',phone:'01010010001',email:'minsu@example.com',regions:['중구','서구','동구','영도구','남구','사하구'].map((name,i)=>({id:i+1,name})),shift:{id:1,name:'주간조',startTime:'07:00:00',endTime:'15:00:00'}}
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}})
 const errors=[];p.on('pageerror',e=>errors.push(e.message))
 let updated
 await p.route('**/api/**',async r=>{
  const path=new URL(r.request().url()).pathname
  let data=[]
  if(path==='/api/managers/me'){
   if(r.request().method()==='PUT'){updated=r.request().postDataJSON();Object.assign(profile,updated)}
   data=profile
  }else if(path.includes('notifications')) data={items:[],totalItems:0,totalPages:1}
  await r.fulfill({json:{data}})
 })
 await p.goto('http://localhost:8282/admin-profile')
 await p.locator('.manager-web-summary').waitFor()
 assert.equal(await p.locator('.manager-web-regions>span').count(),6)
 assert.equal(await p.locator('.manager-web-hours').textContent(),'07:00–15:00')
 for(const theme of ['light','dark']){
  await p.evaluate(t=>document.documentElement.dataset.theme=t,theme)
  for(const width of [1900,1440,900,650,390]){
   await p.setViewportSize({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,theme+' '+width)
   if(width>=1440){
    const alignment=await p.locator('.manager-web-account').evaluate(e=>({profile:e.querySelector('.account-panel').getBoundingClientRect().bottom,tools:e.querySelector('.manager-web-tools').getBoundingClientRect().top,devices:e.querySelector('.manager-push-devices').getBoundingClientRect().bottom,account:e.querySelector('.account-actions').getBoundingClientRect().top,name:getComputedStyle(e.querySelector('.manager-web-name h2')).fontSize}))
    assert(alignment.tools>alignment.profile)
    assert(alignment.account>alignment.devices)
    assert.equal(alignment.name,'26px')
   }
  }
  await p.setViewportSize({width:1440,height:1000})
  await p.locator('.manager-web-account').screenshot({path:join(tmpdir(),'routel-profile-'+theme+'.png')})
 }
 await p.setViewportSize({width:1440,height:1000})
 await p.getByRole('button',{name:'내 정보 수정',exact:true}).click()
 await p.getByLabel('이메일',{exact:true}).fill('updated@example.com')
 await p.getByRole('button',{name:'기본 정보 저장',exact:true}).click()
 await p.getByRole('button',{name:'내 정보 수정',exact:true}).waitFor()
 assert.equal(updated.email,'updated@example.com')
 assert.deepEqual(Object.keys(updated).sort(),['email','phone'])
 await p.getByRole('button',{name:'비밀번호 변경',exact:true}).click()
 assert.equal(await p.locator('dialog[open]').count(),1)
 assert.deepEqual(errors,[])
 console.log('Manager profile: 6 regions, shift time, responsive themes, contact-only save and password dialog passed')
}finally{await browser.close()}
