import seeds from '../data/logs.json'
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

var L=store.pageData('logs','L',seeds.L);var LINK=store.pageData('logs','LINK',seeds.LINK);var peek=$('peek');
function openPeek(i){var r=L[i];ctx.closeAll('drawer');$('p-when').textContent=r[0];$('p-text').textContent=r[3];$('p-cat').textContent=r[1];$('p-site').textContent=r[2];$('p-who').textContent=r[4];
 var d=r[5];$('p-diffw').hidden=!d;if(d){var x=d.split('|');$('p-b').textContent=x[0];$('p-a').textContent=x[1];}
 var l=LINK[r[1]];var g=$('p-go');g.hidden=!l[0];if(l[0]){g.href=l[0];g.textContent=l[1]+' →';}
 [].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr,k){tr.classList.toggle('sel',k===i);});peek.hidden=false;$('scrim').hidden=false;}
function closePeek(){peek.hidden=true;[].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr){tr.classList.remove('sel')});}
window.__closeOther=function(e){if(e!=='drawer')closePeek();};
document.querySelectorAll('.row-open').forEach(function(b){b.addEventListener('click',function(){openPeek(+b.dataset.i)});});
$('peek-close').addEventListener('click',function(){ctx.closeAll();});
var cat='',q='',facilityFilter=$('facility-filter'),facility=new URLSearchParams(window.location.search).get('facility')||'';
if(facilityFilter){facilityFilter.value=facility;facility=facilityFilter.value;facilityFilter.addEventListener('change',function(){facility=this.value;apply();});}
function apply(){var n=0;[].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr){var ok=(!cat||tr.dataset.cat===cat)&&(!q||tr.dataset.text.indexOf(q)>-1)&&(!facility||tr.children[2].textContent.trim()===facility);tr.hidden=!ok;if(ok)n++;});$('cnt').textContent='총 '+n+'건';}
document.querySelectorAll('.ct').forEach(function(t){t.addEventListener('click',function(){cat=t.dataset.c;document.querySelectorAll('.ct').forEach(function(x){x.setAttribute('aria-selected',String(x===t))});apply();});});
$('q').addEventListener('input',function(){q=this.value.trim();apply();});apply();

return {

};
}
