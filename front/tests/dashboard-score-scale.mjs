import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage()
 await page.emulateMedia({reducedMotion:'reduce'})
 await page.addInitScript(()=>localStorage.setItem('routel-handover-hide:1:REGIONAL_ADMIN',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())))
 await page.route('https://dapi.kakao.com/**',route=>route.abort())
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname
  let data={items:[],page:1,totalItems:0,totalPages:1}
  if(path==='/api/managers/me') data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[]}
  else if(path==='/api/customers/me') data=null
  else if(path==='/api/regions'||path.includes('/dashboard/timeline')||path.includes('/dashboard/risk-margin'))data=[]
  else if(path==='/api/pm/equipments')data={...data,totalItems:5,items:[100,100,86.9,73,72].map((score,i)=>({equipId:i+1,name:'C-'+(i+1),type:'CCTV',underpassName:'초량지하차도',level:'DANGER',score}))}
  return route.fulfill({json:{success:true,data}})
 })
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/admin-dashboard`)
 await expect(page.locator('.fixed-top5 [role=meter]')).toHaveCount(5)
 for(const width of [1440,900,390]) {
  await page.setViewportSize({width,height:1000})
  for(const theme of ['light','dark']) {
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
   const containers=await page.locator('.fixed-top5').evaluate(el=>[el,...el.querySelectorAll('.dashboard-fixed-content,.widget-original-content,.rank')].map(node=>({
    overflow:getComputedStyle(node).overflowY,scroll:node.scrollHeight,client:node.clientHeight,
   })))
   assert(containers.every(item=>!['auto','scroll'].includes(item.overflow)||item.scroll<=item.client+1),'Top5 has no internal scrolling at any viewport')
   const boxes=await page.locator('.fixed-top5').evaluate(el=>({card:el.getBoundingClientRect().bottom,last:el.querySelector('.rank>li:last-child').getBoundingClientRect().bottom}))
   assert(boxes.last<=boxes.card+1,'All five items fit inside their card')
   for(const row of await page.locator('.fixed-top5 .rank>li').all()) {
    const result=await row.evaluate(el=>{
     const track=el.querySelector('[role=meter]'),bar=track.firstElementChild,score=el.querySelector('.sc')
     const t=track.getBoundingClientRect(),b=bar.getBoundingClientRect(),s=score.getBoundingClientRect(),r=el.getBoundingClientRect()
     return {value:Number(track.getAttribute('aria-valuenow')),ratio:b.width/t.width,right:t.right,scoreRight:s.right,gap:r.bottom-t.bottom,label:score.textContent}
    })
    assert(Math.abs(result.ratio-result.value/100)<.002,'Bar length uses exactly the 0–100 scale')
    assert(Math.abs(result.right-result.scoreRight)<1,'Track ends at the 100-point label edge')
    assert(result.gap>=8,'Track is separated from the row border')
    assert(result.label.includes('/ 100'))
   }
  }
 }
 await page.locator('.fixed-top5 .rank>li').first().click({position:{x:12,y:12}})
 await expect(page).toHaveURL(/\/pm-equipment-detail\?id=1$/)
 console.log('PASS 100-point bars, theme geometry and clicking anywhere on Top5 row opens equipment detail')
} finally {await browser.close();await server.close()}
