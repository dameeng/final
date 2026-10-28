import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 await page.addInitScript(()=>localStorage.setItem('routel-handover-hide:1:REGIONAL_ADMIN',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())))
 const facilities=[{id:7,name:'초량지하차도',regionId:3,regionName:'동구',manageable:true},{id:8,name:'초량 담당외',regionId:9,regionName:'사하구',manageable:false},{id:9,name:'감천지하차도',regionId:3,regionName:'동구',manageable:true}].map(row=>({...row,latitude:35.12,longitude:129.04,currentStatus:'NORMAL',currentRiskLevel:'SAFE'}))
 await page.route('https://dapi.kakao.com/**',r=>r.abort())
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname
  let data=[]
  if(path==='/api/managers/me')data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:3,name:'동구'}]}
  else if(path==='/api/customers/me')data=null
  else if(path==='/api/underpasses')data={items:facilities,totalPages:1,totalItems:2,page:1}
  else if(path==='/api/underpasses/7')data=facilities[0]
  return r.fulfill({json:{success:true,data}})
 })
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/admin-dashboard`)
 const input=page.getByLabel('지하차도명·주소 검색',{exact:true})
 await input.fill('감천')
 await expect(page.locator('.manager-map-search-results')).toContainText('감천지하차도')
 await input.evaluate(el=>{
   el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}))
   el.value='초량'
   el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'량'}))
 })
 await expect(page.locator('.manager-map-search-results')).toContainText('초량지하차도')
 await expect(page.locator('.manager-map-search-results')).not.toContainText('감천')
 await input.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'초량'})))
 await input.fill('초량')
 const results=page.locator('.manager-map-search-results')
 await expect(results).toBeVisible()
 await expect(results.locator('button')).toHaveCount(1)
 await expect(results).toContainText('초량지하차도')
 await expect(results).not.toContainText('담당외')
 await input.press('ArrowDown')
 await input.press('Enter')
 await expect(results).toHaveCount(0)
 await expect(input).toHaveValue('초량지하차도')
 await expect(page.getByRole('region',{name:'선택 시설',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'시설 선택 해제',exact:true}).click()
 await expect(page.getByRole('region',{name:'선택 시설',exact:true})).toHaveCount(0)
 await input.fill('없는 시설')
 await expect(results).toContainText('검색된 담당 지하차도가 없습니다.')
 await input.press('Escape')
 await expect(results).toHaveCount(0)
 assert.equal(await page.locator('.manager-map-search').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true)
 console.log('PASS assigned-only manager map suggestions, keyboard selection, empty state and escape')
}finally{await browser.close();await server.close()}
