import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
let server
try{await fetch('http://localhost:8282')}catch{server=await createServer({configLoader:'runner'});await server.listen()}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],api=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))api.push(r.url())})
 await page.goto('http://localhost:8282/my-home')
 await page.getByRole('button',{name:'회원 화면 보기',exact:true}).click()
 assert.equal(await page.locator('.mypage-sidebar nav a').count(),6)
 await page.locator('.mypage-sidebar').getByRole('link',{name:'계정 설정',exact:true}).click()
 await page.locator('#f-name').waitFor()
 await page.reload();await page.locator('#f-name').waitFor()
 await page.locator('#t-pw').click();await page.locator('#p0').waitFor({state:'visible'})
 await page.locator('#t-push').click();await page.locator('#m').waitFor({state:'visible'})
 await page.getByRole('button',{name:'비회원 화면 보기',exact:true}).click()
 assert.equal(await page.locator('.mypage-sidebar nav a').count(),2)
 assert.equal(await page.locator('#f-name').count(),0)
 assert.equal(api.length,0,'preview should not require API requests')
 for(const width of [1440,1280,390]){
  await page.setViewportSize({width,height:1000})
  assert.equal(await page.locator('.customer-menu-link').first().evaluate(el=>getComputedStyle(el).fontSize),'18px')
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
  const links=await page.locator('.customer-menu-link').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y));assert.equal(new Set(links).size,1)
 }
 assert.deepEqual(errors,[])
 console.log('PASS member/guest switch; settings tabs; refresh persistence; no backend requests; larger single-row header; responsive widths')
}finally{await browser.close();await server?.close()}
