import seeds from '../data/fac-detail.json'
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
var warningClose=$('warn-close');if(warningClose)warningClose.addEventListener('click',function(){$('warn').hidden=true;});
document.addEventListener('click',function(e){var c=e.target.closest('[data-close]');if(c){$(c.dataset.close).close();}});

var SIGN=store.pageData('fac-detail','SIGN',seeds.SIGN);var st={blocked:true,cars:3,manual:null,lv:'danger'};
function autoText(){return st.blocked?SIGN.block:SIGN[st.lv];}
function render(){
 $('h-ctl').textContent=st.blocked?'통제 중':'정상 운영';$('h-ctl').className='stat'+(st.blocked?' ack':'');
 $('o-ctl').textContent=st.blocked?'입구 차단 중':'정상 운영';
 $('b-block').disabled=st.blocked;$('b-release').disabled=!st.blocked;$('b-block').style.opacity=st.blocked?.45:1;$('b-release').style.opacity=st.blocked?1:.45;
 $('warn').hidden=!(st.blocked&&st.cars>0);
 var txt=st.manual||autoText();$('o-sign').textContent=txt;$('t-sign').textContent=txt;
 $('o-mode').textContent=st.manual?'수동 표출 중 · ○○○':'자동 표출 · 10:37 변경';$('h-manual').hidden=!st.manual;
 $('t-mode').textContent=st.manual?'수동 표출 중':'자동 표출';$('t-mode').className='stat'+(st.manual?' work':'');$('t-auto').hidden=!st.manual;
 $('t-sub').textContent=st.manual?'해제하기 전까지 자동 표출이 멈춰요.':'위험 단계와 통제 상태에 따라 자동으로 바뀌어요.';}
function tab(t){document.querySelectorAll('.sec').forEach(function(s){s.classList.toggle('on',s.id==='s-'+t)});document.querySelectorAll('#tabs a').forEach(function(a){if(a.dataset.t===t)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
function route(){var h=(location.hash||'#overview').slice(1);if(!document.getElementById('s-'+h))h='overview';tab(h);}
window.addEventListener('hashchange',route);route();render();
var act=null,cf=$('cf');
function ask(a,title,msg,sub){ctx.closeAll();act=a;$('cf-t').textContent=title;$('cf-m').textContent=msg;if(sub)$('cf-s').textContent=sub;var rs=(a==='block'||a==='release');$('cf-rw').hidden=!rs;$('cf-rel').hidden=a!=='release';$('cf-r').value='';$('cf-rt').value='';$('cf-ok').disabled=rs;$('cf-ok').style.opacity=rs?.45:1;cf.showModal();}
$('cf-r').addEventListener('change',function(){var ok=!!this.value;$('cf-ok').disabled=!ok;$('cf-ok').style.opacity=ok?1:.45;});
$('b-block').addEventListener('click',function(){ask('block','통제 확인','초량1지하차도를 통제할까요?','사유를 남기면 로그와 전달 문서에 함께 기록돼요.');});
$('b-release').addEventListener('click',function(){ask('release','통제 해제 확인','초량1지하차도 통제를 해제할까요?','사유를 남겨야 해제할 수 있어요. 해제 정보도 경찰·소방에 이관돼요.');});
$('m-pick').addEventListener('change',function(){if(this.value)$('m-text').value=this.value;});
$('m-go').addEventListener('click',function(){var v=$('m-text').value.trim();if(!v){toast('표출할 문구를 입력해 주세요');return;}window.__v=v;ask('manual','수동 표출 확인','다음 문구를 전광판에 표출할까요?  “'+v+'”');});
$('t-auto').addEventListener('click',function(){ask('auto','수동 표출 해제','수동 표출을 해제하고 자동 표출로 돌아갈까요?');});
$('cf-ok').addEventListener('click',function(){cf.close();
 if(act==='block'){st.blocked=true;toast('통제 처리했어요'+($('cf-pdf').checked?' · 전달 문서를 확인하세요':''));}
 if(act==='release'){st.blocked=false;toast('통제를 해제했어요'+($('cf-pdf').checked?' · 전달 문서를 확인하세요':''));}
 if(act==='manual'){st.manual=window.__v;$('shist').tBodies[0].insertAdjacentHTML('afterbegin','<tr><td>10:50</td><td>'+window.__v+'</td><td>수동</td><td>○○○</td></tr>');toast('전광판에 수동 표출했어요');}
 if(act==='auto'){st.manual=null;toast('자동 표출로 돌아갔어요');}
 render();});
$('tp-save').addEventListener('click',function(){toast('문구 템플릿을 저장했어요');});
$('a-save').addEventListener('click',function(){toast('시설 정보를 저장했어요');});$('t-save').addEventListener('click',function(){toast('임계치를 저장하고 변경 이력에 기록했어요');});$('c-save').addEventListener('click',function(){toast('차량 과다 기준을 저장했어요');});$('snap').addEventListener('click',function(){toast('스냅샷을 저장했어요');});
document.querySelectorAll('#cams .chip').forEach(function(c){c.addEventListener('click',function(){document.querySelectorAll('#cams .chip').forEach(function(x){x.setAttribute('aria-pressed',String(x===c))});});});
var dl=$('dl');$('del-open').addEventListener('click',function(){ctx.closeAll();$('dl-in').value='';$('dl-ok').disabled=true;$('dl-ok').style.opacity=.45;dl.showModal();});
$('dl-in').addEventListener('input',function(){var ok=this.value.trim()==='초량1지하차도';$('dl-ok').disabled=!ok;$('dl-ok').style.opacity=ok?1:.45;});
$('dl-ok').addEventListener('click',function(){dl.close();toast('삭제 처리했어요 (복원 가능)');});

return {

};
}
