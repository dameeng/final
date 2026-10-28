const prefix='routel-customer-guide-v1:'
const memory=new Map<string,string>()
function read(key:string){try{return localStorage.getItem(prefix+key)||memory.get(key)}catch{return memory.get(key)}}
function write(key:string,value:string){memory.set(key,value);try{localStorage.setItem(prefix+key,value)}catch{/* The current tab still remembers the guide. */}}
function remove(key:string){memory.delete(key);try{localStorage.removeItem(prefix+key)}catch{/* Storage can be unavailable. */}}
export function markCustomerSignup(loginId:string){write('signup:'+encodeURIComponent(loginId.trim()),'pending')}
export function queueCustomerGuide(loginId:string,accountId:string){
  const key='signup:'+encodeURIComponent(loginId.trim())
  if(read(key)!=='pending')return
  if(read('account:'+accountId)!=='done')write('account:'+accountId,'pending')
  remove(key)
  window.dispatchEvent(new Event('routel-customer-guide-ready'))
}
export function customerGuidePending(accountId:string){return read('account:'+accountId)==='pending'}
export function completeCustomerGuide(accountId:string){write('account:'+accountId,'done')}
export function openCustomerGuide(){window.dispatchEvent(new Event('routel-customer-guide-open'))}
