import seeds from '../data/admin-dashboard.json'
export function initialize(ctx){
const {document,window,setTimeout,store}=ctx;

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

(function(){
var FAC=store.pageData('admin-dashboard','FAC',seeds.FAC);
var grid=document.getElementById('grid'),bar=document.getElementById('editbar'),eb=document.getElementById('edit-on');
var cur=0;
function $(id){return document.getElementById(id);}
function toast(t){var el=$('toast');el.textContent=t;el.hidden=false;setTimeout(function(){el.hidden=true},2200);}
function show(i){
  cur=i;store.selectedFacility=i;var f=FAC[i];
  $('s-name').textContent=f.name;$('s-addr').textContent=f.addr;
  var b=$('s-badge');b.textContent=f.lvt;b.className='badge '+f.lv;
  $('s-ctl').textContent=f.ctl==='BLOCKED'?'통제 중':'정상 운영';
  $('s-score').textContent=f.score+'점';$('g-fill').style.width=f.score+'%';
  $('s-rain').textContent=f.rain+' mm';$('s-obs').textContent=f.obs;$('s-wx').textContent=f.wx;$('s-eq').textContent=f.eq;
  $('b-block').disabled=f.ctl!=='OPEN';$('b-release').disabled=f.ctl!=='BLOCKED';
  $('b-block').style.opacity=$('b-block').disabled?.45:1;$('b-release').style.opacity=$('b-release').disabled?.45:1;
  var r=$('ring');r.setAttribute('cx',f.x);r.setAttribute('cy',f.y);
  [].forEach.call(document.querySelectorAll('#fl button'),function(b){b.setAttribute('aria-pressed',String(+b.dataset.f===i));});
}
show(Math.min(store.selectedFacility,FAC.length-1));
document.querySelectorAll('.mk').forEach(function(m){m.addEventListener('click',function(){show(+m.dataset.f)});m.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();show(+m.dataset.f);}});});
$('fl').addEventListener('click',function(e){var b=e.target.closest('button');if(b)show(+b.dataset.f);});
$('fq').addEventListener('input',function(){var q=this.value.trim();[].forEach.call($('fl').children,function(li){li.hidden=q&&li.textContent.indexOf(q)<0;});});
$('flist-toggle').addEventListener('click',function(){var bd=$('flist-body');var o=bd.hidden;bd.hidden=!o;this.textContent=o?'접기':'펼치기';this.setAttribute('aria-expanded',String(o));});
var act=null,cd=$('confirm'),od=$('obs');
function ask(kind){
  ctx.closeAll();act=kind;var f=FAC[cur];
  $('c-title').textContent=kind==='block'?'통제 확인':'통제 해제 확인';
  $('c-msg').textContent=f.name+'을(를) '+(kind==='block'?'통제':'통제 해제')+'할까요?';
  cd.showModal();
}
$('b-block').addEventListener('click',function(){ask('block')});
$('b-release').addEventListener('click',function(){ask('release')});
$('c-cancel').addEventListener('click',function(){cd.close()});
$('c-ok').addEventListener('click',function(){var f=FAC[cur];f.ctl=act==='block'?'BLOCKED':'OPEN';cd.close();show(cur);
  var li=document.querySelector('#fl button[data-f="'+cur+'"] small');if(li)li.textContent=f.lvt+' · '+(f.ctl==='BLOCKED'?'통제 중':'정상 운영');
  toast(f.name+' '+(act==='block'?'통제':'통제 해제')+' 처리했어요');});
$('obs-open').addEventListener('click',function(){ctx.closeAll();$('o-name').textContent=FAC[cur].name;od.showModal();});
$('o-close').addEventListener('click',function(){od.close()});


})();

return {};
}