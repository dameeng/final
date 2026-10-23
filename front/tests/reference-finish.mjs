import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const css=await readFile('src/styles/reference-finish.css','utf8')
const declarations=[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/(?:^|[;{])\s*([\w-]+)\s*:/gm)].map(match=>match[1])
const geometryProperty=/^(?:display|position|inset(?:-.+)?|top|left|right|bottom|(?:min-|max-)?(?:width|height|inline-size|block-size)|padding(?:-.+)?|margin(?:-.+)?|(?:row-|column-)?gap|overflow(?:-.+)?|order|flex(?:-.+)?|grid(?:-.+)?|align-.+|justify-.+|float|clear|visibility|transform|font-size|line-height)$/
assert.deepEqual(declarations.filter(property=>geometryProperty.test(property)),[],'Finish must not change layout, spacing, visibility or font sizing')
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
await mkdir('tests/design-preview',{recursive:true})
try {
 const page=await browser.newPage(),errors=[],results=[],paints=[]
 page.setDefaultTimeout(12000)
 page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{
  localStorage.setItem('routel-session-kind',/^\/(admin-|admin-app\/|fac-|pm-|cs-|bot-)/.test(location.pathname)?'manager':'customer')
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  sessionStorage.setItem('routel-handover-seen:7:REGIONAL_ADMIN:0',today)
 })
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url()),p=url.pathname
  let data=[]
  if(p==='/api/managers/me')data={id:7,name:'관리자',role:'REGIONAL_ADMIN',regions:[]}
  else if(p==='/api/customers/me')data={id:8,name:'사용자',loginId:'customer'}
  else if(p.endsWith('unread-count'))data={count:0}
  else if(p.endsWith('facility-kpi'))data={facilityCount:23,blockedCount:1,dangerLevelCount:2,pendingReviewCount:4,remainingCount:3}
  else if(p==='/api/dashboard/timeline')data=Array.from({length:23},(_,i)=>({id:i+1,underpassId:i%5+1,underpassName:['부산진시장지하차도','장평지하차도','문현지하차도','대남지하차도','신선대지하차도'][i%5],eventType:i%2?'RISK_LEVEL_DOWN':'RISK_LEVEL_UP',riskLevel:i%2?'SAFE':'CAUTION',createdAt:`2026-10-23T12:${String(59-i).padStart(2,'0')}:00`}))
  else if(p==='/api/dashboard/risk-margin')data=Array.from({length:5},(_,i)=>({underpassId:i+1,underpassName:['부산진시장지하차도','장평지하차도','문현지하차도','대남지하차도','신선대지하차도'][i],riskScore:65-i*8,margin:5+i*8}))
  else if(['/api/notices','/api/plate-logs','/api/faqs','/api/managers/me/notifications'].includes(p)) {
   const size=Number(url.searchParams.get('size')||10),current=Number(url.searchParams.get('page')||1)
   const items=Array.from({length:23},(_,i)=>({id:i+1,title:'시설 안전 점검 및 서비스 운영 안내 '+(i+1),question:'안전 정보를 확인하는 방법은 무엇인가요?',name:'부산진시장지하차도',underpassName:'부산진시장지하차도',detectedNum:'123가4567',createdAt:'2026-10-23T12:00:00',category:'SYSTEM',body:'지하차도 현황과 통제 정보를 확인해 주세요.',read:false}))
   data={items:items.slice((current-1)*size,current*size),page:current,size,totalItems:23,totalPages:Math.ceil(23/size)}
  }
  return route.fulfill({json:{success:true,data}})
 })
 const paths=['/','/info/company','/login','/c-notice','/info/faq','/c-map','/my-home','/admin-dashboard','/admin-data/ocr','/pm-equipment','/admin-profile','/admin-app/notifications','/admin-app/screen-14','/customer-app/notices','/customer-app/screen-5','/customer-app/account/profile']
 for(const width of [320,390,768,1440]) {
  await page.setViewportSize({width,height:900})
  for(const path of paths) {
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}${path}`)
   await page.locator('#app').waitFor()
   await page.waitForTimeout(250)
   await page.evaluate(()=>document.fonts.ready)
   assert.equal(new URL(page.url()).pathname,path,`${path} must render the requested page, not an authentication redirect`)
   if(path==='/admin-dashboard') {
    await page.waitForFunction(()=>document.querySelectorAll('.fixed-events .tl>li').length===10)
    assert.equal(await page.locator('.fixed-events .tl>li').count(),10,'Dashboard must render ten real timeline cards per page')
    assert.equal(await page.locator('.fixed-top5 .rank>li').count(),5,'Dashboard must render the risk margin cards')
    assert.deepEqual(await page.locator('.fixed-summary .tiles5 .big').allTextContents(),['23','1','2','4','3'],'Dashboard KPI mock must use the production field names')
    assert.match(await page.locator('.event-pagination').innerText(),/1\s*\/\s*3/,'Twenty-three events must expose three pages')
   }
   for(const theme of ['light','dark']) {
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
    await page.waitForTimeout(180)
    const check=await page.evaluate(()=>{
     const style=document.querySelector('style[data-vite-dev-id$="/reference-finish.css"]')
     if(!style?.sheet)throw new Error('Reference finish stylesheet is missing')
     const nodes=[...document.querySelectorAll('main,header,nav,.dashboard-fixed-layout,.map-overlay-toolbar,.service-table-wrap')]
     // A new font changes intrinsic pixel track widths, but must retain the layout rules.
     const properties=['display','position','flexDirection','flexWrap','gridAutoFlow','order','alignItems','justifyContent','rowGap','columnGap','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','overflowX','overflowY']
     const geometry=()=>nodes.map(n=>{const s=getComputedStyle(n);return properties.map(property=>s[property])})
     const before=geometry();style.sheet.disabled=true;const after=geometry();style.sheet.disabled=false
     const font=getComputedStyle(document.querySelector('h1,h2,button')||document.body).fontFamily
     const fontLoaded=[...document.fonts].some(face=>face.family.replaceAll('"','').replaceAll("'",'')==='Pretendard'&&face.status==='loaded')
     const clipped=[...document.querySelectorAll('button')].filter(n=>n.getClientRects().length&&n.clientHeight>20&&n.scrollHeight>n.clientHeight+3).map(n=>n.textContent.trim()).filter(Boolean)
     return {same:JSON.stringify(before)===JSON.stringify(after),font,fontLoaded,overflow:document.documentElement.scrollWidth>innerWidth+1,clipped}
    })
    assert(check.same,`${path} layout rules changed`)
    assert(/^['"]?Pretendard/.test(check.font),`${path} must use Pretendard first`)
    assert(check.fontLoaded,`${path} self-hosted Pretendard must actually load`)
    results.push({path,width,theme,overflow:check.overflow,clipped:check.clipped})
    if(path==='/admin-dashboard'&&width===1440) {
     const paint=await page.evaluate(()=>{
      // Put controls inside the real legacy root so its !important rules participate.
      const host=document.querySelector('#app .wire-page')
      if(!host)throw new Error('Dashboard legacy .wire-page root is missing')
      const probe=document.createElement('div')
      probe.setAttribute('aria-hidden','true')
      probe.style.cssText='position:fixed;left:-10000px;top:0;pointer-events:none'
      probe.innerHTML='<article class="card">카드</article><button class="btn p">조회</button><table class="service-table"><thead><tr><th>시설</th></tr></thead></table><input value="활성 입력"><input disabled value="변경 불가"><input readonly value="읽기 전용"><button class="btn p" disabled>실행 불가</button><span data-paint-token style="background-color:var(--r-soft);color:var(--r-muted)"></span>'
      host.append(probe)
      const sample=()=>[...probe.querySelectorAll('.card,.btn,th,input')].map(node=>{const s=getComputedStyle(node);return {background:s.backgroundColor,image:s.backgroundImage,color:s.color,shadow:s.boxShadow,radius:s.borderTopLeftRadius}})
      const style=document.querySelector('style[data-vite-dev-id$="/reference-finish.css"]')
      const expectedStyle=getComputedStyle(probe.querySelector('[data-paint-token]'))
      const expectedDisabled={background:expectedStyle.backgroundColor,color:expectedStyle.color}
      const enabled=sample();style.sheet.disabled=true;const legacy=sample();style.sheet.disabled=false;probe.remove()
      return {enabled,legacy,expectedDisabled}
     })
     assert.notEqual(paint.enabled[0].background,'rgba(0, 0, 0, 0)',`${theme}: legacy !important must not leave cards transparent`)
     assert.notEqual(paint.enabled[0].shadow,'none',`${theme}: card boundary must be visible`)
     assert(parseFloat(paint.enabled[0].radius)>0,`${theme}: card corners must override legacy !important`)
     assert.notDeepEqual(paint.enabled[0],paint.legacy[0],`${theme}: card design must visibly change`)
     assert(paint.enabled[1].image.includes('gradient'),`${theme}: primary action must receive the branded fill`)
     assert.equal(paint.enabled[1].color,'rgb(255, 255, 255)',`${theme}: primary action label must remain readable`)
     assert.notDeepEqual(paint.enabled[1],paint.legacy[1],`${theme}: primary action must override legacy rules`)
     assert.notEqual(paint.enabled[2].background,'rgba(0, 0, 0, 0)',`${theme}: table headings must have a distinct surface`)
     for(const [index,label] of [[4,'disabled input'],[5,'readonly input'],[6,'disabled primary button']]) {
      assert.equal(paint.enabled[index].background,paint.expectedDisabled.background,`${theme}: ${label} must use the muted surface`)
      assert.equal(paint.enabled[index].color,paint.expectedDisabled.color,`${theme}: ${label} must use readable muted text`)
      assert.equal(paint.enabled[index].image,'none',`${theme}: ${label} must not retain an enabled gradient`)
      assert.notEqual(paint.enabled[index].background,paint.enabled[3].background,`${theme}: ${label} must be visibly distinct from enabled inputs`)
     }
     paints.push({theme,...paint})
    }
    if([390,1440].includes(width)&&['/','/c-notice','/admin-dashboard','/admin-data/ocr','/admin-app/screen-14','/customer-app/notices','/customer-app/screen-5'].includes(path)) {
     const handover=page.locator('dialog.admin-handover[open]')
     if(await handover.count())await handover.getByRole('button',{name:'확인하고 닫기',exact:true}).click()
     await page.evaluate(()=>{
      window.scrollTo(0,0)
      document.querySelectorAll('.backend-main,.page,.app-service-content').forEach(element=>{element.scrollTop=0})
      return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
     })
     // The geometry check temporarily disables CSS; allow existing paint transitions to settle.
     await page.waitForTimeout(180)
     await page.screenshot({path:`tests/design-preview/${path.replaceAll('/','_')}-${width}-${theme}.png`})
    }
   }
  }
 }
 await writeFile('tests/design-preview/reference-finish-results.json',JSON.stringify({checks:results.length,results,paints,errors},null,2))
 assert.deepEqual(errors,[])
 assert.deepEqual(results.filter(r=>r.overflow),[],'No horizontal page overflow')
 assert.deepEqual(results.filter(r=>r.clipped.length),[],'Visible button labels must not be vertically clipped')
 console.log(JSON.stringify({checks:results.length,paintChecks:paints.length,clipped:[],overflow:[]},null,2))
} finally {await browser.close();await server.close()}

