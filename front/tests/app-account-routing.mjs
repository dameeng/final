import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
let server
try{await fetch('http://localhost:8282')}catch{server=await createServer({configLoader:'runner'});await server.listen()}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto('http://localhost:8282/')
 await page.locator('.customer-header').waitFor()
 assert.equal(await page.locator('.header-mypage').count(),0)
 await page.goto('http://localhost:8282/my-home')
 await page.waitForURL('**/login?**')
 await page.goto('http://localhost:8282/customer-app/screen-13')
 await page.locator('.app-account-menu').waitFor()
 for(const path of ['/customer-app/notices','/customer-app/faq']){
  await page.locator(`.app-account-menu a[href="${path}"]`).click()
  await page.waitForURL(`**${path}`)
  assert.equal(await page.locator('.customer-header').count(),0)
  await page.locator('.ah > a').first().click()
  await page.waitForURL('**/customer-app/screen-13')
 }
 for(const section of ['profile','emergency','cars','settings','inquiries','withdraw']){
  await page.goto(`http://localhost:8282/customer-app/account/${section}`)
  await page.waitForURL('**/customer-app/screen-1?**')
  assert.equal(new URL(page.url()).searchParams.get('next'),`/customer-app/account/${section}`)
 }
 await page.goto('http://localhost:8282/customer-app/screen-13')
 const restricted=page.locator('.app-account-menu a[href*="next="]').first()
 await restricted.click();await page.waitForURL('**/customer-app/screen-1?**')
 await page.addInitScript(()=>sessionStorage.setItem('routel-member-preview','1'))
 for(const section of ['profile','emergency','cars','settings','inquiries','withdraw']){
  await page.goto(`http://localhost:8282/customer-app/account/${section}`)
  await page.locator('.app-account-body').waitFor()
  assert(new URL(page.url()).pathname===`/customer-app/account/${section}`)
  const links=await page.locator('a[href]').evaluateAll(links=>links.map(link=>link.getAttribute('href')))
  assert(links.every(href=>href.startsWith('/customer-app/')))
 }
 assert.deepEqual(errors,[])
 console.log('PASS: web guest hides/guards My Page; app public notices/FAQ; guest redirects; member app-only account pages')
}finally{await browser.close();await server?.close()}
