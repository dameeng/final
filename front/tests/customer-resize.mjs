import {chromium} from '@playwright/test';import {createServer} from 'vite';import assert from 'node:assert/strict';
let server;try{await fetch('http://localhost:8282')}catch{server=await createServer({configLoader:'runner'});await server.listen()}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>r.abort());
for(const width of [1920,1440,1100,768,390])for(const zoom of [0.8,1,1.25,1.5]){
 await page.setViewportSize({width,height:800});await page.goto('http://localhost:8282/info/company');await page.locator('.customer-main-nav').waitFor();await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);
 await page.mouse.move(0,799);const beforeHeader=await page.locator('.customer-header').boundingBox(),beforeLayout=await page.locator('.customer-page-layout').boundingBox(),beforeNav=await page.locator('.customer-main-nav').boundingBox();
 await page.locator('.customer-menu-link').first().hover();await page.locator('#customer-header-dropdown').waitFor();
 const mainColumns=await page.locator('.customer-menu-link').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.x+r.width/2}));
 const subColumns=await page.locator('.header-dropdown-column').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.x+r.width/2}));
 mainColumns.forEach((x,i)=>assert(Math.abs(x-subColumns[i])<2,'submenu column alignment '+width+'/'+zoom));
 if(width>=1400){const centered=await page.evaluate(()=>{const n=document.querySelector('.customer-main-nav').getBoundingClientRect(),h=document.querySelector('.customer-header-inner').getBoundingClientRect();return Math.abs(n.x+n.width/2-h.x-h.width/2)<2});assert(centered,'main navigation centered '+width+'/'+zoom)}
 const layout=await page.locator('.customer-page-layout').boundingBox(),header=await page.locator('.customer-header').boundingBox(),nav=await page.locator('.customer-main-nav').boundingBox();assert(Math.abs(header.height-beforeHeader.height)<1&&Math.abs(layout.y-beforeLayout.y)<1&&Math.abs(nav.y-beforeNav.y)<1,'hover shifts header/content '+width+'/'+zoom);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'company overflow '+width+'/'+zoom);
 const blocked=await page.locator('.customer-header a,.customer-header button').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.bottom<innerHeight&&r.right<innerWidth}).filter(e=>{const r=e.getBoundingClientRect();return !e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}).map(e=>e.textContent));assert.deepEqual(blocked,[],'blocked navigation '+width+'/'+zoom);
 await page.goto('http://localhost:8282/c-map');await page.locator('#lst .it').first().waitFor();await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);await page.locator('#lst .it').first().click();
 const details=page.locator('.swapped-detail'),content=page.locator('#det');await details.waitFor();const dr=await details.boundingBox(),cr=await content.boundingBox();assert(dr.height>=cr.height-1,'clipped details '+width+'/'+zoom);
 await page.locator('#cctvb').scrollIntoViewIfNeeded();assert(await page.locator('#cctvb').evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight+1&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'hidden CCTV action '+width+'/'+zoom);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'map overflow '+width+'/'+zoom);
 console.log('PASS',width,zoom*100+'%');
}
assert.deepEqual(errors,[]);console.log('PASS resize/zoom: readable menus, hover preserves header and content positions, unclipped facility details and CCTV action');
}finally{await browser.close();await server?.close()}
