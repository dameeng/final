import {chromium} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/api/**',route=>{
  const url=route.request().url()
  const data=url.includes('facility-kpi')?{facilityCount:2}:url.includes('/dashboard/timeline')?Array.from({length:23},(_,id)=>({id,underpassName:`Facility ${id+1}`,createdAt:'2026-10-23T12:00:00',eventType:'TEST'})):url.includes('notifications')?{items:[],totalItems:0,totalPages:0}:[]
  return route.fulfill({json:{success:true,data}})
 })
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/dashboard-board-fixture.html`)
 await page.locator('.fixed-map').waitFor()
 const eventRows=page.locator('.fixed-events .tl>li')
 await page.waitForFunction(()=>document.querySelectorAll('.fixed-events .tl>li').length===10)
 const eventNext=page.getByRole('button',{name:'최근 이벤트 다음 페이지',exact:true})
 const eventPrevious=page.getByRole('button',{name:'최근 이벤트 이전 페이지',exact:true})
 assert(await eventPrevious.isDisabled())
 await eventNext.click()
 await page.waitForFunction(()=>document.querySelector('.fixed-events .tl>li strong')?.textContent==='Facility 11')
 assert.equal(await eventRows.count(),10)
 await eventNext.click()
 await page.waitForFunction(()=>document.querySelectorAll('.fixed-events .tl>li').length===3)
 assert(await eventNext.isDisabled())
 await eventPrevious.click()
 assert.equal(await eventRows.count(),10)
 assert.equal(await page.locator('.dashboard-fixed-item').count(),7)
 assert.equal(await page.locator('.board-customized').count(),0)
 await page.getByRole('button',{name:'위젯 리스트',exact:true}).click()
 assert.equal(await page.locator('.board-library>div').count(),10)
 assert.equal(await page.locator('.board-resize').count(),28)
 const library=page.getByRole('complementary',{name:'위젯 리스트'})
 await library.getByRole('button',{name:/날씨/}).click()
 assert.equal(await page.locator('[data-widget-id=weather]').count(),1)
 await library.locator('[draggable]').filter({hasText:'OCR'}).dragTo(page.locator('.fixed-summary'))
 await page.locator('[data-widget-id=ocr]').waitFor()
 await page.getByRole('button',{name:'위젯 리스트 닫기'}).click()
 const map=page.locator('.fixed-map'), before=await map.boundingBox()
 const handle=map.locator('.board-resize-bottom')
 await handle.scrollIntoViewIfNeeded()
 const bounds=await handle.boundingBox()
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2)
 await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+100,{steps:5});await page.mouse.up()
 await page.waitForFunction(()=>Number.parseFloat(document.querySelector('.fixed-map').style.height)>0)
 const after=await map.boundingBox();assert(after.height>before.height+50,JSON.stringify({before,after,style:await map.getAttribute('style')}))
 await map.locator('.board-resize-left').focus()
 await page.keyboard.press('ArrowLeft')
 for(const [side,dx,dy] of [['right',-350,0],['left',-350,0],['top',0,70]]) {
  const edge=map.locator('.board-resize-'+side)
  await edge.scrollIntoViewIfNeeded()
  const box=await edge.boundingBox(),previous=await map.getAttribute('style')
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2)
  await page.mouse.down();await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:6});await page.mouse.up()
  await page.waitForFunction(previous=>document.querySelector('.fixed-map').getAttribute('style')!==previous,previous)
 }
 const horizontalBefore=await map.boundingBox()
 const rightEdge=map.locator('.board-resize-right')
 await rightEdge.scrollIntoViewIfNeeded()
 const rightBounds=await rightEdge.boundingBox()
 await page.mouse.move(rightBounds.x+rightBounds.width/2,rightBounds.y+rightBounds.height/2)
 await page.mouse.down();await page.mouse.move(rightBounds.x+400,rightBounds.y+rightBounds.height/2,{steps:8});await page.mouse.up()
 await page.waitForFunction(width=>document.querySelector('.fixed-map').getBoundingClientRect().width>width+100,horizontalBefore.width)
 const fineBefore=await map.boundingBox()
 await map.locator('.board-resize-right').scrollIntoViewIfNeeded()
 const fineEdge=await map.locator('.board-resize-right').boundingBox()
 await page.mouse.move(fineEdge.x+7,fineEdge.y+fineEdge.height/2)
 await page.mouse.down();await page.mouse.move(fineEdge.x+7-37,fineEdge.y+fineEdge.height/2,{steps:4});await page.mouse.up()
 const fineAfter=await map.boundingBox()
 assert(Math.abs(fineBefore.width-fineAfter.width-37)<4,'Width follows small pointer movements instead of fixed quarter sizes')
 const saved=await map.getAttribute('style')
 await page.getByRole('button',{name:'저장',exact:true}).click()
 await page.reload()
 await page.locator('.board-customized').waitFor()
 assert.equal(await map.getAttribute('style'),saved)
 assert.equal(await page.locator('[data-widget-id=ocr]').count(),1)
 await page.getByRole('button',{name:'위젯 리스트',exact:true}).click()
 await page.getByRole('button',{name:'기본 구성',exact:true}).click()
 assert.equal(await page.locator('.board-customized').count(),0)
 assert.equal(await page.locator('.dashboard-fixed-item').count(),7)
 await page.getByRole('button',{name:'취소',exact:true}).click()
 assert.equal(await page.locator('[data-widget-id=ocr]').count(),1)
 for(const width of [390,768,1440]) {
  await page.setViewportSize({width,height:1000})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
 }
 await page.setViewportSize({width:1440,height:1000})
 // A short widget leaves room below it beside a taller neighbor.
 await page.evaluate(()=>{
  const key=Object.keys(localStorage).find(key=>key.startsWith('routel-dashboard-board-v1:'))
  const layout=JSON.parse(localStorage.getItem(key))
  layout.order=['summary','events','map','top5',...layout.order.filter(id=>!['summary','events','map','top5'].includes(id))]
  layout.sizes.events={width:250,height:640}
  layout.sizes.map={width:750,height:300}
  layout.sizes.top5={width:500,height:280}
  localStorage.setItem(key,JSON.stringify(layout))
 })
 await page.reload()
 await page.locator('.board-customized').waitFor()
 const packed=await page.locator('.fixed-top5').boundingBox()
 const tall=await page.locator('.fixed-events').boundingBox()
 const short=await map.boundingBox()
 assert(packed.y>=short.y+short.height && packed.y<tall.y+tall.height,'Neighbors fill space below a shorter widget')
 const rectangles=await page.locator('.dashboard-fixed-item:visible').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))
 for(let a=0;a<rectangles.length;a++)for(let b=a+1;b<rectangles.length;b++) {
  const x=rectangles[a],y=rectangles[b]
  assert(!(x.x<y.right-1&&x.right>y.x+1&&x.y<y.bottom-1&&x.bottom>y.y+1),'Widgets do not overlap')
 }
 await page.getByRole('button',{name:'위젯 리스트',exact:true}).click()
 await page.getByRole('button',{name:'위젯 리스트 닫기'}).click()
 await map.locator('.board-resize-top').waitFor()
 await page.evaluate(()=>{
  const header=document.createElement('header');header.id='test-dashboard-header'
  header.style.cssText='position:fixed;top:0;left:0;right:0;height:64px;background:white;z-index:20'
  document.body.append(header)
  const spacer=document.createElement('div');spacer.id='test-scroll-spacer';spacer.style.height='1000px';document.body.append(spacer)
  const map=document.querySelector('.fixed-map')
  window.scrollTo(0,map.getBoundingClientRect().top+scrollY-20)
 })
 const topHandle=await map.locator('.board-resize-top').boundingBox()
 assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,{x:topHandle.x+topHandle.width/2,y:topHandle.y+4}),
  'test-dashboard-header','Widget resize handles stay behind the fixed page header')
 await page.evaluate(()=>{document.getElementById('test-dashboard-header').remove();document.getElementById('test-scroll-spacer').remove()})
 assert.deepEqual(errors,[])
 await page.screenshot({path:'tests/dashboard-board-preview.png'})
 console.log('통과: 기본 7개 유지, 목록 10개, 클릭·드래그 추가, 지도 사방 핸들, 크기 저장·복원, 취소, 반응형')
} finally {await browser.close();await server.close()}
