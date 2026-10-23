import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[], sizes=[]
 page.setDefaultTimeout(15000)
 page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{if(!localStorage.getItem('routel-session-kind'))localStorage.setItem('routel-session-kind','manager')})
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url()),path=url.pathname
  let data=[]
  if(path==='/api/managers/me')data={id:7,name:'Manager',role:'REGIONAL_ADMIN',regions:[]}
  else if(path==='/api/customers/me')data={id:8,name:'Customer',role:'customer'}
  else if(path.endsWith('/unread-count'))data={count:0}
  else if(['/api/plate-logs','/api/notices','/api/faqs','/api/underpasses','/api/customers/me/notifications','/api/managers/me/notifications'].includes(path)) {
   const size=Number(url.searchParams.get('size')||10),current=Number(url.searchParams.get('page')||1)
   sizes.push({path,size,current})
   const rows=Array.from({length:23},(_,i)=>({id:i+1,title:`Notice ${i+1}`,question:`Question ${i+1}`,name:`Facility ${i+1}`,underpassName:`Facility ${i+1}`,detectedNum:`Plate ${i+1}`,createdAt:'2026-10-23T12:00:00',category:'NOTICE',important:i===22,viewCount:i,read:true}))
   data={items:rows.slice((current-1)*size,current*size),page:current,size,totalItems:23,totalPages:Math.ceil(23/size)}
  }
  return route.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 for(const [path,selector] of [['/admin-data/ocr','.service-table tbody tr'],['/c-notice','.service-table tbody tr'],['/info/faq','.faq-accordion-item']]) {
  await page.goto(base+path)
  await page.waitForFunction(selector=>document.querySelectorAll(selector).length===10,selector)
  const nav=page.locator('.service-pagination').last()
  await nav.getByRole('button',{name:'다음',exact:true}).click()
  await nav.getByText('2 / 3 페이지',{exact:true}).waitFor()
  assert.equal(await page.locator(selector).count(),10)
  await nav.getByRole('button',{name:'다음',exact:true}).click()
  await nav.getByText('3 / 3 페이지',{exact:true}).waitFor()
  assert.equal(await page.locator(selector).count(),3)
  assert(await nav.getByRole('button',{name:'다음',exact:true}).isDisabled())
 }
 await page.goto(base+'/pm-equipment')
 await page.locator('#tbl').waitFor()
 await page.locator('.service-pagination').waitFor()
 assert.equal(await page.locator('#tbl tbody tr:visible').count(),10)
 await page.locator('.service-pagination').getByRole('button',{name:'다음',exact:true}).click()
 assert.equal(await page.locator('#tbl tbody tr:visible').count(),1)
 assert(sizes.some(item=>item.path==='/api/plate-logs'&&item.size===10&&item.current===3))
 assert.deepEqual(errors,[])
 console.log('PASS web lists: OCR server paging, notice priority collection paging, legacy equipment paging, ten rows and final partial page')
} finally {await browser.close();await server.close()}
