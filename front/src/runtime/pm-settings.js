import seeds from '../data/pm-settings.json'
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

var SET=store.pageData('pm-settings','SET',seeds.SET);var SC=store.pageData('pm-settings','SC',seeds.SC);var base=JSON.parse(JSON.stringify(SET));var cur='배수펌프';
function render(){var rows='';SET[cur].forEach(function(m,i){rows+='<tr><td>'+m[0]+'</td><td><input type="number" class="th" data-i="'+i+'" value="'+m[2]+"\" data-layout=\"dyn-52dd40da\"> "+m[1]+'</td><td><input type="number" class="wt" data-i="'+i+'" value="'+m[3]+"\" data-layout=\"dyn-52dd40da\"> 점</td></tr>";});$('mrows').innerHTML=rows;sum();}
function sum(){var s=SET[cur].reduce(function(a,m){return a+m[3]},0);$('wsum').textContent=s;$('wmsg').textContent=s===100?'':'← 합계가 100이어야 저장할 수 있어요';$('s-save').disabled=(s!==100||!!$('b-err').textContent);$('s-save').style.opacity=$('s-save').disabled?.45:1;}
function prev(){var w=+$('b-warn').value,d=+$('b-dan').value;var err='';if(!(w>0&&d>w&&d<=100))err='위험 시작은 주의 시작보다 커야 해요.';$('b-err').textContent=err;var c={안전:0,주의:0,위험:0};SC.forEach(function(s){c[s>=d?'위험':s>=w?'주의':'안전']++;});
 $('prev').innerHTML=['위험','주의','안전'].map(function(k){return '<li><span>'+k+'</span><strong>'+c[k]+'개</strong></li>'}).join('');sum();}
$('mrows').addEventListener('input',function(e){var i=+e.target.dataset.i;if(e.target.classList.contains('th'))SET[cur][i][2]=+e.target.value;else{SET[cur][i][3]=+e.target.value;sum();}});
document.querySelectorAll('#ttabs .chip').forEach(function(c){c.addEventListener('click',function(){cur=c.dataset.t;document.querySelectorAll('#ttabs .chip').forEach(function(x){x.setAttribute('aria-pressed',String(x===c))});render();});});
$('b-warn').addEventListener('input',prev);$('b-dan').addEventListener('input',prev);
$('s-reset').addEventListener('click',function(){SET=JSON.parse(JSON.stringify(base));$('b-warn').value=40;$('b-dan').value=70;render();prev();toast('변경을 취소했어요');});
$('s-save').addEventListener('click',function(){ctx.closeAll();var m=[];SET[cur].forEach(function(x,i){var b=base[cur][i];if(x[2]!==b[2])m.push(x[0]+' 기준 '+b[2]+' → '+x[2]);if(x[3]!==b[3])m.push(x[0]+' 가중치 '+b[3]+' → '+x[3]);});if($('b-warn').value!=='40')m.push('주의 시작 40 → '+$('b-warn').value);if($('b-dan').value!=='70')m.push('위험 시작 70 → '+$('b-dan').value);
 $('cf-m').textContent=m.length?m.join(' / '):'변경된 내용이 없어요.';window.__chg=m;$('cf').showModal();});
$('cf-ok').addEventListener('click',function(){$('cf').close();(window.__chg||[]).forEach(function(t){$('hist').insertAdjacentHTML('afterbegin','<tr><td>2026-10-11 10:55</td><td>○○○</td><td>'+cur+'</td><td>'+t+'</td></tr>');});base=JSON.parse(JSON.stringify(SET));toast('기준을 저장했어요');});
render();prev();

return {

};
}
