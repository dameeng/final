import seeds from '../data/fac-list.json'
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

var F=store.pageData('fac-list','F',seeds.F);var peek=$('peek');
function fill(i){var f=F[i];$('p-addr').textContent=f.addr;$('p-name').textContent=f.name;var b=$('p-badge');b.className='badge '+f.lv;b.textContent=f.lvt;
 var c=$('p-ctl');c.className='stat'+(f.ctl==='BLOCKED'?' ack':'');c.textContent=f.ctl==='BLOCKED'?'통제 중':'정상 운영';
 $('p-score').textContent=f.score+'점';$('p-g').style.width=f.score+'%';$('p-cars').textContent=f.cars+'대';$('p-rx').textContent=f.rx;
 $('p-warn').hidden=!(f.ctl==='BLOCKED'&&f.cars>0);
 $('p-devs').innerHTML=f.devs.map(function(d){var l=d[1]>=70?'위험':d[1]>=40?'주의':'안전';var k=d[1]>=70?'danger':d[1]>=40?'warn':'safe';return '<li><span>'+d[0]+'</span><span><span class="badge '+k+'">'+l+'</span> <strong>'+d[1]+'</strong></span></li>';}).join('');
 [].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr){tr.classList.remove('sel');});var r=document.querySelector('.row-open[data-i="'+i+'"]');if(r)r.closest('tr').classList.add('sel');}
function openPeek(i){ctx.closeAll('drawer');fill(i);peek.hidden=false;$('scrim').hidden=false;}
function closePeek(){peek.hidden=true;[].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr){tr.classList.remove('sel')});}
window.__closeOther=function(e){if(e!=='drawer')closePeek();};
document.querySelectorAll('.row-open').forEach(function(b){b.addEventListener('click',function(){openPeek(+b.dataset.i)});});
$('peek-close').addEventListener('click',function(){ctx.closeAll();});
var lf='',cf='',q='',del=false;
function apply(){var n=0;[].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr){var isDel=!!tr.dataset.deleted;var ok=isDel?del:((!lf||tr.dataset.lv===lf)&&(!cf||tr.dataset.ctl===cf)&&(!q||tr.dataset.text.indexOf(q)>-1));tr.hidden=!ok;if(ok&&!isDel)n++;});$('f-count').textContent='총 '+n+'곳'+(del?' (+삭제됨 1)':'');}
document.querySelectorAll('#lvchips .chip').forEach(function(c){c.addEventListener('click',function(){lf=c.dataset.lv;document.querySelectorAll('#lvchips .chip').forEach(function(x){x.setAttribute('aria-pressed',String(x===c))});apply();});});
$('f-ctl').addEventListener('change',function(){cf=this.value;apply();});$('f-q').addEventListener('input',function(){q=this.value.trim();apply();});$('f-del').addEventListener('change',function(){del=this.checked;apply();});
$('restore').addEventListener('click',function(){toast('□□(구)지하차도를 복원했어요');});

return {

};
}
