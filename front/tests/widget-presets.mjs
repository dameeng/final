import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
let server;try{await fetch('http://localhost:8282')}catch{server=await createServer({configLoader:'runner'});await server.listen()}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const p=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>localStorage.setItem('routel-handover-hide:guest:regional',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())));
await p.goto('http://localhost:8282/admin-dashboard');await p.locator('.widget-picker').waitFor({state:'attached'});await p.waitForTimeout(300);
const positions=()=>p.locator('.grid-stack-item').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.getAttribute('gs-id'),{x:el.getAttribute('gs-x')||'0',y:el.getAttribute('gs-y')||'0',w:el.getAttribute('gs-w'),h:el.getAttribute('gs-h')}])));
const before=await positions();await p.locator('#edit-on').click();await p.locator('#widget-add').click();
const size=p.locator('.widget-picker-row').filter({has:p.locator('input[aria-label="지하차도 지도 표시"]')}).locator('select');
assert.equal(await size.locator('option').count(),3);
await size.selectOption('6');const smaller=await positions();assert.equal(smaller.map.w,'6');assert.equal(smaller.map.y,before.map.y);
for(const id of Object.keys(before).filter(id=>id!=='map'))assert.deepEqual(smaller[id],before[id]);
await size.selectOption('12');assert.deepEqual(await positions(),smaller);
assert.equal(await size.inputValue(),'6');
await p.locator('.widget-picker-close').click();await p.locator('#done').click();await p.reload();await p.waitForTimeout(400);assert.equal((await positions()).map.w,'6');
assert(await p.locator('[gs-id="map"]').evaluate(el=>el.classList.contains('ui-resizable-disabled')));
assert.deepEqual(errors,[]);console.log('PASS fixed size presets, same-row resize, no neighbor movement, collision rejection, save/reload, disabled edge resizing');
}finally{await browser.close();await server?.close()}
