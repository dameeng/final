import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser = await chromium.launch({channel:'msedge',headless:true})
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}})
  const queries = []
  const record = {id:42,underpassId:7,underpassName:'초량지하차도',detectedNum:'12가3456',recognitionStatus:'SUCCESS',reviewStatus:'PENDING',cameraId:227}
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname
    let data = {items:[],page:1,totalItems:0,totalPages:1}
    if (path === '/api/managers/me') data = {id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:1,name:'중구'},{id:3,name:'동구'}]}
    else if (path === '/api/customers/me') data = null
    else if (path === '/api/regions') data = [{id:1,name:'중구'},{id:3,name:'동구'}]
    else if (path === '/api/underpasses') data = {...data,items:[{id:7,name:'초량지하차도',regionId:3}]}
    else if (path === '/api/plate-logs') {
      const q = Object.fromEntries(url.searchParams)
      queries.push(q)
      if (q.regionId !== '1') {
        const scan = q.size === '100'
        data = {...data,page:Number(q.page),totalItems:120,totalPages:scan?2:6,items:!q.underpassId&&(!scan||q.page==='1')?[{...record,id:99}]:[record]}
      }
    }
    return route.fulfill({json:{success:true,data}})
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  await page.goto(base+'/admin-data/ocr')
  await expect(page.getByLabel('담당 지역',{exact:true})).toHaveValue('1')
  await page.getByLabel('지하차도',{exact:true}).selectOption('7')
  await expect(page.getByLabel('담당 지역',{exact:true})).toHaveValue('')
  await page.getByRole('button',{name:'조회',exact:true}).click()
  await expect(page.locator('tbody')).toContainText('12가3456')
  assert.equal(queries.at(-1).underpassId,'7')
  assert(!queries.at(-1).regionId)
  const manual = page.getByRole('link',{name:'번호판 판별 대기',exact:true})
  await expect(manual).toHaveClass('btn')
  const buttonStyles = await page.locator('.service-heading .service-actions').evaluate(el => {
    const controls = [el.querySelector('a.btn'),el.querySelector('button')]
    return controls.map(control => {
      const style = getComputedStyle(control)
      return {height:control.getBoundingClientRect().height,font:style.fontSize,radius:style.borderRadius}
    })
  })
  assert.deepEqual(buttonStyles[0],buttonStyles[1],'Navigation button uses the same dimensions and typography as existing buttons')
  assert.match(await manual.getAttribute('href'),/^\/verify\?underpassId=7$/)
  await manual.click()
  await expect(page).toHaveURL(/\/verify\?underpassId=7$/)
  for (const resource of ['display','presets','reasons','notices','faqs','ocr']) {
    await page.goto(base+'/admin-data/'+resource)
    const heading = page.locator('.service-heading').first()
    await expect(page.locator('.resource-shortcuts')).toHaveCount(0)
    if (resource!=='ocr') {
      const tabs=page.locator('.page-selection-tabs')
      await expect(tabs).toHaveCount(1)
      const left=await tabs.evaluate(el=>el.getBoundingClientRect().left)
      const titleLeft=await heading.evaluate(el=>el.querySelector('h1').getBoundingClientRect().left)
      assert(Math.abs(left-titleLeft)<2,'Selection tabs align left: '+resource)
      continue
    }
    await expect(heading.locator('.heading-navigation')).not.toHaveCount(0)
    const geometry = await heading.evaluate(el => {
      const title = el.querySelector('h1').getBoundingClientRect()
      return [...el.querySelectorAll('.heading-navigation a')].map(link => {
        const rect = link.getBoundingClientRect()
        return {height:rect.height,top:rect.top,titleBottom:title.bottom,left:rect.left,titleLeft:title.left}
      })
    })
    assert(geometry.every(rect=>rect.height===44&&rect.top>=rect.titleBottom&&rect.left>=rect.titleLeft),'Record navigation sits below the title with standard 44px buttons: '+resource+' '+JSON.stringify(geometry))
    const actionsLeft=await heading.locator('.service-actions').evaluate(el=>el.getBoundingClientRect().left)
    assert(Math.abs(actionsLeft-geometry[0].titleLeft)<2,'Record action group aligns left')
  }
  for (const prefix of ['/admin-data/ocr','/admin-app/ocr']) {
    queries.length = 0
    await page.goto(base+prefix+'?id=42&regionId=3')
    await expect(page.locator('.ocr-record:visible')).toContainText('12가3456')
    await expect(page.getByLabel('지하차도',{exact:true})).toHaveValue('7')
    assert(queries.some(q=>q.size==='100'&&q.page==='2'),'Find notification record beyond first page')
    if (prefix.includes('admin-data')) await expect(page.locator('dialog:visible')).toHaveCount(1)
  }
  const target = await page.evaluate(async () => {
    const {notificationTarget} = await import('/src/utils/notification-target.ts')
    return notificationTarget({id:2,refType:'PLATE_LOG',refId:42,regionId:3},true,'/overview','/notifications')
  })
  assert.deepEqual(target,{path:'/admin-data/ocr',query:{id:'42',regionId:'3'}})
  console.log('PASS OCR facility/region conflict, standard web review button, notification region and off-page record in web/app')
} finally {await browser.close();await server.close()}
