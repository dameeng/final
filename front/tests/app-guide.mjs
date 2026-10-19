import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
let server
try{await fetch('http://localhost:8282')}catch{server=await createServer({configLoader:'runner'});await server.listen()}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://localhost:8282/info/app-guide')
 await page.locator('.app-guide-hero').waitFor()
 assert.equal(await page.locator('link[href*="c-app-guide.css"]').count()+await page.locator('style[data-vite-dev-id*="c-app-guide.css"]').count()>0,true)
 await page.getByRole('button',{name:/02.*위험 알림/}).click()
 await page.locator('.app-guide-feature-detail').getByText('필요한 순간에, 안전 소식.').waitFor()
 assert.match(await page.locator('.app-guide-phone-heading').innerText(),/나의 안전 알림/)
 await page.getByRole('button',{name:'iPhone',exact:true}).click()
 assert.match(await page.locator('.app-guide-store-status').innerText(),/App Store/)
 await page.getByRole('link',{name:/앱 설치 안내/}).click()
 assert(page.url().endsWith('#install'))
 for(const width of [1440,1280,768,390,360]){
  await page.setViewportSize({width,height:1100})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'overflow at '+width)
 }
 await page.setViewportSize({width:1440,height:1100});await page.evaluate(()=>scrollTo(0,0))
 await page.screenshot({path:'tests/app-guide-preview.png'})
 assert.deepEqual(errors,[])
 console.log('PASS separate CSS, feature switch and phone preview, platform switch, install anchor, desktop/mobile widths, no runtime errors')
}finally{await browser.close();await server?.close()}
