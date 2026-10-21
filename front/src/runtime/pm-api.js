// 예지보전 화면 공통: 스프링 /api/pm 호출과 표시용 변환
import {backend,downloadPdf} from '../services/backend'
import {workflows} from '../services/workflows'

export const TYPE_LABEL={PUMP:'배수펌프',CCTV:'CCTV',DISPLAY:'전광판'}
export const TYPE_CODE={'배수펌프':'PUMP','CCTV':'CCTV','전광판':'DISPLAY'}
export const LEVEL_CLASS={DANGER:'danger',CAUTION:'warn',SAFE:'safe'}
export const STATUS_CLASS={CHECK_NEEDED:'new',IN_PROGRESS:'work',RESOLVED:'done',ETC:'done'}

export const pmApi={
 equipments:(type)=>backend('/api/pm/equipments'+(type?'?type='+type:'')),
 top:(limit=5)=>backend('/api/pm/equipments/top?limit='+limit),
 detail:(equipId)=>backend('/api/pm/equipments/'+equipId),
 trend:(equipId,days=7)=>backend('/api/pm/equipments/'+equipId+'/trend?days='+days),
 events:(openOnly=false)=>backend('/api/pm/events?openOnly='+openOnly),
 changeStatus:(eventId,status)=>backend('/api/pm/events/'+eventId+'/status',{method:'PUT',body:{status}}),
 addAction:(eventId,content,status)=>backend('/api/pm/events/'+eventId+'/actions',{method:'POST',body:{content,status:status||null}}),
 actions:(equipId)=>backend('/api/pm/actions'+(equipId?'?equipId='+equipId:'')),
 // 팀 차단 API (경찰 이관 PDF 를 돌려줌)
 block:(underpassId,presetId,reason)=>backend('/api/control/underpasses/'+underpassId+'/block',{method:'POST',body:presetId?{presetId}:{reason},pdf:true}),
}

export function score(v){return v==null?'-':String(Math.round(Number(v)))}
export function change(v){if(v==null)return '–';var n=Math.round(Number(v));return n>0?'▲ '+n:n<0?'▼ '+(-n):'–'}
export function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

// "2026-10-21T14:00:00" → 오늘이면 "14:00", 어제면 "어제 14:00", 아니면 "10-19 14:00"
export function when(at){
 if(!at)return '-';var d=new Date(at);if(isNaN(d))return String(at)
 var hm=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')
 var today=new Date();today.setHours(0,0,0,0);var day=new Date(d);day.setHours(0,0,0,0)
 var diff=Math.round((today-day)/86400000)
 return diff===0?hm:diff===1?'어제 '+hm:String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+hm
}
export function fullDate(at){if(!at)return '-';var d=new Date(at);if(isNaN(d))return String(at);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}

export function badge(level,label){return '<span class="badge '+(LEVEL_CLASS[level]||'safe')+'">'+esc(label||'')+'</span>'}

// 점검 등록 창의 입력값을 조치 내용 한 줄로 합침 (서버는 내용만 저장)
export function actionContent(document){
 var type=document.getElementById('reg-type'),memo=document.getElementById('reg-memo'),res=document.getElementById('reg-res')
 var text=(memo&&memo.value||'').trim();if(!text)return ''
 return '['+(type?type.value:'점검')+'] '+text+(res?' ('+res.value+')':'')
}
// 점검 결과 → 상태: 정상 복구면 조치 완료, 아니면 점검 중 유지
export function actionStatus(document){var res=document.getElementById('reg-res');return res&&res.value==='정상 복구'?'RESOLVED':'IN_PROGRESS'}
export function resetReg(document,store){
 var who=document.querySelector('#reg .dlg-b .field:last-child .ro');if(who&&store&&store.account)who.textContent=(store.account.name||'')+' (로그인 계정 자동 기록)'
 var at=document.getElementById('reg-at');if(at){var d=new Date(),off=d.getTimezoneOffset()*60000;at.value=new Date(d-off).toISOString().slice(0,16);at.readOnly=true}
 var memo=document.getElementById('reg-memo');if(memo)memo.value=''
}
// 처리 필요 숫자(확인 필요 + 점검 중)를 탭·사이드바 배지에 반영
export function setOpenCount(root,n){
 root.querySelectorAll('.tabs a[href="/pm-queue"] .count, .side a[href="/pm-equipment"] .count, .side a[href="/pm-queue"] .count').forEach(function(el){el.textContent=String(n);el.hidden=!n})
}
export {downloadPdf}

// 팀 meeting.ts 가 설비·점검 대상 화면의 '조치 등록' 저장 버튼을 workflows.maintenance 로 보냄 → 여기서 스프링에 저장
workflows.maintenance=async function(input){
 var open=await pmApi.events(true)
 var ev=(open||[]).find(function(e){return e.code===input.equipmentId})
 if(!ev)throw new Error(input.equipmentId+' 은(는) 지금 점검 대상이 아니에요.')
 var memo=(input.memo||'').trim()
 await pmApi.addAction(ev.eventId,'['+(input.type||'점검')+'] '+memo+(input.result?' ('+input.result+')':''),input.result==='정상 복구'?'RESOLVED':'IN_PROGRESS')
}
