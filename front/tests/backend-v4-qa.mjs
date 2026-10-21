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
 await page.goto(base+'/fac-list');await page.locator('.restored-facilities tbody tr').first().waitFor()
 await page.getByRole('button',{name:'위험',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.row-open').length===2)
 await page.getByRole('button',{name:'주의',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.row-open').length===2)
 await page.getByRole('button',{name:'전체',exact:true}).click()
 await page.waitForFunction(()=>document.querySelectorAll('.row-open').length===5)
 assert(await page.locator('.control-action').nth(4).isDisabled(),'server manageable=false overrides matching cached region')
 await page.goto(base+'/admin-data/facilities');await page.locator('.row-open').first().click();await page.getByRole('dialog').getByRole('button',{name:'수정',exact:true}).click()
 const dialog=page.getByRole('dialog');await dialog.getByLabel('차로수',{exact:true}).fill('3');await dialog.getByRole('button',{name:'확인',exact:true}).click();await dialog.waitFor({state:'hidden'})
 const saved=calls.find(row=>row.path==='/api/underpasses/1'&&row.method==='PUT').body
 assert.equal(saved.lanes,3);assert.equal(saved.riverDistM,125);assert.equal(saved.seaDistM,900);assert.equal(saved.earlyBlock,true);assert(!Object.hasOwn(saved,'waterDistM'))
 await page.goto(base+'/cs-content');await page.getByRole('button',{name:'새로 등록',exact:true}).click();await dialog.getByLabel('제목',{exact:true}).fill('긴급 공지');await dialog.getByLabel('내용',{exact:true}).fill('공지 내용');await dialog.getByLabel('분류',{exact:true}).selectOption('URGENT');await dialog.getByLabel('고객 알림 발송',{exact:true}).check();await dialog.getByRole('button',{name:'확인',exact:true}).click();await dialog.waitFor({state:'hidden'})
 assert(calls.some(row=>row.path==='/api/notices'&&row.method==='POST'&&row.body.category==='URGENT'&&row.body.sendPush))
 await page.goto(base+'/admin-data/faqs');await page.locator('.faq-accordion-item summary').first().click();await page.getByRole('button',{name:'아래로',exact:true}).first().click();await page.waitForFunction(()=>document.querySelector('.faq-accordion-item summary')?.textContent.includes('알림 설정'))
 assert(calls.some(row=>row.path==='/api/faqs/order'&&row.body.ids.join(',')==='2,1'))
 await page.goto(base+'/admin-data/transits');await page.getByRole('button',{name:'통과 완료 처리',exact:true}).first().waitFor();assert(await page.getByRole('button',{name:'통과 완료 처리',exact:true}).nth(1).isDisabled());await page.getByRole('button',{name:'통과 완료 처리',exact:true}).first().click();await dialog.getByRole('button',{name:'확인',exact:true}).click();await dialog.waitFor({state:'hidden'});assert(calls.some(row=>row.path.endsWith('/transits/10/complete')&&row.method==='POST'))
 await page.goto(base+'/admin-data/manager-notifications');await page.getByRole('button',{name:'모두 읽음',exact:true}).click();assert(calls.some(row=>row.path.endsWith('/notifications/read-all')&&row.method==='PUT'))
 await page.goto(base+'/cs-customers');assert.equal(await page.getByRole('button',{name:'수정',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'탈퇴 처리',exact:true}).count(),0)
 await page.goto(base+'/fac-detail?id=1');await page.locator('.restored-risk-chart path[stroke-dasharray="8 5"]').waitFor();assert((await page.locator('.restored-facility-detail').innerText()).includes('3 cm'))
 facilities[0].currentRiskLevel='ALERT';await page.goto(base+'/fac-detail?id=1');await page.locator('h1 .risk-level-badge--alert').waitFor();assert.equal(await page.locator('h1 .risk-level-badge').innerText(),'\uACBD\uACC4')
 await page.evaluate(()=>window.streams.filter(stream=>!stream.closed).at(-1).dispatchEvent(new MessageEvent('risk-update',{data:JSON.stringify({underpassId:1,riskScore:95,riskLevel:'SEVERE',predictedAt:new Date().toISOString()})})))
 await page.locator('h1 .risk-level-badge--severe').waitFor();assert.equal(await page.locator('h1 .risk-level-badge').innerText(),'\uC2EC\uAC01')
 await page.goto(base+'/admin-app/screen-5?id=1');await page.locator('.app-detail-badges .risk-level-badge--alert').waitFor()
 session='customer';await page.goto(base+'/my-inquiries');await page.locator('tbody tr').first().waitFor();assert.equal(await page.getByRole('button',{name:'수정',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'삭제',exact:true}).count(),2)
 await page.getByRole('button',{name:'수정',exact:true}).click();await dialog.getByLabel('제목',{exact:true}).fill('수정한 문의');await dialog.getByRole('button',{name:'확인',exact:true}).click();await dialog.waitFor({state:'hidden'});assert(calls.some(row=>row.path.endsWith('/inquiries/1')&&row.method==='PUT'&&row.body.title==='수정한 문의'))
 await page.goto(base+'/c-notice');await page.getByLabel('분류',{exact:true}).selectOption('MAINTENANCE');await page.getByRole('button',{name:'조회',exact:true}).click();assert(calls.some(row=>row.path==='/api/notices'&&row.query.includes('category=MAINTENANCE')))
 await page.getByRole('button',{name:'챗봇 문의',exact:true}).click();await page.getByRole('button',{name:'차량 등록 방법',exact:true}).click();await page.getByText('마이페이지 내 차량에서 등록합니다.',{exact:true}).waitFor();await page.getByRole('button',{name:'챗봇 닫기'}).click()
 const before=calls.filter(row=>row.path==='/api/notices').length
 await page.evaluate(()=>window.streams.filter(stream=>!stream.closed).at(-1).dispatchEvent(new MessageEvent('data-changed',{data:JSON.stringify({resource:'notice',action:'CREATE',id:3})})))
 await page.waitForTimeout(600);assert(calls.filter(row=>row.path==='/api/notices').length>before,'SSE refreshes the existing list')
 await page.goto(base+'/customer-app/screen-5');await page.locator('.map-weather-marker').click();await page.getByText('15시',{exact:true}).waitFor()
 for(const width of [390,360]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)}
 assert.deepEqual(errors,[])
 console.log('PASS v4: 5-stage risk mapping, server permission, preserved facility fields, categories/push, FAQ ordering/popular, inquiry edit/delete, transit completion, manager notifications, forecast/water, weather, SSE, mobile widths')
}finally{await browser.close();await server.close()}
