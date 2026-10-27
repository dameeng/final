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
    let data={items:[],page:1,totalItems:0,totalPages:1}
    if(path==='/api/managers/me') data=null
    else if(path==='/api/customers/me') data={id:1,name:'이하은',loginId:'tester',phone:'01012345678'}
    else if(path==='/api/notices') data={...data,totalItems:3,items:['태풍 대비 사전 안내','PUF 시스템 오픈 안내','시스템 정기 점검 안내'].map((title,index)=>({id:index+1,title,important:index<2,category:'GUIDE',createdAt:'2026-10-27T10:00:00',authorName:'관리자',viewCount:300}))}
    return route.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  for(const width of [320,430,1200]) {
    await page.setViewportSize({width,height:950})
    for(const theme of ['light','dark']) {
      await page.goto(base+'/customer-app/screen-13')
      await expect(page.locator('.app-profile-heading h2')).toHaveText('이하은님')
      if(await page.locator('html').getAttribute('data-theme')!==theme) await page.locator('.theme-toggle:visible').first().click()
      await expect(page.locator('html')).toHaveAttribute('data-theme',theme)
      await expect(page.locator('.app-account-menu-card')).toHaveCount(2)
      await expect(page.locator('.app-account-menu .app-menu-icon')).toHaveCount(7)
      for(const row of await page.locator('.app-account-menu-card>a,.app-account-menu-card>button').all()) {
        const box=await row.boundingBox()
        assert.equal(box.height,58,'Every menu item has the same row height')
        assert(box.x>=0&&box.x+box.width<=width,'Menu stays inside app viewport')
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow')
      if(width===430) await page.screenshot({path:`test-results/customer-account-${theme}.png`,animations:'disabled'})
      await page.getByRole('link',{name:'공지사항',exact:true}).click()
      await expect(page.locator('.compact-notice-card')).toHaveCount(3)
      for(const card of await page.locator('.compact-notice-card').all()) assert((await card.boundingBox()).height<120,'Notices stay compact')
    }
  }
  assert.deepEqual(errors,[])
  console.log('PASS customer profile/menu and compact notices at 3 viewport widths in both themes; consistent row size, icons, navigation and no overflow')
} finally {await browser.close();await server.close()}
