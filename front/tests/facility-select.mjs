import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), requests=[], errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url());requests.push(url)
    let data=[]
    if(url.pathname==='/api/managers/me')data={id:1,name:'QA',role:'REGIONAL_ADMIN',regions:[{id:1,name:'Region'}]}
    else if(url.pathname==='/api/customers/me')data=null
    else if(url.pathname==='/api/underpasses')data={items:[{id:1,name:'시설 A',regionId:1,manageable:true},{id:2,name:'시설 B',regionId:1,manageable:true}],totalItems:2,totalPages:1,page:1}
    else if(url.pathname.endsWith('/transits'))data={items:[],totalItems:0,totalPages:1,page:1}
    return route.fulfill({json:{success:true,data}})
  })
  await page.goto(server.resolvedUrls.local[0]+'admin-data/transits',{waitUntil:'domcontentloaded'})
  const select=page.getByRole('combobox',{name:'지하차도',exact:true})
  await select.click({timeout:15000}).catch(async e=>{console.log((await page.locator('body').innerText()).slice(0,2000));console.log(errors);throw e})
  await page.getByRole('option',{name:'시설 B',exact:true}).click()
  assert.equal(await select.innerText(),'시설 B\n⌄')
  await Promise.all([
    page.waitForResponse(r=>new URL(r.url()).pathname==='/api/underpasses/transits'&&new URL(r.url()).searchParams.get('underpassId')==='2'),
    page.getByRole('button',{name:'조회',exact:true}).click(),
  ])
  for(const theme of ['light','dark']){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme)
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000})
      await select.click()
      const option=page.getByRole('option',{name:'시설 B',exact:true})
      assert.equal(await option.getAttribute('aria-selected'),'true')
      const box=await page.getByRole('listbox').boundingBox()
      assert(box.x>=0&&box.x+box.width<=width)
      assert(await option.evaluate(e=>getComputedStyle(e).color!==getComputedStyle(e.parentElement).backgroundColor))
      await select.press('Escape')
      assert.equal(await page.getByRole('listbox').count(),0)
    }
  }
  await select.focus();await select.press('ArrowDown');await select.press('Home');await select.press('ArrowDown');await select.press('Enter')
  assert((await select.innerText()).includes('시설 A'))
  await select.click();await page.getByRole('heading',{level:1}).click()
  assert.equal(await select.getAttribute('aria-expanded'),'false')
  assert.deepEqual(errors,[])
  console.log('Facility picker: visible options, selection/search, keyboard, outside click, themes and mobile bounds passed')
} finally { await browser.close(); await server.close() }
