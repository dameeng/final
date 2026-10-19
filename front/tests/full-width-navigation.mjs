import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
let server;
try { await fetch('http://localhost:8282') } catch { server=await createServer({configLoader:'runner'});await server.listen() }
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
const p=await browser.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>console.log('ERROR',e.message));
await p.addInitScript(()=>localStorage.setItem('routel-handover-hide:guest:regional',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())));
await p.goto('http://localhost:8282/admin-dashboard');
await p.locator('.widget-picker').waitFor({state:'attached'});
await p.waitForTimeout(500);
assert((await p.locator('.page').boundingBox()).width >= 1900);
assert(await p.locator('.widget-picker').isHidden());
assert.equal(await p.locator('.side-user').getAttribute('href'),'/admin-profile');
assert.equal(await p.locator('.side-bot a').count(),4);
await p.locator('#edit-on').click();assert(await p.locator('.widget-picker').isHidden());
await p.waitForTimeout(500);await p.locator('#widget-add').click();await p.locator('.widget-picker').waitFor({state:'visible'});
console.log('PASS full width, profile link, navigation links, widget picker opens only on request');
}finally{await browser.close();await server?.close()}
