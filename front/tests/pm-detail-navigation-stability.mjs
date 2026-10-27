import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage()
 let open=true
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname
  const equipment={equipId:15,name:'W-15-1',type:'WATER_LEVEL',underpassId:7,underpassName:'충장지하차도',score:26.3,level:'SAFE',openEventId:open?8:null,openEventStatus:open?'CHECK_NEEDED':null}
  let data={items:[],page:1,totalItems:0,totalPages:1}
  if(path==='/api/managers/me')data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[]}
  else if(path==='/api/customers/me')data=null
  else if(path==='/api/pm/equipments/15')data={equipment,detail:{features:[],extra:{}},cautionMin:40,dangerMin:70,topCauses:[],recentActions:[]}
  else if(path==='/api/pm/equipments')data={...data,items:[equipment]}
  else if(path.endsWith('/scores')||path==='/api/regions')data=[]
  else if(path.endsWith('/thresholds'))data={history:[]}
  else if(path.endsWith('/sensor-trend'))data={points:[],band:null}
  return route.fulfill({json:{success:true,data}})
 })
 const base=`http://127.0.0.1:${server.httpServer.address().port}`
 for(const [path,width] of [['/pm-equipment-detail?id=15',1440],['/admin-app/screen-10?id=15',390]]) {
  await page.setViewportSize({width,height:900})
  let original
  for(const active of [true,false,true]) {
   open=active
   await page.goto(base+path)
   await expect(page.locator('.pm-inspection-card')).toBeVisible()
   await expect(page.locator('.pm-detail-actions').getByRole('link',{name:'확인 필요',exact:true})).toHaveCount(0)
   await expect(page.locator('.pm-detail-actions').locator('button,a')).toHaveCount(3)
   await expect(page.locator('.pm-inspection-card').getByRole('link',{name:'확인 필요',exact:true})).toHaveCount(active?1:0)
   const positions=await page.locator('.pm-detail-actions').locator('button,a').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}))
   if(!original)original=positions
   else assert.deepEqual(positions,original,'Header controls stay at exactly the same positions with and without an inspection')
   assert.equal((await page.locator('.pm-inspection-link-slot').boundingBox()).height,40)
  }
 }
 console.log('PASS fixed header controls and inspection-card entry with/without active inspection on app and web')
} finally {await browser.close();await server.close()}
