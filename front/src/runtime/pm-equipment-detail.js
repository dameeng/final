import {pmApi,LEVEL_CLASS,score,change,when,fullDate,esc,actionContent,actionStatus,resetReg,setOpenCount,downloadPdf} from './pm-api.js'
import {watch} from 'vue'
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
if($('reg-ok'))$('reg-ok').addEventListener('click',function(){var content=actionContent(document);if(!content){toast('조치 내용을 적어 주세요.');return;}
 pmApi.addAction(equipment.openEventId,content,actionStatus(document)).then(function(){$('reg').close();toast('점검 내용을 등록했어요.');renderEquipment();}).catch(function(e){toast(e.message);});});

var LIST=[],equipment=null,detail=null,TREND={},alive=true;ctx.on(ctx.root,'page-dispose',function(){alive=false});
var summary=document.querySelector('[aria-label="설비 요약"]'),reasonsCard=document.querySelector('[aria-label="판단 근거"]'),historyCard=document.querySelector('[aria-label="점검 이력"]');
function num(v){var n=Number(v);return Number.isInteger(n)?String(n):String(Math.round(n*10)/10)}
function renderEquipment(){
 var id=ctx.router.currentRoute.value.query.equipment;
 return pmApi.equipments().then(function(list){if(!alive)return;LIST=list||[];setOpenCount(ctx.root,LIST.filter(function(e){return e.openEventId}).length);
  equipment=LIST.find(function(e){return e.code===id})||LIST[0];
  if(!equipment){summary.querySelector('h2').textContent='설비 점수가 아직 없어요';return;}
  return Promise.all([pmApi.detail(equipment.equipId),pmApi.trend(equipment.equipId,7),pmApi.actions(equipment.equipId)]).then(function(r){if(!alive)return;detail=r[0];show(r[1],r[2]);});
 }).catch(function(e){toast(e.message)});
}
function show(trend,actions){
 var e=detail.equipment||equipment;equipment=Object.assign({},equipment,e);
 var heading=summary.querySelector('h2');heading.textContent=e.code+' · '+e.underpassName;heading.previousElementSibling.textContent=e.typeLabel;
 var crumb=document.querySelector('.crumb strong');if(crumb)crumb.textContent=e.code;
 var badgeEl=summary.querySelector('.badge');badgeEl.className='badge '+(LEVEL_CLASS[e.level]||'safe');badgeEl.textContent=e.levelLabel||'-';
 var scoreEl=badgeEl.nextElementSibling;scoreEl.textContent=score(e.score);
 var first=(trend.scores||[])[0];scoreEl.nextElementSibling.nextElementSibling.textContent='· 7일 전 '+(first?score(first.value):'-')+' → 현재 '+score(e.score)+' ('+change(e.change)+' / 24시간)';
 var kv=summary.querySelectorAll('.kv2 > div');
 kv[0].querySelector('strong').textContent=when(detail.measuredAt||e.predictedAt);
 kv[1].querySelector('strong').textContent=actions&&actions.length?fullDate(actions[0].createdAt).slice(0,10):'기록 없음';
 kv[2].querySelector('small').textContent='사유';kv[2].querySelector('strong').textContent=e.level==='SAFE'?'특이 사유 없음':detail.reason||'특이 사유 없음';
 kv[3].querySelector('strong').textContent=e.openEventStatusLabel||'해당 없음';
 summary.querySelector('.row a').href='/fac-detail?facility='+encodeURIComponent(e.underpassName);
 $('d-reg').disabled=!e.openEventId;$('d-reg').title=e.openEventId?'':'점검 대상이 아니에요';
 var blk=$('d-block');if(blk){blk.hidden=!(e.level==='DANGER'&&(detail.blockPresetId||detail.blockReason));blk.title=detail.blockReason||'';}
 // 추이: 위험 점수 + 측정 항목별 값
 var th=(detail.thresholds||[]).filter(function(x){return x.level!=='SAFE'}).sort(function(a,b){return b.minScore-a.minScore}).map(function(x){return [Number(x.minScore),x.levelLabel+' 기준']});
 TREND={score:{u:'점',v:(trend.scores||[]).map(function(p){return Number(p.value)}),lines:th}};
 var chips='<button type="button" class="chip" data-m="score" aria-pressed="true">위험 점수</button>';
 (detail.reasons||[]).forEach(function(x){var pts=(trend.metrics||{})[x.metric];if(!pts||!pts.length)return;TREND[x.metric]={u:x.unit||'',v:pts.map(function(p){return Number(p.value)}),lines:[[Number(x.limit),'기준']]};chips+='<button type="button" class="chip" data-m="'+esc(x.metric)+'" aria-pressed="false">'+esc(x.label)+'</button>';});
 $('mtabs').innerHTML=chips;
 // 판단 근거
 reasonsCard.querySelector('thead tr').innerHTML='<th>항목</th><th>현재 값</th><th>기준</th><th>기여 점수</th><th>판정</th>';
 var rows=(detail.reasons||[]).map(function(x){var over=x.status==='기준 초과';return '<tr><td>'+esc(x.label)+'</td><td>'+num(x.value)+esc(x.unit||'')+'</td><td>'+num(x.limit)+esc(x.unit||'')+' 이상</td><td>+'+score(x.points)+'</td><td>'+(over?'<strong>'+esc(x.status)+'</strong>':esc(x.status))+'</td></tr>'}).join('');
 rows+='<tr class="inl-99dc03c66e"><td colspan="3"><strong>합계</strong></td><td><strong>'+score(e.score)+'</strong></td><td><strong>'+esc(e.levelLabel||'-')+'</strong></td></tr>';
 reasonsCard.querySelector('tbody').innerHTML=rows;
 reasonsCard.querySelector('.ro').innerHTML='<strong>권장 조치</strong> · '+esc(detail.advice||'이상 항목을 확인하고 점검해 주세요.');
 // 최근 점검 이력
 var ul=historyCard.querySelector('ul');var recent=(actions||[]).slice(0,3);
 ul.innerHTML=recent.length?recent.map(function(a){return '<li class="inl-06c8b5ed41"><span class="sub">'+fullDate(a.createdAt)+' · '+esc(a.managerLoginId||'')+'</span><span>'+esc(a.content)+'</span></li>'}).join(''):'<li class="inl-06c8b5ed41"><span class="sub">점검 기록이 없어요</span></li>';
 historyCard.querySelector('a[href="/pm-history"]').href='/pm-history?equipment='+encodeURIComponent(e.code);
 draw('score');
}
function draw(k){var d=TREND[k];if(!d||d.v.length<2){$('trend').innerHTML='<text x="50" y="120" font-size="14" fill="#5b6572">추이 데이터가 부족해요</text>';return;}
 var all=d.v.concat(d.lines.map(function(l){return l[0]}));var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all);var pad=(mx-mn)*.1||1;mn-=pad;mx+=pad;var last=d.v.length-1;
 function y(v){return 200-(v-mn)/(mx-mn)*170;}function x(i){return 90+i*(960/last);}
 var s='<line x1="50" y1="210" x2="1070" y2="210" stroke="#8a93a0"/>';
 d.lines.forEach(function(l,i){s+='<line x1="50" y1="'+y(l[0])+'" x2="1070" y2="'+y(l[0])+'" stroke="'+(i?'#8a93a0':'#1f2630')+'" stroke-width="1.5" stroke-dasharray="6 5"/><text x="56" y="'+(y(l[0])-6)+'" font-size="13" fill="#5b6572">'+esc(l[1])+' '+num(l[0])+esc(d.u)+'</text>';});
 s+='<polyline fill="none" stroke="#2b5c8a" stroke-width="3" points="'+d.v.map(function(v,i){return x(i)+','+y(v)}).join(' ')+'"/>';
 d.v.forEach(function(v,i){s+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="'+(i===last?6:3)+'" fill="#2b5c8a"/>';});
 s+='<text x="50" y="232" font-size="13" fill="#5b6572">7일 전</text><text x="1030" y="232" font-size="13" fill="#5b6572">지금</text><text x="'+(x(last)-20)+'" y="'+(y(d.v[last])-12)+'" font-size="14" font-weight="700">'+num(d.v[last])+esc(d.u)+'</text>';
 $('trend').innerHTML=s;}
renderEquipment();
const stopEquipment=watch(()=>ctx.router.currentRoute.value.query.equipment,renderEquipment);ctx.on(ctx.root,'page-dispose',stopEquipment);
document.querySelectorAll('.page-head button').forEach((button,index)=>{button.addEventListener('click',()=>{if(!LIST.length||!equipment)return;const at=LIST.findIndex(e=>e.equipId===equipment.equipId),next=(at+(index===0?-1:1)+LIST.length)%LIST.length;ctx.route('/pm-equipment-detail?equipment='+LIST[next].code)})});
$('mtabs').addEventListener('click',function(ev){var c=ev.target.closest('.chip');if(!c)return;document.querySelectorAll('#mtabs .chip').forEach(function(x){x.setAttribute('aria-pressed',String(x===c))});draw(c.dataset.m);});
$('d-reg').addEventListener('click',function(){if(equipment&&equipment.openEventId)openReg(equipment.code+' · '+equipment.typeLabel+' · '+equipment.underpassName);});
if($('d-block'))$('d-block').addEventListener('click',function(){if(!equipment||!detail)return;
 if(!confirm(equipment.underpassName+'을(를) 차단할까요?\n사유: '+(detail.blockReason||'')+'\n(차단하면 경찰 이관 PDF가 내려받아져요)'))return;
 var b=$('d-block');b.disabled=true;
 pmApi.block(equipment.underpassId,detail.blockPresetId,detail.blockReason).then(function(pdf){downloadPdf(pdf,'차단_'+equipment.underpassName+'.pdf');toast(equipment.underpassName+'을(를) 차단했어요.');}).catch(function(e){toast(e.message);}).finally(function(){b.disabled=false;});
});

return {

};
}
