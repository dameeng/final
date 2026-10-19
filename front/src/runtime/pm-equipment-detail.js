import seeds from '../data/pm-equipment-detail.json'
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

var D=store.pageData('pm-equipment-detail','D',seeds.D);
function draw(k){var d=D[k],all=d.v.concat(d.lines.map(function(l){return l[0]}));var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all);var pad=(mx-mn)*.1||1;mn-=pad;mx+=pad;
 function y(v){return 200-(v-mn)/(mx-mn)*170;}function x(i){return 90+i*(960/6);}
 var s='<line x1="50" y1="210" x2="1070" y2="210" stroke="#8a93a0"/>';
 d.lines.forEach(function(l,i){s+='<line x1="50" y1="'+y(l[0])+'" x2="1070" y2="'+y(l[0])+'" stroke="'+(i?'#8a93a0':'#1f2630')+'" stroke-width="1.5" stroke-dasharray="6 5"/><text x="56" y="'+(y(l[0])-6)+'" font-size="13" fill="#5b6572">'+l[1]+' '+l[0]+d.u+'</text>';});
 s+='<polyline fill="none" stroke="#2b5c8a" stroke-width="3" points="'+d.v.map(function(v,i){return x(i)+','+y(v)}).join(' ')+'"/>';
 d.v.forEach(function(v,i){s+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="'+(i===6?6:4)+'" fill="#2b5c8a"/>';});
 s+='<text x="50" y="232" font-size="13" fill="#5b6572">7일 전</text><text x="1030" y="232" font-size="13" fill="#5b6572">오늘</text><text x="'+(x(6)-20)+'" y="'+(y(d.v[6])-12)+'" font-size="14" font-weight="700">'+d.v[6]+d.u+'</text>';
 $('trend').innerHTML=s;}
draw('score');
document.querySelectorAll('#mtabs .chip').forEach(function(c){c.addEventListener('click',function(){document.querySelectorAll('#mtabs .chip').forEach(function(x){x.setAttribute('aria-pressed',String(x===c))});draw(c.dataset.m);});});
$('d-reg').addEventListener('click',function(){openReg('P-01 · 배수펌프 · 초량1지하차도');});

return {

};
}
