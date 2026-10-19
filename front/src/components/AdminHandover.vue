<script setup lang="ts">
import {nextTick,onMounted,onBeforeUnmount,ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useApp} from '../stores/app'
import {useAdminProfile} from '../stores/adminProfile'
const route=useRoute(),router=useRouter(),app=useApp(),admin=useAdminProfile(),dialog=ref<HTMLDialogElement>(),message=ref('')
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const hiddenKey=()=>`routel-handover-hide:${app.roleKey}`
const seenKey=()=>`routel-handover-seen:${app.roleKey}:${app.authVersion}`
function isHidden(){try{return localStorage.getItem(hiddenKey())===today()}catch{return false}}
function hasSeen(){try{return sessionStorage.getItem(seenKey())===today()}catch{return false}}
function markSeen(){try{sessionStorage.setItem(seenKey(),today())}catch{}}
async function open(manual=false){
 if(!manual&&(isHidden()||hasSeen()))return
 await nextTick();if(!dialog.value||dialog.value.open)return
 message.value='';dialog.value.showModal();markSeen()
}
function close(){dialog.value?.close()}
function hideToday(){try{localStorage.setItem(hiddenKey(),today());close()}catch{message.value='설정을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'}}
function navigate(path:string){close();void router.push(path)}
function manualOpen(){void open(true)}
const stop=watch(()=>[route.fullPath,app.roleKey,app.authVersion],()=>{
 close()
 if(route.path==='/admin-dashboard')void open()
},{flush:'post'})
onMounted(()=>{window.addEventListener('routel:open-handover',manualOpen);if(route.path==='/admin-dashboard')void open()})
onBeforeUnmount(()=>{stop();window.removeEventListener('routel:open-handover',manualOpen);close()})
</script>
<template><dialog ref="dialog" class="admin-handover" aria-labelledby="admin-handover-title"><header><div><p>{{admin.region}} · 근무 인수인계</p><h2 id="admin-handover-title">이전 근무 인수인계</h2></div><button type="button" class="handover-x" aria-label="인수인계 창 닫기" @click="close">×</button></header><div class="handover-body"><p>{{admin.profile.name}}님, 직전 근무조의 기록을 확인해 주세요.</p><section class="handover-summary"><h3>직전 근무조 · 박○○</h3><p>06:00~14:00</p><dl><div><dt>통제</dt><dd>1건</dd></div><div><dt>위험 상승</dt><dd>3건</dd></div><div><dt>점검</dt><dd>2건</dd></div><div><dt>미처리 점검</dt><dd>2건</dd></div></dl><small>구성 예시 · 실제 근무 기록 연동 전입니다.</small></section><div class="handover-links"><button type="button" @click="navigate('/shift-report')">데일리 리포트 · PDF 보기 →</button><button type="button" @click="navigate('/pm-queue?pending=1')">미처리 점검 대상 보기 →</button></div><p v-if="message" role="status">{{message}}</p></div><footer><button type="button" @click="hideToday">오늘 하루 안 보기</button><button type="button" class="handover-primary" @click="close">확인하고 닫기</button></footer></dialog></template>
<style scoped>
.admin-handover{position:fixed;inset:0;margin:auto;width:min(600px,calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:calc(100dvh - 32px);padding:0;border:1px solid var(--line,#c9ced6);border-radius:12px;background:var(--surface,#fff);color:var(--foreground,#20252b);box-shadow:0 18px 64px #142a4133;font-size:14px;line-height:1.6;overflow:auto}.admin-handover::backdrop{background:#16283e66}.admin-handover header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 24px;border-bottom:1px solid var(--line)}.admin-handover header p{font-size:12px;color:#65748a;margin:0 0 4px}.admin-handover h2{font-size:21px;line-height:30px;margin:0}.admin-handover button{font:inherit;font-size:14px;font-weight:500;line-height:22px;padding:10px 14px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:inherit;cursor:pointer}.admin-handover .handover-x{font-size:24px;line-height:24px;padding:6px;width:38px;height:38px;flex:none}.handover-body{padding:20px 24px}.handover-body>p{margin:0 0 16px}.handover-summary{padding:20px;border:1px solid var(--line);border-radius:8px}.handover-summary h3{font-size:15px;margin:0}.handover-summary p{margin:4px 0 16px;color:#65748a}.handover-summary dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 16px}.handover-summary dt{font-size:12px}.handover-summary dd{margin:4px 0 0;font-size:22px;line-height:28px;font-weight:700}.handover-summary small{font-size:11px;color:#65748a}.handover-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.admin-handover footer{display:flex;justify-content:flex-end;gap:8px;padding:16px 24px;border-top:1px solid var(--line)}.admin-handover .handover-primary{background:#173d62;color:#fff;border-color:#173d62}@media(max-width:480px){.admin-handover header,.handover-body,.admin-handover footer{padding:16px}.handover-summary{padding:14px}.handover-summary dl{grid-template-columns:repeat(2,minmax(0,1fr))}.handover-links{flex-direction:column}.admin-handover h2{font-size:19px}}
</style>
