import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
let server
try{await fetch('http://localhost:8282')}catch{server=await createServer({configLoader:'runner'});await server.listen()}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 const go=async path=>{await page.goto('http://localhost:8282'+path);await page.locator('.customer-breadcrumb').waitFor()}
 for(const width of [1440,1280]){
  await page.setViewportSize({width,height:1000});await go('/info/company')
  const nav=await page.locator('.customer-main-nav').boundingBox()
  assert(Math.abs(nav.x+nav.width/2-width/2)<2,'header not centered at '+width)
  const links=await page.locator('.customer-main-nav a').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y))
  assert.equal(new Set(links).size,1)
  assert.equal(await page.locator('.customer-submenu').count(),0)
 }
 await go('/info/business');await page.waitForURL('**/info/company')
 await page.locator('.company-services').waitFor()
 const sidebar=page.getByRole('complementary',{name:'페이지 메뉴'})
 await sidebar.getByRole('link',{name:'앱 소개',exact:true}).first().click();await page.waitForURL('**/info/app-guide')
 await page.locator('.app-guide-hero').waitFor()
 await page.getByRole('navigation',{name:'현재 위치'}).getByRole('link',{name:'About us',exact:true}).click()
 await page.waitForURL('**/info/company')
 await page.evaluate(()=>scrollTo(0,500));assert((await sidebar.boundingBox()).y>=0)
 await page.locator('.header-download').click();await page.waitForURL('**/info/app-guide#install')
 for(const width of [1440,1280,390,360]){
  await page.setViewportSize({width,height:1000})
  for(const path of ['/info/company','/info/app-guide','/c-map','/login','/signup','/my-home','/my-inquiries','/info/kma','/c-notice?tab=faq']){
   await go(path)
   assert.equal(await page.locator('.customer-section-sidebar:visible,.mypage-sidebar:visible').count(),1,path+' sidebar')
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${path} overflow at ${width}`)
  }
 }
 assert.deepEqual(errors,[])
 console.log('PASS merged company/service; app title; centered single-row header; sidebar persistence; parent breadcrumbs; desktop/mobile overflow; no runtime errors')
}finally{await browser.close();await server?.close()}
