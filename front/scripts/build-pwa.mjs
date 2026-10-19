import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function files(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory())result.push(...await files(path));else result.push(path)}return result}
const paths=(await files('dist')).filter(p=>!['sw.js','_redirects','_headers'].includes(p.split('/').at(-1)));
const hash=createHash('sha256');for(const path of paths)hash.update(await readFile(path));
const cache='routel-static-'+hash.digest('hex').slice(0,12);
const assets=paths.map(p=>'/'+p.slice(5));
await writeFile('dist/sw.js',`
const CACHE=${JSON.stringify(cache)},ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('routel-static-')&&name!==CACHE)await caches.delete(name);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'){event.respondWith((async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);try{return await fetch(request,{signal:controller.signal})}catch{return await (await caches.open(CACHE)).match('/index.html')}finally{clearTimeout(timer)}})());return}
 if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(request)));
});
`);
console.log('PWA shell generated:',assets.length,'files;',cache);
