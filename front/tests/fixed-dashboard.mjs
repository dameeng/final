import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {createServer} from 'vite';
let server;try{await fetch('http://localhost:8282')}catch{server=await createServer({configLoader:'runner'});await server.listen()}
const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>localStorage.setItem('routel-handover-hide:guest:regional',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())));await p.goto('http://localhost:8282/admin-dashboard');await p.locator('.dashboard-fixed-layout').waitFor();await p.waitForTimeout(200);
assert.equal(await p.locator('#edit-on,.widget-picker,.grid-stack').count(),0);
const summary=await p.locator('.fixed-summary').boundingBox(),map=await p.locator('.fixed-map').boundingBox(),events=await p.locator('.fixed-events').boundingBox();assert(summary.y+summary.height<=map.y);assert(Math.abs(map.y-events.y)<2);assert(events.x<map.x);assert(map.height>=540);assert.equal(await p.locator('.dashboard-fixed-item').count(),7);
for(const width of [768,390,360]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)}
await p.screenshot({path:'test-results/fixed-dashboard-mobile.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS fixed original dashboard layout, no widget controls, large map, responsive widths, no runtime errors')
}finally{await b.close();await server?.close()}
