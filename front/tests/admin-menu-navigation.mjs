import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage(),errors=[]
 let sessionDelay=0
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/**',async r=>{
  const path=new URL(r.request().url()).pathname
  if(path==='/api/managers/me'&&sessionDelay)await new Promise(resolve=>setTimeout(resolve,sessionDelay))
  const data=path==='/api/managers/me'?{id:1,name:'Manager',role:'REGIONAL_ADMIN',regions:[]}:path==='/api/customers/me'?null:path.includes('kpi')?{}:path.includes('/dashboard/')||path==='/api/regions'?[]:{items:[],page:1,totalItems:0,totalPages:1}
  return r.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 await page.goto(base+'/admin-dashboard')
 await page.locator('.handover-x').click()
 await page.locator('.backend-header button').first().click()
 async function checkFooter(){
  const links=page.locator('.admin-sidebar-links a')
  assert.deepEqual(await links.evaluateAll(els=>els.map(el=>el.getAttribute('href'))),['/','/customer-app/screen-5','/admin-app/screen-3'])
  const rects=await links.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right}}))
  assert(rects.every(r=>Math.abs(r.x-rects[0].x)<1),'footer links share one column')
  assert(rects[0].y<rects[1].y&&rects[1].y<rects[2].y)
  assert(rects[2].right<=await page.evaluate(()=>innerWidth))
 }
 await checkFooter()
 const hrefs=await page.locator('.backend-menu .admin-sidebar-groups a').evaluateAll(els=>els.map(el=>el.getAttribute('href')))
 sessionDelay=1200
 await page.locator('.backend-menu a[href="/fac-list"]').click()
 await page.locator('.backend-scrim').waitFor({state:'hidden',timeout:500})
 await page.locator('.backend-main[aria-busy="true"]').waitFor({timeout:500})
 await page.waitForURL(base+'/fac-list')
 sessionDelay=0
 for(const href of hrefs){
  await page.goto(base+'/admin-dashboard')
  await page.locator('.backend-header button').first().click()
  const link=page.locator(`.backend-menu a[href="${href}"]`)
  await link.evaluate(el=>{const details=el.closest('details');if(details)details.open=true})
  await link.click()
  await page.waitForURL(base+href,{timeout:10000})
  await page.locator('.backend-scrim').waitFor({state:'hidden',timeout:2000})
  console.log('PASS',href)
 }
 assert.deepEqual(errors,[])
 await page.setViewportSize({width:390,height:844})
 await page.locator('.backend-header button').first().click()
 await checkFooter()
 await page.locator('.backend-menu a[href="/admin-dashboard"]').focus()
 await page.keyboard.press('Enter')
 await page.waitForURL(base+'/admin-dashboard')
 assert.equal(await page.locator('.backend-scrim').count(),0)
 await page.goto(base+'/pm-equipment')
 await page.locator('#menu-btn').click()
 await checkFooter()
 console.log('PASS slow session response, mobile keyboard navigation and menu dismissal')
}finally{await browser.close();await server.close()}
