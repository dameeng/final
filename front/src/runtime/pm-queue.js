import {pmApi,STATUS_CLASS,score,when,esc,badge,resetReg,setOpenCount} from './pm-api.js'
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
function openReg(label){ctx.closeAll();resetReg(document,store);$('reg-eq').textContent=label;$('reg').showModal();}
// '조치 등록'(.q-act) 버튼과 저장 버튼은 팀 meeting.ts 가 가로채서 창을 열고 workflows.maintenance(pm-api.js) 로 저장함
resetReg(document,store);if($('reg'))$('reg').addEventListener('close',function(){resetReg(document,store);load();});

var Q=[],alive=true;ctx.on(ctx.root,'page-dispose',function(){alive=false});
var tbody=document.querySelector('#qtbl tbody');
var sf=new URLSearchParams(location.search).get('pending')?'open':'',lf='',tf='';
function row(e,i){var st=STATUS_CLASS[e.status]||'done';
 var act=e.status==='CHECK_NEEDED'?'<button type="button" class="btn sm q-start" data-i="'+i+'">점검 시작</button> ':'';
 if(e.status==='CHECK_NEEDED'||e.status==='IN_PROGRESS')act+='<button type="button" class="btn sm q-act" data-i="'+i+'">조치 등록</button>';else act='<span class="sub">'+esc(e.lastAction?'조치 기록 있음':'-')+'</span>';
 return '<tr data-st="'+st+'" data-lv="'+esc(e.levelLabel||'')+'" data-type="'+esc(e.typeLabel)+'" data-i="'+i+'"><td><span class="stat '+st+'">'+esc(e.statusLabel)+'</span></td><td class="sub">'+when(e.createdAt)+'</td><td><a class="link" href="/pm-equipment-detail?equipment='+encodeURIComponent(e.code)+'">'+esc(e.code)+'</a><div class="sub">'+esc(e.typeLabel+' · '+e.underpassName)+'</div></td><td>'+esc(e.reason||(e.levelLabel+' 진입'))+'</td><td>'+badge(e.level,e.levelLabel)+' <strong>'+score(e.score)+'</strong>'+(e.currentScore!=null&&score(e.currentScore)!==score(e.score)?'<div class="sub">지금 '+score(e.currentScore)+'</div>':'')+'</td><td>'+act+'</td></tr>';}
function counts(){var c={'':Q.length,new:0,work:0,done:0};Q.forEach(function(e){c[STATUS_CLASS[e.status]||'done']++});
 document.querySelectorAll('#qchips .chip').forEach(function(b){var k=b.dataset.st;var n=k==='open'?c.new+c.work:c[k];var sub=b.querySelector('.sub');if(sub)sub.textContent=String(n||0);});
 setOpenCount(ctx.root,c.new+c.work);}
function apply(){[].forEach.call(tbody.querySelectorAll('tr[data-st]'),function(tr){var st=tr.dataset.st;var ok=(!sf||(sf==='open'?st!=='done':st===sf))&&(!lf||tr.dataset.lv===lf)&&(!tf||tr.dataset.type===tf)&&(!ff||tr.textContent.indexOf(ff)>-1);tr.hidden=!ok;});
 document.querySelectorAll('#qchips .chip').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.st===sf))});}
function load(){return pmApi.events(false).then(function(list){if(!alive)return;Q=list||[];
 tbody.innerHTML=Q.length?Q.map(row).join(''):'<tr><td colspan="6" class="sub">점검 대상이 없어요.</td></tr>';counts();facilities();apply();
}).catch(function(e){if(alive)tbody.innerHTML='<tr><td colspan="6" class="sub">'+esc(e.message)+'</td></tr>';});}
tbody.addEventListener('click',function(ev){var b=ev.target.closest('.q-start');if(!b)return;var e=Q[+b.dataset.i];if(!e)return;
 b.disabled=true;pmApi.changeStatus(e.eventId,'IN_PROGRESS').then(function(){toast(e.code+' 점검을 시작했어요.');load();}).catch(function(err){b.disabled=false;toast(err.message);});});
document.querySelectorAll('#qchips .chip').forEach(function(c){c.addEventListener('click',function(){sf=c.dataset.st;apply();});});
var ff='';
function facilities(){var sel=document.querySelector('select[aria-label="시설 선택"]');if(!sel)return;var v=sel.value,names=[...new Set(Q.map(function(e){return e.underpassName}))].sort();sel.innerHTML='<option value="">시설 전체</option>'+names.map(function(n){return '<option>'+esc(n)+'</option>'}).join('');sel.value=names.includes(v)?v:'';ff=sel.value;
 if(!sel.dataset.pm){sel.dataset.pm='1';sel.addEventListener('change',function(){ff=this.value;apply();});}}
var lsel=document.querySelector('select[aria-label="위험 단계"]');if(lsel)lsel.addEventListener('change',function(){lf=this.value;apply();});
var tsel=document.querySelector('select[aria-label="설비 유형"]');if(tsel)tsel.addEventListener('change',function(){tf=this.value;apply();});
load();setInterval(load,60000);

return {

};
}
