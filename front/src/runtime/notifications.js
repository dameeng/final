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

var cat='',only=false;
function counts(){var all=[].slice.call(document.querySelectorAll('#nl li'));document.querySelectorAll('.count[data-k]').forEach(function(c){var k=c.dataset.k;var n=all.filter(function(li){return li.classList.contains('unread')&&(k==='전체'||li.dataset.cat===k);}).length;c.textContent=n;c.hidden=!n;});
 var u=all.filter(function(li){return li.classList.contains('unread')}).length;var b=document.getElementById('bell-count');if(b){b.textContent=u;b.hidden=!u;}}
function apply(){var n=0;[].forEach.call(document.querySelectorAll('#nl li'),function(li){var ok=(!cat||li.dataset.cat===cat)&&(!only||li.classList.contains('unread'));li.hidden=!ok;if(ok)n++;});$('empty').hidden=n>0;counts();}
document.querySelectorAll('.nt').forEach(function(t){t.addEventListener('click',function(){cat=t.dataset.c;document.querySelectorAll('.nt').forEach(function(x){x.setAttribute('aria-selected',String(x===t))});apply();});});
$('only').addEventListener('change',function(){only=this.checked;apply();});
$('readall').addEventListener('click',function(){document.querySelectorAll('#nl li.unread').forEach(function(li){li.classList.remove('unread')});apply();toast('모두 읽음 처리했어요');});
$('nl').addEventListener('click',function(e){var b=e.target.closest('button.n');if(!b)return;var li=b.closest('li');li.classList.remove('unread');apply();toast('읽음 처리 · '+b.dataset.href+' 으로 이동 ');});
apply();

return {

};
}
