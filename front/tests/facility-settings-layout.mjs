import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const levels=[{level:'SAFE',riskScoreMin:0},{level:'WATCH',riskScoreMin:40},{level:'WARNING',riskScoreMin:70}].map(r=>({...r,updatedAt:'2026-10-30T10:00:00'}))
try{
const p=await b.newPage({viewport:{width:1440,height:1000}})
const errors=[];p.on('pageerror',e=>errors.push(e.message))
let write
await p.route('**/api/**',r=>{
 const url=new URL(r.request().url()),path=url.pathname;let data=[]
 if(path==='/api/managers/me')data={id:1,name:'QA',role:'REGIONAL_ADMIN',regions:[{id:1,name:'Region'}]}
 else if(path==='/api/underpasses/1')data={id:1,name:'Facility',regionId:1,roadAddress:'Address',currentRiskLevel:'SAFE',heightM:3.5,lengthM:165,floodHistoryCount:2,earlyBlock:true}
 else if(path==='/api/regions')data=[{id:1,name:'Region'}]
 else if(path==='/api/underpasses')data={items:[{id:1,name:'Facility',regionId:1}],totalItems:1,totalPages:1,page:1}
 else if(path.endsWith('/1/thresholds'))data=levels
 else if(path.includes('/1/thresholds/')&&r.request().method()==='PUT'){write=r.request().postDataJSON();const row=levels.find(x=>path.endsWith('/'+x.level));Object.assign(row,write);data=row}
 else if(path.startsWith('/api/pm/'))data={items:[],totalItems:0,totalPages:1}
 return r.fulfill({json:{data}})
})
await p.goto('http://localhost:8282/fac-detail?id=1&tab=settings')
await p.locator('.configuration-threshold-card').first().waitFor()
assert.equal(await p.locator('.configuration-threshold-card').count(),3)
assert.equal(await p.locator('.facility-settings-grid .service-filters').count(),0)
assert.equal(await p.locator('.facility-settings-grid .list-result-count').count(),1)
for(const theme of ['light','dark']){
 await p.evaluate(t=>document.documentElement.dataset.theme=t,theme)
 for(const width of [1440,1900,1050,650,390]){
  await p.setViewportSize({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,theme+' '+width)
  if(width>1050){
   const alignment=await p.locator('.facility-settings-grid').evaluate(e=>({left:e.querySelector('.facility-settings-dimensions').getBoundingClientRect().top,right:e.querySelector('.configuration-threshold-grid').getBoundingClientRect().top,panels:Array.from(e.children).map(c=>c.getBoundingClientRect().height)}))
   assert(Math.abs(alignment.left-alignment.right)<2,JSON.stringify(alignment))
   assert(Math.abs(alignment.panels[0]-alignment.panels[1])<2)
  }
 }
 await p.setViewportSize({width:1440,height:1000})
 await p.locator('.facility-settings-grid').screenshot({path:join(tmpdir(),'routel-settings-'+theme+'.png')})
}
await p.setViewportSize({width:1440,height:1000})
await p.locator('.configuration-threshold-card').nth(1).getByRole('button').click()
await p.getByLabel('최소 위험 점수',{exact:true}).fill('45')
await p.locator('dialog[open]').getByRole('button',{name:'확인',exact:true}).click()
await p.locator('dialog[open]').waitFor({state:'hidden'})
assert.equal(write.riskScoreMin,45)
await p.getByRole('button',{name:'시설 정보 수정',exact:true}).click()
await p.locator('dialog[open]').waitFor()
assert.equal(await p.getByLabel('시설명',{exact:true}).inputValue(),'Facility')
assert.deepEqual(errors,[])
console.log('Settings stage cards, single count, responsive themes, threshold save and facility edit passed')
}finally{await b.close()}
