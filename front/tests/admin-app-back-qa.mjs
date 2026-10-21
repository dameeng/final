import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const base=server.resolvedUrls.local[0].replace(/\/$/,'')
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],calls=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{window.streams=[];window.EventSource=class extends EventTarget{constructor(url,options){super();this.url=url;this.options=options;window.streams.push(this)}close(){this.closed=true}}})
 let session='manager'
 const now=Date.now(),time=offset=>new Date(now+offset*3600000).toISOString()
 let facilities=['SAFE','WATCH','CAUTION','ALERT','SEVERE'].map((currentRiskLevel,i)=>({id:i+1,name:'시설 '+(i+1),regionId:1,regionName:'부산광역시',roadAddress:'부산광역시 중구',latitude:35.1,longitude:129.03,currentStatus:'NORMAL',currentRiskLevel,manageable:i!==4,riskScore:20+i*15,currentRiskScore:20+i*15,heightM:4,lengthM:120,widthM:10,lanes:2,safetyGrade:'B',riverDistM:125,seaDistM:900,earlyBlock:true,floodHistoryCount:1,currentWaterCm:3}))
 let notices=[{id:1,title:'점검 공지',content:'공지 본문',category:'MAINTENANCE',categoryLabel:'점검',important:true,viewCount:4,createdAt:time(0)}]
 let faqs=[{id:1,question:'차량 등록 방법',answer:'마이페이지 내 차량에서 등록합니다.',category:'VEHICLE',sortOrder:1,viewCount:2},{id:2,question:'알림 설정',answer:'알림 설정에서 변경합니다.',category:'NOTIFICATION',sortOrder:2,viewCount:1}]
 let inquiries=[{id:1,title:'수정 가능 문의',content:'문의 내용',status:'PENDING'},{id:2,title:'답변 완료 문의',content:'문의 내용',status:'ANSWERED',replyContent:'답변'}]
 let transits=[{id:10,underpassName:'시설 1',carNum:'12가1234',status:'REMAINING'},{id:11,underpassName:'시설 1',carNum:'34나5678',status:'EXITED'}]
 let notifications=[{id:1,category:'TASK',title:'새 문의 접수',body:'문의가 등록되었습니다.',read:false,createdAt:time(0)}]
 const paged=items=>({items,page:1,size:20,totalItems:items.length,totalPages:1})
 await page.route('**/api/**',async r=>{
  const req=r.request(),u=new URL(req.url()),path=u.pathname,method=req.method(),body=req.postDataJSON?.();calls.push({path,method,body,query:u.search})
  let data=[]
  if(path==='/api/customers/me')data=session==='customer'?{id:2,name:'고객',loginId:'customer',phone:'01012345678'}:null
  if(path==='/api/managers/me')data=session==='manager'?{id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:1,name:'부산광역시'}]}:null
  if(path==='/api/regions')data=[{id:1,name:'부산광역시'}]
  if(path==='/api/underpasses')data=paged(facilities)
  if(/^\/api\/underpasses\/\d+$/.test(path)){const id=Number(path.split('/').at(-1));if(method==='PUT')facilities=facilities.map(row=>row.id===id?{...row,...body}:row);data=facilities.find(row=>row.id===id)}
  if(path.endsWith('/risk-scores'))data=[{riskScore:10,predictedAt:time(-1),rainfallMm:2},{riskScore:20,predictedAt:time(0),rainfallMm:3}]
  if(path.endsWith('/risk-forecast'))data=[{riskScore:45,targetAt:time(1),rainfallMm:8,predictedAt:time(0)}]
  if(path==='/api/notices'){if(method==='POST'){notices.push({id:2,...body,viewCount:0});data=notices.at(-1)}else data=paged(notices.filter(row=>!u.searchParams.get('category')||row.category===u.searchParams.get('category')))}
  if(/^\/api\/notices\/\d+$/.test(path))data=notices.find(row=>row.id===Number(path.split('/').at(-1)))
  if(path==='/api/faqs')data=paged(faqs.filter(row=>!u.searchParams.get('keyword')||row.question.includes(u.searchParams.get('keyword'))))
  if(path==='/api/faqs/popular')data=faqs
  if(path==='/api/faqs/order'){faqs=body.ids.map(id=>faqs.find(row=>row.id===id));data=null}
  if(/^\/api\/faqs\/\d+$/.test(path))data=faqs.find(row=>row.id===Number(path.split('/').at(-1)))
  if(path==='/api/customers/me/inquiries')data=paged(inquiries)
  if(/^\/api\/customers\/me\/inquiries\/\d+$/.test(path)){const id=Number(path.split('/').at(-1));if(method==='PUT')inquiries=inquiries.map(row=>row.id===id?{...row,...body}:row);if(method==='DELETE')inquiries=inquiries.filter(row=>row.id!==id);data=inquiries.find(row=>row.id===id)||null}
  if(path==='/api/underpasses/transits')data=paged(transits)
  if(path.endsWith('/transits/10/complete')){transits[0].status='EXITED';data=transits[0]}
  if(path==='/api/managers/me/notifications')data=paged(notifications)
  if(path.endsWith('/notifications/unread-count'))data={total:notifications.filter(row=>!row.read).length,byCategory:{TASK:1}}
  if(path.endsWith('/notifications/read-all')){notifications.forEach(row=>row.read=true);data=null}
  if(path==='/api/customers')data=paged([{id:2,name:'고객',loginId:'customer',phone:'01012345678'}])
  if(path==='/api/weather')data={temperature:18,humidity:70,rainfall:2,condition:'비',observedAt:time(0),hourly:[{time:'15시',temperature:18,rainfall:3}]}
  await r.fulfill({json:{success:true,data}})
 })

 await page.setViewportSize({width:390,height:844})
 await page.goto(base+'/admin-app/screen-9')
 await page.locator('.row[role="button"]').first().click()
 await page.waitForURL('**/admin-app/screen-10')
 const back=page.locator('.manager-app-titlebar .admin-back-button');await back.waitFor()
 const alignment=await page.locator('.manager-app-titlebar').evaluate(el=>{const a=el.querySelector('svg').getBoundingClientRect(),b=el.querySelector('strong').getBoundingClientRect();return Math.abs(a.y+a.height/2-b.y-b.height/2)})
 assert(alignment<2,'arrow is vertically centered against title')
 await back.click();await page.waitForURL('**/admin-app/screen-9')
 await page.goto(base+'/admin-app/screen-10');await page.locator('.manager-app-titlebar .admin-back-button').click();await page.waitForURL('**/admin-app/screen-9')
 await page.goto(base+'/admin-app/screen-14');await page.locator('.manager-app-titlebar .admin-back-button').click();await page.waitForURL('**/admin-app/screen-3')
 assert.deepEqual(errors,[])
 console.log('PASS admin back: centered title arrow, previous app route, direct-link fallback, shared app header')
}finally{await browser.close();await server.close()}
