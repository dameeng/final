import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage(), errors=[],writes=[]
  let manager=true
  page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/usage/getCctv-data.do*',route=>route.fulfill({status:503,body:'Fixture: upstream unavailable'}))
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url()),path=url.pathname
    if(route.request().method()!=='GET') writes.push({path,body:route.request().postDataJSON()})
    let data={items:[],page:1,totalItems:0,totalPages:1}
    if(path==='/api/managers/me') data=manager?{id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[]}:null
    else if(path==='/api/customers/me') data=manager?null:{id:2,name:'고객',phone:'01012345678'}
    else if(path==='/api/regions') data=[]
    else if(path==='/api/underpasses/7') data={id:7,name:'감천지하차도',regionName:'사하구',currentRiskLevel:'SAFE',currentStatus:'NORMAL',heightM:4.7,currentRiskScore:0}
    else if(path==='/api/pm/equipments/15') data={equipment:{equipId:15,name:'C-1-1',type:'CCTV',underpassId:7,underpassName:'초량지하차도',openEventId:8,openEventStatus:'CHECK_NEEDED'}}
    else if(path==='/api/pm/reports/daily') data={date:url.searchParams.get('date'),summary:{newEventCount:1,openEventCount:1,actionCount:0,openEvents:[{eventId:8,status:'CHECK_NEEDED',triggerType:'DANGER_ENTRY'}]}}
    else if(path==='/api/plate-logs') data={...data,totalItems:1,items:[{id:42,underpassId:7,underpassName:'초량지하차도',detectedNum:'12가3456',reviewStatus:'NONE'}]}
    return route.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  for(const [path,width] of (process.env.WORKFLOW_CUSTOMER_ONLY?[]:[['/admin-app/inspection?id=15&eventId=8',390],['/pm-inspection?id=15&eventId=8',1440]])) {
    await page.setViewportSize({width,height:844})
    await page.goto(base+path)
    await page.getByRole('button',{name:'점검 처리',exact:true}).click()
    const isApp=path.startsWith('/admin-app/')
    const workflow=page.locator(isApp?'.workflow-page:visible':'dialog.pm-action-modal[open]')
    await expect(workflow.getByRole('heading',{name:'점검 처리 · C-1-1'})).toBeVisible()
    if(isApp) await expect(page).toHaveURL(/__view=pm-action-title/)
    else await expect(page).not.toHaveURL(/__view=/)
    await expect(page.locator('dialog[open]')).toHaveCount(isApp?0:1)
    if(isApp) await expect(page.locator('.inspection-report')).not.toBeVisible()
    else await expect(page.locator('.inspection-report')).toBeVisible()
    const box=await workflow.boundingBox()
    assert(box.x>=0&&box.x+box.width<=width,'Workflow fits its page')
    assert.equal(await workflow.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'Form stays inside page width')
    if(isApp) await page.locator('.theme-toggle:visible').first().click()
    else await page.evaluate(()=>document.documentElement.dataset.theme='dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
    if(width===390) await page.screenshot({path:'test-results/inspection-workflow-page-dark.png',animations:'disabled'})
    if(isApp) await page.locator('.theme-toggle:visible').first().click()
    else await page.evaluate(()=>document.documentElement.dataset.theme='light')
    await workflow.getByLabel('기록 추가',{exact:true}).check()
    await workflow.locator('textarea').fill('정상 수신 여부 확인')
    await workflow.getByRole('button',{name:'저장',exact:true}).click()
    await expect(workflow).toHaveCount(0)
    await expect(page.locator('.inspection-report')).toBeVisible()
    await expect(page).not.toHaveURL(/__view=/)
    assert.equal(writes.at(-1).path,'/api/pm/events/8/actions')
    assert.equal(writes.at(-1).body.content,'정상 수신 여부 확인')
    await page.getByRole('button',{name:'점검 처리',exact:true}).click()
    await expect(workflow).toBeVisible()
    if(isApp) await page.goBack()
    else await workflow.getByRole('button',{name:'취소',exact:true}).click()
    await expect(workflow).toHaveCount(0)
    console.log('PASS inspection form page, save and browser back',path)
  }
  for(const path of (process.env.WORKFLOW_CUSTOMER_ONLY?[]:['/admin-app/ocr?underpassId=7&id=42','/admin-data/ocr?underpassId=7&id=42'])) {
    await page.goto(base+path)
    const isApp=path.startsWith('/admin-app/')
    const workflow=page.locator(isApp?'.workflow-page:visible':'dialog.service-modal[open]')
    await expect(workflow.locator('.ocr-record')).toContainText('12가3456')
    await expect(page.locator('dialog[open]')).toHaveCount(isApp?0:1)
    await workflow.getByRole('button',{name:isApp?'‹ 뒤로':'닫기',exact:true}).click()
    await expect(workflow).toHaveCount(0)
    await expect(page.locator('.service-result-count')).toContainText('1')
    console.log('PASS OCR full page and preserved list',path)
  }
  for(const path of (process.env.WORKFLOW_CUSTOMER_ONLY?[]:['/admin-app/screen-14','/admin-profile'])) {
    await page.goto(base+path)
    await page.getByRole('button',{name:'비밀번호 변경',exact:true}).click()
    const workflow=page.locator(path.startsWith('/admin-app/')?'.workflow-page:visible':'dialog.account-withdraw[open]')
    await expect(workflow.getByRole('heading',{name:'비밀번호 변경',exact:true})).toBeVisible()
    await workflow.getByRole('button',{name:'취소',exact:true}).click()
    await expect(workflow).toHaveCount(0)
  }
  if(!process.env.WORKFLOW_CUSTOMER_ONLY) {
    await page.goto(base+'/fac-list?id=7')
    await expect(page.locator('dialog.restored-summary-drawer[open]')).toContainText('감천지하차도')
    await page.getByRole('button',{name:'내부 CCTV 보기',exact:true}).click()
    await expect(page.locator('dialog.tunnel-cctv-modal[open]')).toContainText('신월여의지하도로 CCTV')
    await page.getByRole('button',{name:'내부 CCTV 창 닫기',exact:true}).click()
    await expect(page.locator('dialog.restored-summary-drawer[open]')).toContainText('감천지하차도')
    await page.locator('dialog.restored-summary-drawer[open]').getByRole('button',{name:'닫기',exact:true}).click()
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    console.log('PASS nested facility -> CCTV -> facility -> list navigation')
  }
  manager=false
  for(const path of ['/my-home','/customer-app/account/settings']) {
    await page.goto(base+path)
    if(path.startsWith('/customer-app/')) await page.evaluate(()=>window.dispatchEvent(new Event('routel-public-chat-open')))
    else await page.locator('.public-chat-launcher').click()
    const isApp=path.startsWith('/customer-app/')
    const workflow=page.locator(isApp?'.workflow-page:visible':'dialog.public-chat-dialog[open]')
    await expect(workflow.getByRole('heading',{name:'ROUTEL AI 도우미'})).toBeVisible()
    await expect(page.locator('dialog[open]')).toHaveCount(isApp?0:1)
    await workflow.getByRole('button',{name:'챗봇 닫기'}).click()
    await expect(workflow).toHaveCount(0)
    console.log('PASS customer content page and return',path)
  }
  assert.deepEqual(errors,[])
  console.log('PASS account forms in app and web; no browser runtime errors')
} finally {await browser.close();await server.close()}
