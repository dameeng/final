import seeds from '../data/pm-equipment.json'
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
function openReg(label){ctx.closeAll();$('reg-eq').textContent=label;$('reg').showModal();}
if($('reg-ok'))$('reg-ok').addEventListener('click',function(){$('reg').close();toast('점검 내용을 등록했어요 (등록자: ○○○)');window.__afterReg&&window.__afterReg();});

var EQ=store.pageData('pm-equipment','EQ',seeds.EQ);var cur=-1;
var peek=$('peek');
function line(series){var x0=30,x1=380,w=(x1-x0)/(series.length-1);return series.map(function(v,i){return (x0+i*w).toFixed(0)+','+(120-v*1.0).toFixed(0);}).join(' ');}
function fill(i){var e=EQ[i];cur=i;
 $('p-type').textContent=e.type;$('p-title').textContent=e.id+' · '+e.site;
 var b=$('p-badge');var l=e.score>=70?['danger','위험']:e.score>=40?['warn','주의']:['safe','안전'];b.className='badge '+l[0];b.textContent=l[1];
 $('p-score').textContent=e.score;$('p-rx').textContent=e.rx;$('p-insp').textContent=e.insp==='-'?'해당 없음':e.insp;
 $('p-reasons').innerHTML=e.reasons.length?e.reasons.map(function(r){return '<li><span>'+r[0]+'</span><strong>+'+r[1]+'</strong></li>';}).join(''):'<li><span class="sub">특이 사유 없음</span></li>';
 $('p-chart').innerHTML='<line x1="20" y1="120" x2="390" y2="120" stroke="#8a93a0"/><line x1="20" y1="50" x2="390" y2="50" stroke="#1f2630" stroke-dasharray="5 4"/><line x1="20" y1="80" x2="390" y2="80" stroke="#8a93a0" stroke-dasharray="5 4"/><text x="24" y="46" font-size="11">70</text><text x="24" y="76" font-size="11">40</text><polyline points="'+line(e.series)+'" fill="none" stroke="#2b5c8a" stroke-width="2.5"/>';
 [].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr,k){tr.classList.toggle('sel',k===i);});
}
function openPeek(i){ctx.closeAll('drawer');fill(i);peek.hidden=false;document.getElementById('scrim').hidden=false;}
function closePeek(){peek.hidden=true;[].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr){tr.classList.remove('sel')});}
window.__closeOther=function(except){if(except!=='drawer')closePeek();};
document.querySelectorAll('.row-open').forEach(function(b){b.addEventListener('click',function(){openPeek(+b.dataset.i)});});
$('peek-close').addEventListener('click',function(){ctx.closeAll();});
$('p-reg').addEventListener('click',function(){var e=EQ[cur];openReg(e.id+' · '+e.type+' · '+e.site);});
var tf='',lf='',q='';
function apply(){var n=0;[].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr){var ok=(!tf||tr.dataset.type===tf)&&(!lf||tr.dataset.lv===lf)&&(!q||tr.dataset.text.indexOf(q)>-1);tr.hidden=!ok;if(ok)n++;});$('f-count').textContent='총 '+n+'개';}
$('f-type').addEventListener('change',function(){tf=this.value;apply();});
$('f-q').addEventListener('input',function(){q=this.value.trim();apply();});
document.querySelectorAll('.chip').forEach(function(c){c.addEventListener('click',function(){lf=c.dataset.lv;document.querySelectorAll('.chip').forEach(function(x){x.setAttribute('aria-pressed',String(x===c))});apply();});});

return {

};
}
