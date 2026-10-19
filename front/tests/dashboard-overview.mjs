import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
let server;try{await fetch('http://localhost:8282')}catch{server=await createServer({configLoader:'runner'});await server.listen()}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const p=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>localStorage.setItem('routel-handover-hide:guest:regional',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())));
await p.goto('http://localhost:8282/admin-dashboard');await p.locator('.widget-picker').waitFor({state:'attached'});await p.waitForTimeout(500);
for(const height of [1080,900]){
await p.setViewportSize({width:1920,height});await p.reload();await p.waitForTimeout(500);
const data=await p.evaluate(()=>({height:document.documentElement.scrollHeight,viewport:innerHeight,summary:document.querySelector('[gs-id="summary"]').getBoundingClientRect().height,grid:document.querySelector('#grid').getBoundingClientRect().bottom}));console.log(height,data);assert(data.grid<=height);assert(data.summary<=85);assert(data.height<=height+20);
}
await p.evaluate(async()=>{const {pageFriendlyMapScroll}=await import('/src/runtime/mapScroll.ts');const host=document.createElement('div');document.body.append(host);let level=5,zoomable=true;const dispose=pageFriendlyMapScroll(host,{setZoomable:v=>zoomable=v,getLevel:()=>level,setLevel:v=>level=v});const plain=new WheelEvent('wheel',{deltaY:100,cancelable:true,bubbles:true});host.dispatchEvent(plain);if(plain.defaultPrevented||level!==5||zoomable)throw Error('ordinary wheel blocked');const zoom=new WheelEvent('wheel',{deltaY:-100,ctrlKey:true,cancelable:true,bubbles:true});host.dispatchEvent(zoom);if(!zoom.defaultPrevented||level!==4)throw Error('Ctrl zoom failed');dispose();host.remove()});
assert.deepEqual(errors,[]);console.log('PASS compact default layout and ordinary/Ctrl map wheel behavior');
}finally{await browser.close();await server?.close()}
