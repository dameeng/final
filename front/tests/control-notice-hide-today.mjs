import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage({viewport:{width:390,height:844}})
 await page.route('https://dapi.kakao.com/**',r=>r.abort())
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname
  let data={items:[],totalPages:1,totalItems:0}
  if(path==='/api/managers/me')data={id:1,role:'REGIONAL_ADMIN',name:'Manager',regions:[]}
  else if(path==='/api/customers/me')data=null
  else if(path==='/api/dashboard/facility-kpi')data={blockedCount:4}
  return r.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 await page.goto(base+'/admin-app/screen-3')
 const notice=page.locator('.overview-control-notice')
 await expect(notice).toHaveAttribute('open','')
 await notice.locator('input[type=checkbox]').check()
 await notice.locator('button[type=submit]').click()
 await expect(notice).not.toHaveAttribute('open','')
 const stored=await page.evaluate(()=>localStorage.getItem('routel-control-notice-hidden:1'))
 assert.equal(stored,new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))
 await page.reload()
 await expect(page.locator('.map-only-live')).toBeVisible()
 await expect(notice).not.toHaveAttribute('open','')
 await page.evaluate(()=>document.documentElement.dataset.theme='dark')
 const search=page.locator('.admin-map-search input')
 await search.focus()
 const colors=await search.evaluate(el=>({input:getComputedStyle(el).backgroundColor,form:getComputedStyle(el.parentElement).backgroundColor,text:getComputedStyle(el).color}))
 assert.equal(colors.input,'rgba(0, 0, 0, 0)','Dark map search shares its surrounding surface')
 assert.notEqual(colors.form,colors.text,'Search text remains readable')
 await page.evaluate(()=>localStorage.setItem('routel-control-notice-hidden:1','2000-01-01'))
 await page.reload()
 await expect(notice).toHaveAttribute('open','')
 console.log('PASS hide control notice for today, persistence after reload and expiration on another day')
}finally{await browser.close();await server.close()}
