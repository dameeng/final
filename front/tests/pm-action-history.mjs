import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  const equipment={equipId:1,eventId:1,name:'P-1-1',type:'PUMP',underpassName:'초량지하차도',status:'CHECK_NEEDED',level:'DANGER',score:82,triggerType:'DANGER_ENTRY'}
  const history=['START','RECORD','RESOLVED','ETC',null].map((kind,i)=>({...equipment,actionId:i+1,kind,content:'점검 내용 '+i,createdAt:'2026-10-28T12:00:00',managerName:'관리자',scoreBefore:82,scoreAfter:20}))
  let saved
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname
    let data=[]
    if(path==='/api/managers/me')data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[]}
    else if(path==='/api/customers/me')data=null
    else if(path==='/api/pm/events/1/status') {saved=route.request().postDataJSON();data={...equipment,status:saved.status}}
    else if(path==='/api/pm/events')data={items:[equipment],totalItems:1,totalPages:1,page:1}
    else if(path==='/api/pm/actions')data={items:history,totalItems:history.length,totalPages:1,page:1}
    else if(path==='/api/pm/equipments')data={items:[equipment],totalItems:1,totalPages:1,page:1}
    return route.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  await page.goto(base+'/pm-queue')
  await page.getByRole('button',{name:'점검 시작',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:'저장',exact:true}).click()
  await expect.poll(()=>saved?.status).toBe('IN_PROGRESS')
  assert.equal(saved.content,'점검을 시작했습니다.','starting without a memo still sends content so the server persists a START record')
  await page.goto(base+'/pm-history')
  await expect(page.getByRole('columnheader',{name:'이력 구분',exact:true})).toBeVisible()
  for(const label of ['점검 시작','기록 추가','조치 완료','기타 종료','구분 미기록'])await expect(page.locator('.pm-action-kind').filter({hasText:label})).toBeVisible()
  await page.setViewportSize({width:390,height:844})
  await page.goto(base+'/admin-app/history')
  await expect(page.locator('.pm-action-kind[data-kind=START]')).toBeVisible()
  await expect(page.locator('.pm-action-kind[data-kind=RECORD]')).toBeVisible()
  console.log('PASS blank start persists audit text, all four action kinds and honest legacy fallback, web column and app history badges')
}finally{await browser.close();await server.close()}
