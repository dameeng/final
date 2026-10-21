import {pmApi,LEVEL_CLASS,score,change,when,esc,badge,resetReg,setOpenCount} from './pm-api.js'
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
// 저장 버튼은 팀 meeting.ts 가 가로채서 workflows.maintenance(pm-api.js) 로 저장함. 창이 닫히면 목록 새로고침
resetReg(document,store);if($('reg'))$('reg').addEventListener('close',function(){resetReg(document,store);load();});

var EQ=[];var cur=-1;var alive=true;ctx.on(ctx.root,'page-dispose',function(){alive=false});
var peek=$('peek');var tbody=document.querySelector('#tbl tbody');
function row(e,i){
 var insp=e.openEventStatusLabel?'<span class="stat '+(e.openEventStatus==='IN_PROGRESS'?'work':'new')+'">'+esc(e.openEventStatusLabel)+'</span>':'<span class="sub">-</span>';
 return '<tr data-type="'+esc(e.typeLabel)+'" data-lv="'+esc(e.levelLabel||'')+'" data-text="'+esc(e.code+' '+e.underpassName)+'"><td><button type="button" class="link row-open" data-i="'+i+'">'+esc(e.code)+'</button></td><td>'+esc(e.typeLabel)+'</td><td>'+esc(e.underpassName)+'</td><td>'+(e.level?badge(e.level,e.levelLabel)+' ':'')+'<strong>'+score(e.score)+'</strong></td><td>'+change(e.change)+'</td><td>'+when(e.predictedAt)+'</td><td>'+insp+'</td></tr>';
}
function render(){
 tbody.innerHTML=EQ.length?EQ.map(row).join(''):'<tr><td colspan="7" class="sub">아직 계산된 설비 점수가 없어요.</td></tr>';
 var sel=document.querySelector('select[aria-label="시설 선택"]');
 if(sel){var v=sel.value,names=[...new Set(EQ.map(function(e){return e.underpassName}))].sort();sel.innerHTML='<option value="">시설 전체</option>'+names.map(function(n){return '<option>'+esc(n)+'</option>'}).join('');sel.value=names.includes(v)?v:'';}
 setOpenCount(ctx.root,EQ.filter(function(e){return e.openEventId}).length);
 apply();
}
function load(){
 return pmApi.equipments().then(function(list){if(!alive)return;EQ=list||[];render();
  var requested=new URLSearchParams(location.search).get('equipment');
  if(cur>=0&&!peek.hidden){var keep=EQ.findIndex(function(e){return e.equipId===openId});if(keep>=0)fill(keep);}
  else if(requested){var index=EQ.findIndex(function(e){return e.code===requested});if(index>=0)openPeek(index);}
 }).catch(function(e){if(alive)tbody.innerHTML='<tr><td colspan="7" class="sub">'+esc(e.message)+'</td></tr>';});
}
var openId=null;
function chart(points,th){
 var vals=points.map(function(p){return Number(p.value)});if(vals.length<2)return '<text x="20" y="70" font-size="12" fill="#5b6572">추이 데이터가 부족해요</text>';
 var x0=30,x1=380,w=(x1-x0)/(vals.length-1);function y(v){return (120-v).toFixed(0)}
 var s='<line x1="20" y1="120" x2="390" y2="120" stroke="#8a93a0"/>';
 th.forEach(function(t,k){s+='<line x1="20" y1="'+y(t)+'" x2="390" y2="'+y(t)+'" stroke="'+(k?'#8a93a0':'#1f2630')+'" stroke-dasharray="5 4"/><text x="24" y="'+(y(t)-4)+'" font-size="11">'+t+'</text>'});
 return s+'<polyline points="'+vals.map(function(v,i){return (x0+i*w).toFixed(0)+','+y(v)}).join(' ')+'" fill="none" stroke="#2b5c8a" stroke-width="2.5"/>';
}
function fill(i){var e=EQ[i];cur=i;openId=e.equipId;
 peek.querySelector('a[href^="/pm-equipment-detail"]').href='/pm-equipment-detail?equipment='+encodeURIComponent(e.code);
 $('p-type').textContent=e.typeLabel;$('p-title').textContent=e.code+' · '+e.underpassName;
 var b=$('p-badge');b.className='badge '+(LEVEL_CLASS[e.level]||'safe');b.textContent=e.levelLabel||'-';
 $('p-score').textContent=score(e.score);$('p-rx').textContent=when(e.predictedAt);$('p-insp').textContent=e.openEventStatusLabel||'해당 없음';
 $('p-reg').disabled=!e.openEventId;$('p-reg').title=e.openEventId?'':'점검 대상이 아니에요';
 $('p-reasons').innerHTML='<li><span class="sub">불러오는 중…</span></li>';$('p-chart').innerHTML='';
 [].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr,k){tr.classList.toggle('sel',k===i);});
 Promise.all([pmApi.detail(e.equipId),pmApi.trend(e.equipId,7)]).then(function(r){if(!alive||openId!==e.equipId)return;var d=r[0],t=r[1];
  var top=(d.reasons||[]).filter(function(x){return Number(x.points)>=1}).sort(function(a,b){return b.points-a.points}).slice(0,3);
  $('p-reasons').innerHTML=top.length?top.map(function(x){return '<li><span>'+esc(x.label)+'</span><strong>+'+score(x.points)+'</strong></li>'}).join(''):'<li><span class="sub">특이 사유 없음</span></li>';
  var th=(d.thresholds||[]).filter(function(x){return x.level!=='SAFE'}).map(function(x){return Number(x.minScore)}).sort(function(a,b){return b-a});
  $('p-chart').innerHTML=chart(t.scores||[],th);
 }).catch(function(err){$('p-reasons').innerHTML='<li><span class="sub">'+esc(err.message)+'</span></li>'});
}
function openPeek(i){ctx.closeAll('drawer');fill(i);peek.hidden=false;document.getElementById('scrim').hidden=false;}
function closePeek(){peek.hidden=true;openId=null;[].forEach.call(document.querySelectorAll('#tbl tbody tr'),function(tr){tr.classList.remove('sel')});}
window.__closeOther=function(except){if(except!=='drawer')closePeek();};
tbody.addEventListener('click',function(ev){var b=ev.target.closest('.row-open');if(b)openPeek(+b.dataset.i);});
$('peek-close').addEventListener('click',function(){ctx.closeAll();});
$('p-reg').addEventListener('click',function(){var e=EQ[cur];if(!e||!e.openEventId)return;openReg(e.code+' · '+e.typeLabel+' · '+e.underpassName);});
var tf='',lf='',q='',ff='';
function apply(){var n=0;[].forEach.call(document.querySelectorAll('#tbl tbody tr[data-type]'),function(tr){var ok=(!tf||tr.dataset.type===tf)&&(!lf||tr.dataset.lv===lf)&&(!q||tr.dataset.text.indexOf(q)>-1)&&(!ff||tr.dataset.text.indexOf(ff)>-1);tr.hidden=!ok;if(ok)n++;});$('f-count').textContent='총 '+n+'개';}
$('f-type').addEventListener('change',function(){tf=this.value;apply();});
$('f-q').addEventListener('input',function(){q=this.value.trim();apply();});
var fsel=document.querySelector('select[aria-label="시설 선택"]');if(fsel)fsel.addEventListener('change',function(){ff=this.value;apply();});
document.querySelectorAll('.chip').forEach(function(c){c.addEventListener('click',function(){lf=c.dataset.lv;document.querySelectorAll('.chip').forEach(function(x){x.setAttribute('aria-pressed',String(x===c))});apply();});});
load();setInterval(load,60000);

return {

};
}
