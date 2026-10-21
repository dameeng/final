import {pmApi,score,fullDate,esc,actionContent,actionStatus,resetReg,setOpenCount} from './pm-api.js'
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
function openReg(){ctx.closeAll();resetReg(document,store);$('reg').showModal();}
if($('reg-ok'))$('reg-ok').addEventListener('click',function(){var ev=$('reg-ev');var eventId=ev&&ev.value;if(!eventId){toast('점검 대상 설비를 골라 주세요.');return;}var content=actionContent(document);if(!content){toast('조치 내용을 적어 주세요.');return;}
 pmApi.addAction(eventId,content,actionStatus(document)).then(function(){$('reg').close();toast('점검 내용을 등록했어요.');load();}).catch(function(e){toast(e.message);});});

var H=[],OPEN=[],alive=true;ctx.on(ctx.root,'page-dispose',function(){alive=false});
var peek=$('peek'),tbody=document.querySelector('#htbl tbody');
// 조치 내용 "[현장 점검] 내용 (정상 복구)" → [유형, 내용, 결과]
function parse(a){var m=/^\[([^\]]+)\]\s*(.*?)(?:\s*\(([^()]+)\))?$/.exec(a.content||'');return m?[m[1],m[2],m[3]||a.eventStatusLabel]:['-',a.content||'',a.eventStatusLabel];}
function row(a,i){var p=parse(a);return '<tr data-text="'+esc(a.code+' '+a.underpassName)+'" data-type="'+esc(a.typeLabel)+'" data-act="'+esc(p[0])+'" data-day="'+fullDate(a.createdAt).slice(0,10)+'"><td><button type="button" class="link row-open" data-i="'+i+'">'+fullDate(a.createdAt)+'</button></td><td><a class="link" href="/pm-equipment-detail?equipment='+encodeURIComponent(a.code)+'">'+esc(a.code)+'</a><div class="sub">'+esc(a.typeLabel)+'</div></td><td>'+esc(a.underpassName)+'</td><td>'+esc(p[0])+'</td><td>'+esc(p[1])+'</td><td>'+esc(a.managerLoginId||'')+'</td><td>'+esc(p[2]||'')+'</td><td class="inl-86abdab991">'+score(a.eventScore)+' → <strong>'+score(a.currentScore)+'</strong></td></tr>';}
function load(){return Promise.all([pmApi.actions(),pmApi.events(true)]).then(function(r){if(!alive)return;H=r[0]||[];OPEN=r[1]||[];
 tbody.innerHTML=H.length?H.map(row).join(''):'<tr><td colspan="8" class="sub">점검 기록이 없어요.</td></tr>';setOpenCount(ctx.root,OPEN.length);apply();
}).catch(function(e){if(alive)tbody.innerHTML='<tr><td colspan="8" class="sub">'+esc(e.message)+'</td></tr>';});}
function openPeek(i){var a=H[i],p=parse(a);ctx.closeAll('drawer');$('p-when').textContent=fullDate(a.createdAt);$('p-title').textContent=a.code+' · '+a.underpassName;$('p-act').textContent=p[0];$('p-res').textContent=p[2]||'';$('p-memo').textContent=p[1];$('p-b').textContent=score(a.eventScore)+'점';$('p-a').textContent=score(a.currentScore)+'점';$('p-who').textContent=a.managerLoginId||'';$('p-kind').textContent=a.typeLabel;
 peek.querySelector('a[href^="/pm-equipment-detail"]').href='/pm-equipment-detail?equipment='+encodeURIComponent(a.code);
 [].forEach.call(document.querySelectorAll('#htbl tbody tr'),function(tr,k){tr.classList.toggle('sel',k===i);});peek.hidden=false;$('scrim').hidden=false;}
function closePeek(){peek.hidden=true;[].forEach.call(document.querySelectorAll('#htbl tbody tr'),function(tr){tr.classList.remove('sel')});}
window.__closeOther=function(except){if(except!=='drawer')closePeek();};
tbody.addEventListener('click',function(ev){var b=ev.target.closest('.row-open');if(b)openPeek(+b.dataset.i);});
$('peek-close').addEventListener('click',function(){ctx.closeAll();});
var tf='',af='',q=new URLSearchParams(location.search).get('equipment')||'',d0='',d1='';if(q)$('h-q').value=q;
var dates=document.querySelectorAll('.filters input[type="date"]');
function apply(){[].forEach.call(tbody.querySelectorAll('tr[data-type]'),function(tr){var day=tr.dataset.day;tr.hidden=!((!tf||tr.dataset.type===tf)&&(!af||tr.dataset.act===af)&&(!q||tr.dataset.text.indexOf(q)>-1)&&(!d0||day>=d0)&&(!d1||day<=d1));});}
$('h-type').addEventListener('change',function(){tf=this.value;apply();});$('h-q').addEventListener('input',function(){q=this.value.trim();apply();});
var asel=document.querySelector('select[aria-label="조치 유형"]');if(asel)asel.addEventListener('change',function(){af=this.selectedIndex?this.value:'';apply();});
if(dates[0])dates[0].addEventListener('change',function(){d0=this.value;apply();});if(dates[1])dates[1].addEventListener('change',function(){d1=this.value;apply();});
// 직접 등록: 지금 열려 있는 점검 대상 중에서 고름
$('h-reg').addEventListener('click',function(){
 $('reg-eq').innerHTML=OPEN.length?'<select id="reg-ev" aria-label="점검 대상 설비">'+OPEN.map(function(e){return '<option value="'+e.eventId+'">'+esc(e.code+' · '+e.typeLabel+' · '+e.underpassName+' ('+e.statusLabel+')')+'</option>'}).join('')+'</select>':'<span class="sub">지금 점검 대상인 설비가 없어요</span>';
 openReg();});
load();

return {

};
}
