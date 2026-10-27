import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname
    let data={items:[],page:1,totalPages:1,totalItems:0}
    if(path==='/api/managers/me') data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:1,name:'동구'}]}
    else if(path==='/api/customers/me') data=null
    else if(path==='/api/regions') data=[{id:1,name:'동구'}]
    else if(path==='/api/underpasses') data={...data,totalItems:3,items:['초량지하차도','충장지하차도','감천지하차도'].map((name,i)=>({id:i+1,name,regionId:1,regionName:'동구',currentRiskLevel:'SAFE',currentStatus:'NORMAL',riskScore:0}))}
    return route.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  for(const [path,width] of [['/admin-app/screen-4',390],['/fac-list',1440]]) {
    await page.setViewportSize({width,height:844})
    await page.goto(base+path)
    await expect(page.locator('.service-result-count')).toContainText('3')
    await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(el=>el.close()))
    const input=page.getByRole('combobox',{name:'지하차도 이름 검색'}),list=page.getByRole('listbox',{name:'지하차도 검색 추천'})
    for(const theme of ['light','dark']) {
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
      await input.fill('ㅊ')
      await expect(list.getByRole('option')).toHaveCount(3)
      const a=await input.boundingBox(),b=await list.boundingBox()
      assert(b.y>=a.y+a.height&&b.x>=0&&b.x+b.width<=width,'Suggestions stay below input and inside viewport')
      await list.getByRole('option',{name:/초량지하차도/}).click()
      await expect(input).toHaveValue('초량지하차도')
      await expect(list).toHaveCount(0)
      await expect(page.locator('.service-result-count')).toContainText('1')
      await input.fill('ㄱㅊ')
      await expect(list.getByRole('option')).toHaveCount(1)
      await input.press('ArrowDown');await input.press('Enter')
      await expect(input).toHaveValue('감천지하차도')
      await expect(page.locator('.service-result-count')).toContainText('1')
      await input.fill('ㅊㄹ');await expect(list).toBeVisible()
      await input.press('Escape');await expect(list).toHaveCount(0)
      await input.fill('');await expect(list).toHaveCount(0)
    }
  }
  assert.deepEqual(errors,[])
  console.log('PASS app/web autocomplete: initial consonants, candidate click, keyboard selection, Escape, clear, bounds and both themes')
} finally {await browser.close();await server.close()}
