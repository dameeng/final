import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
let server
try{await fetch('http://localhost:8282')}catch{server=await createServer({configLoader:'runner'});await server.listen()}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://localhost:8282/c-map')
 await page.waitForFunction(()=>document.querySelector('.preview-map-status')?.hidden,{},{timeout:25000})
 const coordinates=JSON.parse(readFileSync('public/facility-coordinates.json','utf8'))
 assert.equal(coordinates.length,49)
 assert.equal(await page.locator('#lst .it').count(),8)
 assert.equal(await page.locator('#lst .lvb').filter({hasText:'미확인'}).count(),0)
 assert.equal(await page.getByRole('button',{name:'미확인',exact:true}).count(),0)
 assert(coordinates.every(c=>Number.isFinite(c.lat)&&Number.isFinite(c.lng)))
 for(const risk of ['위험','주의','안전']){
  await page.locator('#lst .it').filter({has:page.locator('.lvb',{hasText:risk})}).first().click()
  await page.waitForTimeout(300)
  const colors=await page.locator('.real-map-host img').evaluateAll(images=>images.filter(i=>i.src.startsWith('data:image/svg')).map(i=>decodeURIComponent(i.src)))
  const color={'위험':'#c62828','주의':'#e88700','안전':'#16805d'}[risk]
  assert(colors.some(svg=>svg.includes(color)),risk+' marker color')
  await page.getByRole('button',{name:'목록으로',exact:true}).click()
 }
 await page.locator('#lst .it').last().click()
 assert(!(await page.locator('#sc').innerText()).includes('undefined'))
 await page.getByRole('button',{name:'목록으로',exact:true}).click()
 await page.locator('#q').fill('수영강변')
 assert.equal(await page.locator('#lst li:visible').count(),1)
 await page.locator('#lst .it:visible').click()
 assert.match(await page.locator('#n').innerText(),/수영강변/)
 assert.deepEqual(errors,[])
 console.log('PASS stored coordinates preserved, 8 known-state facilities, no unknown filter, risk colors, selection, search, no runtime errors')
}finally{await browser.close();await server?.close()}
