import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const origin=process.env.PWA_TEST_ORIGIN||'http://localhost:8283';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const kind of ['customer','admin']){
  await page.goto(`${origin}/${kind}-app/screen-1`);
  const link=await page.locator('link[rel=manifest]').getAttribute('href');assert(link.endsWith(`/${kind}.webmanifest`));
  const manifest=await (await context.request.get(origin+'/'+kind+'.webmanifest')).json();assert.equal(manifest.scope,`/${kind}-app/`);assert.equal(manifest.display,'standalone');assert(manifest.icons.some(i=>i.sizes==='192x192'));assert(manifest.icons.some(i=>i.sizes==='512x512'));
  for(const icon of manifest.icons){const response=await context.request.get(origin+icon.src);assert.equal(response.status(),200);assert.equal(response.headers()['content-type'],'image/png')}
 }
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.goto(origin+'/admin-app/screen-3?preview=1');await page.locator('.mobile-page').waitFor();
 assert((await page.locator('.ph').boundingBox()).width<=430);
 const cdp=await context.newCDPSession(page);const install=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(install.installabilityErrors.filter(error=>error.errorId!=='in-incognito'),[]);
 console.log('checking offline reload');await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.locator('.mobile-page').waitFor();console.log('offline reload passed; browser online:',await page.evaluate(()=>navigator.onLine));
 await page.goto(origin+'/customer-app/screen-5?preview=1',{waitUntil:'domcontentloaded'});await page.locator('.mobile-page').waitFor();
 assert.equal(await page.evaluate(async()=>{for(const name of await caches.keys()){const cache=await caches.open(name);if((await cache.keys()).some(r=>new URL(r.url).pathname.startsWith('/api/')))return true}return false}),false);
 assert.deepEqual(errors,[]);console.log('PASS both PWA manifests/icons, Chrome installability, active service worker, offline app navigation, no API caching, mobile width');
}finally{await browser.close()}
