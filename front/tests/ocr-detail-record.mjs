import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage({viewport:{width:390,height:844}})
  let populated=false
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname
    let data={items:[],page:1,totalItems:0,totalPages:1}
    if(path==='/api/managers/me') data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[]}
    else if(path==='/api/customers/me') data=null
    else if(path==='/api/regions') data=[]
    else if(path==='/api/plate-logs'&&populated) data={...data,totalItems:1,items:[{id:42,underpassId:7,underpassName:'감천지하차도',detectedNum:'12가3456',confidence:.97,recognitionStatus:'SUCCESS',reviewStatus:'NONE',detectedAt:'2026-10-27T14:00:00',cameraId:15}]}
    return route.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  await page.goto(base+'/admin-app/ocr?underpassId=7&id=42')
  await expect(page.locator('.service-error').first()).toContainText('선택한 기록을 현재 조회 목록에서 찾을 수 없습니다')
  await expect(page.locator('.ocr-record:visible')).toHaveCount(0)
  populated=true
  await page.reload()
  await expect(page.locator('.ocr-record')).toContainText('감천지하차도')
  await expect(page.locator('.ocr-record')).toContainText('12가3456')
  await expect(page.locator('.ocr-record')).toContainText('0.97')
  console.log('PASS missing record never opens empty detail; matching record loads real OCR fields')
} finally {await browser.close();await server.close()}
