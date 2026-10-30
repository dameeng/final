import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
process.env.VITE_KAKAO_MAP_KEY='test-map-key'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try{
const p=await b.newPage({viewport:{width:1440,height:1000}})
p.on('pageerror',e=>console.log('Page error:',e.message))
const source=readFileSync(new URL('./manager-map-overlay.mjs',import.meta.url),'utf8'),start=source.indexOf('await page.addInitScript(')+'await page.addInitScript('.length,end=source.indexOf('\n  })',start)+4
await p.addInitScript({content:'('+source.slice(start,end)+')()'})
const facilities=[true,false].map((earlyBlock,i)=>({id:i+1,name:'Facility '+(i+1),regionId:1,regionName:'부산광역시',roadAddress:'부산광역시 중구',latitude:35.1+i*.1,longitude:129.03,currentStatus:'NORMAL',currentRiskLevel:'SAFE',riskScore:20,currentWaterCm:0.2,rainfallMm:0.01,remainingCount:0,pendingReviewCount:2,earlyBlock,manageable:true}))
await p.route('**/api/**',r=>{
const path=new URL(r.request().url()).pathname;let data=[]
if(path==='/api/customers/me')data=null
else if(path==='/api/managers/me')data={id:1,name:'QA',role:'REGIONAL_ADMIN',regions:[{id:1,name:'부산광역시'}]}
else if(path==='/api/underpasses')data={items:facilities,totalItems:2,totalPages:1,page:1}
else if(/^\/api\/underpasses\/[12]$/.test(path)){data={...facilities[Number(path.split('/').at(-1))-1]};if(data.id===1)delete data.earlyBlock}
else if(path.endsWith('/risk-scores'))data=[{riskScore:20,predictedAt:new Date().toISOString()}]
else if(path==='/api/weather')data={temperature:18,condition:'맑음'}
return r.fulfill({json:{success:true,data}})
})
await p.goto(server.resolvedUrls.local[0]+'admin-dashboard',{waitUntil:'domcontentloaded'})
await p.locator('.handover-x').click()
await p.locator('.test-map-marker').first().click({timeout:15000}).catch(async e=>{console.log((await p.locator('body').innerText()).slice(-3000));throw e})
const panel=p.locator('.manager-map-panel')
await panel.locator('.early-block-badge').waitFor()
assert(!await panel.locator('.manager-facility-status').evaluate(e=>Array.from(e.childNodes).some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()==='>')))
for(const theme of ['light','dark']){
 await p.evaluate(t=>document.documentElement.dataset.theme=t,theme)
 for(const width of [1440,768,390]){
  await p.setViewportSize({width,height:1000});assert.equal(await panel.evaluate(e=>e.scrollWidth>e.clientWidth),false)
  const cells=await panel.locator('.manager-live-metrics>div').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}}))
  assert.equal(cells.length,4)
  assert(Math.abs(cells[0].width-cells[1].width)<2)
  assert.equal(cells[0].x,cells[1].x)
  assert(cells.every((cell,index)=>index===0||cell.y>cells[index-1].y))
  assert(await panel.locator('.manager-live-metrics>div').evaluateAll(es=>es.every(e=>e.querySelector('dd').getBoundingClientRect().left>e.querySelector('dt').getBoundingClientRect().right)))
 }
 await p.setViewportSize({width:1440,height:1000})
 await panel.screenshot({path:join(tmpdir(),'routel-map-panel-'+theme+'.png')})
 console.log(theme,await panel.locator('.early-block-badge').evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color})))
}
await p.setViewportSize({width:1440,height:1000})
await panel.getByRole('button',{name:'시설 선택 해제'}).click()
await p.locator('.test-map-marker').nth(1).click()
await panel.locator('.manager-facility-heading strong').filter({hasText:'Facility 2'}).waitFor()
assert.equal(await panel.locator('.early-block-badge').count(),0)
console.log('Map early-block badge: list/detail fallback, flag false, responsive panel and themes passed')
}finally{await b.close();await server.close()}
