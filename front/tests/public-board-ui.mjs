import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const base=`http://127.0.0.1:${server.httpServer.address().port}`
let browser
try{
 browser=await chromium.launch({channel:'msedge',headless:true})
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[]
 let manager=false,failAnswer=false
 const notices=[{id:1,title:'태풍 대비 안내',important:true,authorName:'관리자',createdAt:'2026-10-20 11:43'},{id:2,title:'시스템 점검 안내',important:false,authorName:'관리자',createdAt:'2026-10-20 11:43'}]
 const faqs=[{id:1,question:'위험 알림은 어떻게 받나요?',authorName:'관리자',createdAt:'2026-10-20 11:43'},{id:2,question:'차량은 몇 대까지 등록하나요?',authorName:'관리자',createdAt:'2026-10-20 11:43'}]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname
  requests.push(path)
  if(path==='/api/faqs/2'&&failAnswer)return route.fulfill({status:500,json:{success:false,message:'답변 조회 실패',data:null}})
  let data=null
  if(path==='/api/managers/me'&&manager)data={id:7,name:'관리자',role:'REGIONAL_ADMIN',regions:[]}
  if(path==='/api/notices')data={items:[...notices].reverse(),page:1,totalPages:1,totalItems:2}
  if(path==='/api/notices/1')data={...notices[0],content:'태풍에 대비하세요.'}
  if(path==='/api/faqs')data={items:url.searchParams.get('keyword')==='없음'?[]:faqs,page:1,totalPages:1,totalItems:2}
  if(path==='/api/faqs/1')data={...faqs[0],answer:'마이페이지에서 설정하세요.\n알림 권한을 허용해 주세요.'}
  if(path==='/api/faqs/2')data={...faqs[1],answer:'<script>window.injected=true</script> 문자 그대로 표시'}
  await route.fulfill({json:{success:true,data}})
 })
 for(const path of ['/c-notice','/customer-app/notices']){
  await page.goto(base+path)
  await page.locator('.notice-title-button').first().waitFor()
  assert.equal(await page.locator('.notice-important-badge').count(),1)
  assert.match(await page.locator('.notice-title-button').first().innerText(),/\uD0DC\uD48D/)
  assert.equal(await page.getByRole('columnheader',{name:'중요',exact:true}).count(),0)
  assert.equal(await page.getByRole('button',{name:'상세 보기',exact:true}).count(),0)
  assert.equal(await page.locator('.service-table').getByText(/^(예|아니요)$/).count(),0)
  const title=page.locator('.notice-title-button').first()
  assert.equal(await title.evaluate(el=>getComputedStyle(el).fontWeight),path==='/c-notice'?'700':'400')
  await page.getByRole('button',{name:'중요 태풍 대비 안내'}).click()
  await page.getByRole('dialog').getByText('태풍에 대비하세요.').waitFor()
  await page.getByRole('dialog').locator('dd').filter({hasText:'중요 공지'}).waitFor()
  await page.getByRole('button',{name:'닫기',exact:true}).click()
  assert.equal(await title.evaluate(el=>getComputedStyle(el).fontWeight),'400')
  assert.equal(await page.locator('.notice-title-button').nth(1).evaluate(el=>getComputedStyle(el).fontWeight),'700')
  await page.reload()
  await page.locator('.notice-title-button').first().waitFor()
  assert.equal(await page.locator('.notice-title-button').first().evaluate(el=>getComputedStyle(el).fontWeight),'400')
 }
 for(const path of ['/info/faq','/customer-app/faq']){
  await page.goto(base+path)
  const first=page.locator('.faq-accordion-item').first(),second=page.locator('.faq-accordion-item').nth(1)
  await first.locator('summary').waitFor()
  assert.equal(await page.getByRole('button',{name:'상세 보기',exact:true}).count(),0)
  const before=requests.filter(x=>x==='/api/faqs/1').length
  await first.locator('summary').click()
  await first.getByText('마이페이지에서 설정하세요.',{exact:false}).waitFor()
  assert.equal(await page.getByRole('dialog').count(),0)
  await first.locator('summary').click()
  assert.equal(await first.getAttribute('open'),null)
  await first.locator('summary').focus();await page.keyboard.press('Enter')
  await first.locator('.faq-answer-text').waitFor()
  assert.equal(requests.filter(x=>x==='/api/faqs/1').length,before+1)
  failAnswer=true
  await second.locator('summary').click()
  await second.getByRole('alert').filter({hasText:'답변 조회 실패'}).waitFor()
  failAnswer=false
  await second.getByRole('button',{name:'다시 불러오기',exact:true}).click()
  await second.getByText('<script>window.injected=true</script> 문자 그대로 표시',{exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>window.injected),undefined)
  for(const width of [1440,390,360]){
   await page.setViewportSize({width,height:1000})
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${path} ${width}`)
  }
 }
 await page.goto(base+'/info/faq?id=1')
 await page.locator('.faq-accordion-item[open] .faq-answer-text').waitFor()
 assert.equal(await page.getByRole('dialog').count(),0)
 manager=true
 await page.goto(base+'/admin-data/faqs')
 await page.locator('.faq-accordion-item summary').first().click()
 await page.locator('.faq-inline-answer').getByRole('button',{name:'수정',exact:true}).waitFor()
 await page.locator('.faq-inline-answer').getByRole('button',{name:'수정',exact:true}).click()
 await page.getByRole('dialog').getByRole('heading',{name:'정보 수정'}).waitFor()
 await page.getByRole('button',{name:'닫기',exact:true}).click()
 await page.goto(base+'/admin-data/notices')
 await page.locator('.service-table').getByText('일반',{exact:true}).waitFor()
 assert.equal(await page.locator('.service-table').getByText(/^(예|아니요)$/).count(),0)
 assert.deepEqual(errors,[])
 console.log('PASS notice badges, title detail, FAQ inline answers, keyboard, caching, retry, safe text, deep links, mobile and admin controls')
}finally{await browser?.close();await server.close()}
