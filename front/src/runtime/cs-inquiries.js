import seeds from '../data/cs-inquiries.json'
export function initialize(ctx) {
const { document, window, location, localStorage, sessionStorage, setTimeout, setInterval, clearTimeout, clearInterval, alert, confirm, store } = ctx;

(function(){
var side=document.getElementById('side'),scrim=document.getElementById('scrim'),mb=document.getElementById('menu-btn'),mc=document.getElementById('menu-close');
var bb=document.getElementById('bell-btn'),bp=document.getElementById('bell-pop');
function closeAll(except){
  if(except!=='side'){side.classList.remove('open');mb.setAttribute('aria-expanded','false');}
  if(except!=='bell'){bp.hidden=true;bb.setAttribute('aria-expanded','false');}
  if(window.__closeOther)window.__closeOther(except);
  scrim.hidden=(except!=='side'&&except!=='drawer');
}
window.closeAll=closeAll;
mb.addEventListener('click',function(){ctx.closeAll('side');side.classList.add('open');mb.setAttribute('aria-expanded','true');scrim.hidden=false;mc.focus();});
mc.addEventListener('click',function(){ctx.closeAll();mb.focus();});
scrim.addEventListener('click',function(){ctx.closeAll();});
bb.addEventListener('click',function(){var o=bp.hidden;ctx.closeAll(o?'bell':undefined);if(o){bp.hidden=false;bb.setAttribute('aria-expanded','true');}});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){ctx.closeAll();}});
var all=document.getElementById('read-all');
if(all){all.addEventListener('click',function(){document.querySelectorAll('.pop-list li.unread').forEach(function(li){li.classList.remove('unread')});document.getElementById('bell-count').hidden=true;});}
})();

function $(id){return document.getElementById(id);}
function toast(t){var el=$('toast');el.textContent=t;el.hidden=false;setTimeout(function(){el.hidden=true},2200);}
document.addEventListener('click',function(e){var c=e.target.closest('[data-close]');if(c){$(c.dataset.close).close();}});
var Q=store.pageData('cs-inquiries','Q',seeds.Q);
var peek=$('peek');
function openPeek(i){ctx.closeAll('drawer');fill(i);[].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr,k){tr.classList.toggle('sel',k===i);});peek.hidden=false;$('scrim').hidden=false;}
function closePeek(){peek.hidden=true;[].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr){tr.classList.remove('sel')});}
window.__closeOther=function(e){if(e!=='drawer')closePeek();};
document.addEventListener('click',function(e){var b=e.target.closest('.row-open');if(b)openPeek(+b.dataset.i);});
$('peek-close').addEventListener('click',function(){ctx.closeAll();});

function fill(i){var r=Q[i];$('p-meta').textContent='#'+r[0]+' · '+r[3]+' · '+r[4];$('p-title').textContent=r[2];$('p-cat').textContent=r[1];var s=$('p-st');s.textContent=r[5];s.className='stat '+(r[5]==='미답변'?'new':'done');$('p-body').textContent=r[6];$('p-go').textContent=r[5]==='미답변'?'답변하기 →':'답변 보기 →';}
var sf='',q='';function apply(){[].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr){tr.hidden=!((!sf||tr.dataset.st===sf)&&(!q||tr.dataset.text.indexOf(q)>-1));});}
document.querySelectorAll('#stc .chip').forEach(function(c){c.addEventListener('click',function(){sf=c.dataset.s;document.querySelectorAll('#stc .chip').forEach(function(x){x.setAttribute('aria-pressed',String(x===c))});apply();});});
$('q').addEventListener('input',function(){q=this.value.trim();apply();});

return {

};
}
