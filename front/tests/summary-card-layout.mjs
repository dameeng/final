import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try {
 const p=await b.newPage({viewport:{width:1440,height:1000}})
 const errors=[];p.on('pageerror',e=>errors.push(e.message))
 await p.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname
  let data={items:[],totalItems:0,totalPages:1,page:1,size:10}
  if(path==='/api/managers/me')data={id:1,name:'QA',role:'REGIONAL_ADMIN'}
  else if(path==='/api/regions'||path==='/api/shifts')data=[]
  else if(path==='/api/pm/reports/daily')data={generatedAt:'2026-10-30T12:00:00',summary:{byType:[],recommended:[],newEvents:[],openEvents:[],actions:[],stale:[],levelCounts:{},previousLevelCounts:{}}}
  else if(path==='/api/assistant/admin/stats')data={total:0,successRate:0,unanswered:0,sessions:0,daily:[],topQuestions:[]}
  return r.fulfill({json:{data}})
 })
 const screens=[['/fac-list','.facility-summary-item'],['/cs-customers','.resource-overview-item'],['/pm-equipment','.pm-kpi'],['/pm-queue','.pm-kpi'],['/pm-history','.resource-overview-item'],['/pm-daily','.daily-levels>section'],['/bot-stats','.chat-monitor-kpis>article']]
 for(const [path,selector] of screens){
  await p.goto('http://localhost:8282'+path,{waitUntil:'domcontentloaded'})
  await p.locator(selector).first().waitFor()
  for(const width of [1440,900,390]){
   await p.setViewportSize({width,height:1000})
   const boxes=await p.locator(selector).evaluateAll(es=>es.map(e=>{const a=e.getBoundingClientRect(),n=e.querySelector('strong').getBoundingClientRect();return {height:a.height,numberTop:n.top-a.top}}))
   for(const box of boxes){assert.equal(box.height,88,path+' height @'+width);assert.equal(box.numberTop,37,path+' baseline @'+width)}
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  }
  console.log(path+' card height 88px, number baseline 37px')
  await p.setViewportSize({width:1440,height:1000})
 }
 assert.deepEqual(errors,[])
}finally{await b.close()}
