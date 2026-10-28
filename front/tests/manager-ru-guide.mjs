import {chromium,expect} from '@playwright/test'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:0,strictPort:false}})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage({viewport:{width:430,height:932}})
  const errors=[],mutations=[],paths=[],reads=[]
  page.on('pageerror',e=>errors.push(e.stack||e.message))
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.route('https://dapi.kakao.com/**',r=>r.abort())
  const facility={id:71,name:'초량지하차도',roadAddress:'부산광역시 동구',regionName:'동구',manageable:true,currentStatus:'NORMAL',currentRiskLevel:'SAFE'}
  const equipment={equipId:81,name:'C-71-1',type:'CCTV',underpassName:facility.name,score:21,level:'SAFE'}
  await page.route('**/api/**',r=>{
    const req=r.request(),path=new URL(req.url()).pathname
    reads.push(req.url())
    if(!['GET','HEAD','OPTIONS'].includes(req.method()))mutations.push(req.method()+' '+path)
    let data={items:[],page:1,totalItems:0,totalPages:1}
    if(path==='/api/managers/me')data={id:1,name:'관리자',role:'REGIONAL_ADMIN',regions:[{id:1,name:'동구'}]}
    else if(path==='/api/customers/me')data=null
    else if(path==='/api/regions')data=[{id:1,name:'동구'}]
    else if(path==='/api/underpasses')data={...data,items:[{...facility,id:72,name:'감천지하차도'},facility],totalItems:2}
    else if(path==='/api/underpasses/71')data=facility
    else if(path==='/api/pm/equipments')data={...data,items:[equipment],totalItems:1}
    else if(path==='/api/pm/events')data={...data,items:[{...equipment,eventId:91,status:'CHECK_NEEDED',currentScore:21},{...equipment,eventId:92,status:'IN_PROGRESS',currentScore:21}],totalItems:2}
    else if(path==='/api/pm/equipments/81')data={equipment,detail:{features:[],extra:{}},topCauses:[],recentActions:[],cautionMin:40,dangerMin:70}
    else if(path.endsWith('/sensor-trend'))data={points:[],baseline:null}
    else if(path.endsWith('/scores')||path.endsWith('/risk-forecast')||path.endsWith('/risk-scores')||path.endsWith('/cameras'))data=[]
    else if(path.endsWith('/thresholds')&&path.includes('/equipments/'))data={history:[],cautionMin:40,dangerMin:70}
    else if(path.startsWith('/api/dashboard/'))data={blockedCount:0}
    return r.fulfill({json:{success:true,data}})
  })
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  await page.goto(base+'/admin-app/screen-14')
  const launch=page.getByRole('button',{name:'루와 관리자 사용법 보기'})
  await expect(launch).toBeVisible()
  await launch.click()
  const dialog=page.locator('.manager-ru-guide')
  await expect(dialog).toHaveAttribute('open','')
  await expect(dialog.getByRole('heading')).toContainText('관리자 업무')
  await expect(dialog).toContainText('대신 실행하지는 않아요')
  // Wait until the read-only examples have been selected before touring details.
  await expect.poll(()=>reads.some(url=>url.includes('/api/pm/equipments?page=1&size=1'))).toBe(true)
  await dialog.getByRole('button',{name:'루와 둘러보기'}).click()
  const titles=[]
  while(await dialog.getByRole('button',{name:'다음',exact:true}).count()) {
    if(new URL(page.url()).pathname==='/admin-app/screen-3'){
      await expect(page.locator('.admin-map-search')).toBeVisible()
      await expect.poll(()=>page.locator('.map-only-live').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(400)
      await expect(page.locator('.app-restored-body')).not.toHaveClass(/ru-guide-scroll-space/)
    }
    if(new URL(page.url()).pathname==='/admin-app/contacts'){
      await expect(dialog.locator('.ru-guide-spotlight')).toBeVisible()
      await expect(dialog).toContainText('임시 번호')
      await expect.poll(()=>page.locator('.jurisdiction-phone-list').evaluate(el=>{
        const box=el.getBoundingClientRect(),area=el.closest('.app-restored-body,.app-extra-body').getBoundingClientRect()
        return box.top>=area.top-2&&box.top<area.top+40
      })).toBe(true)
    }
    if(new URL(page.url()).pathname==='/admin-app/pm-daily'){
      await expect.poll(()=>page.locator('.daily-mobile-chart').evaluate(el=>{
        const box=el.getBoundingClientRect(),area=el.closest('.app-restored-body,.app-extra-body').getBoundingClientRect()
        return box.top>=area.top-2&&box.top<area.top+40
      })).toBe(true)
    }
    const title=await dialog.getByRole('heading').innerText()
    if(title.includes('기록 추가로')||title.includes('점검 시작으로')||title.includes('점검 종료 시')){
      await expect(page.locator('.pm-action-field')).toBeVisible()
      await expect(page.locator('.pm-action-field textarea')).toHaveValue('')
      const expected=title.includes('기록 추가로')?'기록 추가':title.includes('점검 시작으로')?'점검 시작':'점검 종료'
      await expect(page.getByRole('radio',{name:expected,exact:true})).toBeChecked()
    }
    if((await dialog.getByRole('heading').innerText()).includes('상세 분석에서')){
      await expect.poll(()=>page.locator('.pm-evidence-card').evaluate(el=>{
        const box=el.getBoundingClientRect(),area=el.closest('.app-restored-body,.app-extra-body').getBoundingClientRect()
        return box.top>=area.top-2&&box.top<area.bottom-20
      })).toBe(true)
    }
    if((await dialog.getByRole('heading').innerText()).includes('원인 센서 추이에서')){
      await expect.poll(()=>page.locator('.pm-sensor-card').evaluate(el=>{
        const box=el.getBoundingClientRect(),area=el.closest('.app-restored-body,.app-extra-body').getBoundingClientRect()
        return box.top>=area.top-2&&box.top<area.top+40
      })).toBe(true)
      await page.locator('.pm-evidence-card').evaluate(el=>el.style.minHeight='1200px')
      await expect.poll(()=>page.locator('.pm-sensor-card').evaluate(el=>{
        const box=el.getBoundingClientRect(),area=el.closest('.app-restored-body,.app-extra-body').getBoundingClientRect()
        return box.top>=area.top-2&&box.top<area.top+40
      })).toBe(true)
    }
    if(new URL(page.url()).pathname==='/admin-app/reviews') {
      await expect.poll(()=>page.locator('.app-restored-body').evaluate(el=>el.scrollTop)).toBeGreaterThan(0)
      await expect.poll(()=>page.locator('.service-table-wrap tbody tr').first().evaluate(el=>{
        const box=el.getBoundingClientRect(),area=el.closest('.app-restored-body,.app-extra-body').getBoundingClientRect()
        return box.top>=area.top-2&&box.top<area.bottom-20
      })).toBe(true)
    }
    await expect(page.locator('.app-facility-section')).toHaveCount(0)
    titles.push(await dialog.getByRole('heading').innerText());paths.push(new URL(page.url()).pathname+new URL(page.url()).search)
    assert(new URL(page.url()).pathname.startsWith('/admin-app/'),'Tutorial stays inside the manager app')
    const box=await dialog.locator('.ru-guide-card').boundingBox()
    assert(box.x>=0&&box.x+box.width<=430&&box.y>=0&&box.y+box.height<=932,'Coach card stays inside the app')
    await dialog.getByRole('button',{name:'다음',exact:true}).click()
    await expect(dialog.getByRole('button',{name:'이전',exact:true})).toBeEnabled()
  }
  assert(titles.length>=28,'Detailed manager workflow retains the remaining steps')
  assert(paths.some(p=>p.includes('id=71')&&p.includes('tab=overview')),'Actual owned facility is used')
  assert(paths.some(p=>p.includes('id=81')),'Actual equipment is used')
  for(const width of [320,430])for(const theme of ['light','dark']) {
    await page.setViewportSize({width,height:700})
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
    const box=await dialog.locator('.ru-guide-card').boundingBox()
    assert(box.x>=0&&box.x+box.width<=width&&box.y+box.height<=700,'Responsive guide fits')
  }
  await dialog.getByRole('button',{name:'안내 마치기'}).click()
  await expect(dialog).not.toHaveAttribute('open','')
  await expect(page).toHaveURL(base+'/admin-app/screen-14')
  await page.getByRole('button',{name:'루와 관리자 사용법 보기'}).click()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toHaveAttribute('open','')
  assert.deepEqual(mutations,[],'Guide does not change operational data')
  assert.deepEqual(errors,[])
  console.log('PASS detailed manager guide, real facility/equipment, app-only navigation, no mutations, replay, Escape and responsive themes')
}finally{await browser.close();await server.close()}
