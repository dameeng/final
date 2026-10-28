import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage({viewport:{width:430,height:900}})
  await page.route('**/api/**',r=>{
    const path=new URL(r.request().url()).pathname
    const data=path==='/api/customers/me'?{id:1,name:'고객',loginId:'customer01',role:'customer'}:path==='/api/managers/me'?null:{items:[],page:1,totalItems:0,totalPages:1}
    return r.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  for(const label of ['공지사항','FAQ','내 정보 관리','알림 수신 설정','회원 탈퇴']) {
    await page.goto(base+'/customer-app/screen-13')
    await page.getByRole('link',{name:label,exact:false}).first().click()
    await page.getByRole('button',{name:'이전 화면으로',exact:true}).click()
    await expect(page).toHaveURL(base+'/customer-app/screen-13')
  }
  const direct=await browser.newPage()
  await direct.route('**/api/**',r=>{
    const path=new URL(r.request().url()).pathname
    const data=path==='/api/customers/me'?{id:1,name:'고객',loginId:'customer01',role:'customer'}:path==='/api/managers/me'?null:{items:[],page:1,totalItems:0,totalPages:1}
    return r.fulfill({json:{success:true,data}})
  })
  await direct.goto(base+'/customer-app/notices')
  await direct.getByRole('button',{name:'이전 화면으로',exact:true}).click()
  await expect(direct).toHaveURL(base+'/customer-app/screen-13')
  await page.route('**/api/customers/me/cars**',r=>{
    const current=Number(new URL(r.request().url()).searchParams.get('page')||1)
    const rows=[{id:1,carNum:'12가1252',createdAt:'2026-10-27T10:00:00'},{id:2,carNum:'19저0362',createdAt:'2026-10-27T10:00:00'},{id:3,carNum:'117머1687',createdAt:'2026-10-27T10:00:00'}]
    return r.fulfill({json:{success:true,data:{items:current===1?rows.slice(0,2):rows.slice(2),page:current,totalItems:3,totalPages:2,size:2}}})
  })
  await page.goto(base+'/customer-app/account/profile')
  await expect(page.locator('.customer-car-list>li')).toHaveCount(3)
  await expect(page.locator('#account-cars .service-pagination')).toHaveCount(0)
  await expect(page.getByRole('button',{name:'12가1252 수정',exact:true})).toBeVisible()
  await page.route('**/api/customers/me/inquiries**',r=>{
    const row={id:1,title:'서비스 이용 문의',content:'차량 알림 설정을 확인하고 싶어요.',status:'PENDING',createdAt:'2026-10-27T14:55:00'}
    return r.fulfill({json:{success:true,data:/\/inquiries\/1$/.test(new URL(r.request().url()).pathname)?row:{items:[row],totalItems:1,totalPages:1,page:1}}})
  })
  await page.goto(base+'/customer-app/account/inquiries')
  await expect(page.locator('.customer-inquiry-list>li')).toHaveCount(1)
  await expect(page.locator('.app-number-pagination')).toHaveCount(0)
  await page.getByRole('button',{name:'서비스 이용 문의 상세 보기',exact:true}).click()
  await expect(page.locator('.workflow-page')).toBeVisible()
  await expect(page.locator('.workflow-page')).toContainText('차량 알림 설정을 확인하고 싶어요.')
  console.log('PASS customer account child pages return to account; direct notices entry uses account fallback')
} finally {await browser.close();await server.close()}
