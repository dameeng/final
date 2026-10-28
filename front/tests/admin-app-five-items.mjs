import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage({viewport:{width:430,height:900}})
  const requests=[]
  await page.route('**/api/**',r=>{
    const url=new URL(r.request().url()),path=url.pathname
    let data=[]
    if(path==='/api/managers/me')data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[]}
    else if(path==='/api/customers/me')data=null
    else if(path==='/api/pm/engine-status')data={status:'OK'}
    else if(['/api/underpasses','/api/pm/equipments','/api/pm/events','/api/pm/actions','/api/pm/thresholds'].includes(path)) {
      const size=Number(url.searchParams.get('size')||20),current=Number(url.searchParams.get('page')||1)
      requests.push({path,size,current})
      const items=Array.from({length:12},(_,i)=>({id:i+1,equipId:i+1,eventId:i+1,actionId:i+1,name:'장비 '+(i+1),underpassName:'초량지하차도',currentStatus:'NORMAL',currentRiskLevel:'SAFE',level:'SAFE',currentLevel:'SAFE',type:'CCTV',score:20,currentScore:20,sparkline:[],reasons:[],status:'CHECK_NEEDED',cautionMin:40,dangerMin:70}))
      data={items:items.slice((current-1)*size,current*size),page:current,size,totalItems:12,totalPages:Math.ceil(12/size)}
    }
    return r.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  let listBounds
  for(const [path,selector,api] of [
    ['/admin-app/screen-4','.app-facility-rows>a','/api/underpasses'],
    ['/admin-app/screen-9','.pm-equipment-card','/api/pm/equipments'],
    ['/admin-app/screen-11','.pm-equipment-card','/api/pm/events'],
    ['/admin-app/history','.pm-equipment-card','/api/pm/actions'],
    ['/admin-app/pm-settings','.pm-settings-list>li','/api/pm/thresholds'],
  ]) {
    await page.goto(base+path)
    await expect(page.locator(selector)).toHaveCount(5)
    const box=await page.locator(selector).first().boundingBox()
    const bounds={left:Math.round(box.x),width:Math.round(box.width)}
    listBounds??=bounds
    assert.deepEqual(bounds,listBounds,'Manager lists share the same horizontal spacing')
    const firstPage=await page.locator(selector).allTextContents()
    await page.getByRole('button',{name:'2페이지',exact:true}).click()
    await expect(page.locator(selector)).toHaveCount(5)
    if(path==='/admin-app/screen-4') {
      await expect(page.locator(selector).first()).not.toHaveText(firstPage[0])
    } else {
      await expect(page.locator(selector).first()).toContainText('장비 6')
      assert(requests.some(item=>item.path===api&&item.size===5&&item.current===2),path+' requests second page of five')
    }
    await page.getByRole('button',{name:'3페이지',exact:true}).click()
    await expect(page.locator(selector)).toHaveCount(2)
  }
  for(const width of [320,1440]) {
    await page.setViewportSize({width,height:900})
    await page.goto(base+'/admin-app/pm-settings')
    await page.locator('.pm-settings-list>li').first().getByRole('button',{name:'설비 삭제'}).click()
    const dialog=page.locator('.pm-delete-app-dialog')
    await expect(dialog).toBeVisible()
    const box=await dialog.boundingBox(),frame=await page.locator('.manager-app-shell').boundingBox()
    assert(box.x>=frame.x&&box.x+box.width<=frame.x+frame.width,'Delete confirmation stays within the app frame')
    await dialog.getByRole('button',{name:'취소',exact:true}).click()
    await expect(dialog).not.toBeVisible()
  }
  console.log('PASS five admin app lists, numbered navigation and app-sized delete confirmation')
} finally {await browser.close();await server.close()}
