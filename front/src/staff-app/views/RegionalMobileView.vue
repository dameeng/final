<script setup lang="ts">
import PageBack from "../../shared/components/PageBack.vue"
import { formatDecimal } from '../../shared/utils/format-number'

import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { adminKey, clearManagerSession, refreshManagerProfile } from '../../shared/admin/main'
import { adminApi, type FacilityDetail } from '../../shared/admin/services/admin-api'
import { belongsToRegion } from '../../shared/admin/services/regional-access'
import type { Underpass } from '../../shared/admin/services/underpasses'
import PasswordInput from '../../shared/components/PasswordInput.vue'
import mascot from '../../shared/assets/images/routel-header-mascot.png'
import '../styles/regional-mobile.css'
import MobileRiskChart from '../components/MobileRiskChart.vue'
const {state,refresh,control}=inject(adminKey)!
const route=useRoute(),router=useRouter()
const tab=computed(()=>route.path.split('/')[2]||'overview')
const isDetail=computed(()=>tab.value==='facilities'&&!!route.params.id)
const isSuper=computed(()=>state.profile?.role==='SUPER_ADMIN')
const roleLabel=computed(()=>isSuper.value?'총관리자':'지역 관리자')
const regionLabel=computed(()=>isSuper.value?'전국 시설':state.profile?.regionName||'담당 지역 미지정')
const permitted=computed(()=>['REGIONAL_ADMIN','SUPER_ADMIN'].includes(state.profile?.role||''))
const facilities=computed(()=>permitted.value?state.underpasses.filter(f=>isSuper.value||belongsToRegion(f,state.profile)):[])
const selected=computed(()=>facilities.value.find(f=>f.id===String(route.params.id)))
const ready=computed(()=>state.loaded&&!state.error&&!state.loading&&(isSuper.value||state.profile?.regionId!=null))
const sortOrder=ref('priority')
const query=ref(''),filter=ref('ALL'),historyFilter=ref('ALL'),historyFacility=ref(''),limit=ref(20)
const risk=(f:Underpass)=>({SAFE:'정상',WARNING:'주의',DANGER:'위험',UNKNOWN:'정보 없음'}[f.observedRiskLevel||'UNKNOWN'])
const status=(f:Underpass)=>({OPEN:'통행 가능',BLOCKED:'통제 중',UNKNOWN:'정보 없음'}[f.controlState||'UNKNOWN'])
const time=(value?:string|null)=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'—'
const attention=computed(()=>facilities.value.filter(f=>f.controlState==='BLOCKED'||['WARNING','DANGER','UNKNOWN'].includes(f.observedRiskLevel||'UNKNOWN')||f.controlState==='UNKNOWN').sort((a,b)=>rank(b)-rank(a)))
function rank(f:Underpass){return (f.controlState==='BLOCKED'?10:0)+({DANGER:3,WARNING:2,UNKNOWN:1,SAFE:0}[f.observedRiskLevel||'UNKNOWN'])}
const filtered=computed(()=>facilities.value.filter(f=>f.name.includes(query.value.trim())&&(filter.value==='ALL'||filter.value==='BLOCKED'&&f.controlState==='BLOCKED'||filter.value==='RISK'&&['WARNING','DANGER'].includes(f.observedRiskLevel||'')||filter.value==='UNKNOWN'&&(f.controlState==='UNKNOWN'||f.observedRiskLevel==='UNKNOWN'))).sort((a,b)=>sortOrder.value==='name'?a.name.localeCompare(b.name,'ko'):rank(b)-rank(a)||(b.riskScore??-1)-(a.riskScore??-1)))
watch(()=>route.query.status,v=>{if(['ALL','BLOCKED','RISK','UNKNOWN'].includes(String(v)))filter.value=String(v)},{immediate:true})
const riskGroups = computed(() => [
 {key:'SAFE',label:'정상',count:facilities.value.filter(f=>f.observedRiskLevel==='SAFE').length},
 {key:'WARNING',label:'주의',count:facilities.value.filter(f=>f.observedRiskLevel==='WARNING').length},
 {key:'DANGER',label:'위험',count:facilities.value.filter(f=>f.observedRiskLevel==='DANGER').length},
 {key:'UNKNOWN',label:'정보 없음',count:facilities.value.filter(f=>!f.observedRiskLevel||f.observedRiskLevel==='UNKNOWN').length},
])
const blockedCount=computed(()=>facilities.value.filter(f=>f.controlState==='BLOCKED').length)
const blockedPercent=computed(()=>ready.value&&facilities.value.length?Math.round(blockedCount.value/facilities.value.length*100):null)
const canOperate=(f:Underpass)=>ready.value&&!busy.value&&!state.controlBusy&&['OPEN','BLOCKED'].includes(f.controlState||'')
const navItems=[{to:'/mobile',label:'종합 현황',icon:'M3 13h7V3H3z M14 21h7V11h-7z M3 21h7v-4H3z M14 7h7V3h-7z'},{to:'/mobile/facilities',label:'시설 목록',icon:'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5'},{to:'/mobile/history',label:'통제 이력',icon:'M3 12a9 9 0 1 0 3-6 M3 3v5h5 M12 7v5l3 2'},{to:'/mobile/profile',label:'내 정보',icon:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2'}]
const id=ref(''),password=ref(''),busy=ref(false),message=ref(''),actionError=ref(false)
const theme=ref(localStorage.getItem('routel-regional-theme')==='light'?'light':'dark')
watch(theme,v=>localStorage.setItem('routel-regional-theme',v))
const detail=ref<FacilityDetail|null>(null),detailError=ref(''),detailBusy=ref(false)
type History={kind?:string;eventType?:string;createdAt?:string;operatorId?:number;result?:string}
const history=ref<History[]>([]),historyBusy=ref(false),historyError=ref(''),historyAt=ref('')
const rows=computed(()=>history.value.filter(r=>['BLOCK','RELEASE'].includes(r.eventType||'')&&(historyFilter.value==='ALL'||r.eventType===historyFilter.value)).sort((a,b)=>Date.parse(b.createdAt||'')-Date.parse(a.createdAt||'')))
let request:AbortController|undefined,historyRequest:AbortController|undefined,disposed=false,listScroll=0
const historyId=computed(()=>isDetail.value?selected.value?.id:historyFacility.value)
async function loadHistory(){
 historyRequest?.abort();const current=new AbortController();historyRequest=current
 const target=historyId.value
 if(!target||!facilities.value.some(f=>f.id===target)){history.value=[];historyBusy.value=false;return}
 historyBusy.value=true;historyError.value=''
 try{const data=await adminApi<History[]>(`/underpasses/${encodeURIComponent(target)}/events`,{signal:current.signal});if(disposed||current.signal.aborted)return;if(!Array.isArray(data))throw new Error('이력 응답 형식을 확인해 주세요.');history.value=data.filter(r=>r.kind!=='DISPLAY');historyAt.value=new Date().toISOString()}
 catch(e){if(!current.signal.aborted){historyError.value=(e as Error).message}}
 finally{if(historyRequest===current)historyBusy.value=false}
}
async function loadDetail(){
 request?.abort();detail.value=null;detailError.value='';detailBusy.value=false
 if(!selected.value||!isDetail.value)return
 const current=new AbortController();request=current;const target=selected.value.id;detailBusy.value=true
 try{const data=await adminApi<FacilityDetail>(`/underpasses/${encodeURIComponent(target)}`,{signal:current.signal});if(!disposed&&!current.signal.aborted&&selected.value?.id===target)detail.value=data}
 catch(e){if(!current.signal.aborted)detailError.value=(e as Error).message}
 finally{if(request===current)detailBusy.value=false}
}
watch(()=>[route.path,state.profile?.regionId],async()=>{
 message.value='';history.value=[];historyAt.value='';limit.value=20
 if(!historyFacility.value||!facilities.value.some(f=>f.id===historyFacility.value))historyFacility.value=facilities.value[0]?.id||''
 void loadDetail();if(tab.value==='history'||isDetail.value)void loadHistory();else{historyRequest?.abort();historyBusy.value=false}
 await nextTick();window.scrollTo(0,tab.value==='facilities'&&!isDetail.value?listScroll:0)
},{immediate:true})
watch(historyFacility,()=>{history.value=[];historyAt.value='';limit.value=20;if(tab.value==='history')void loadHistory()})
onBeforeRouteUpdate(()=>{if(tab.value==='facilities'&&!isDetail.value)listScroll=window.scrollY})
async function login(){if(busy.value)return;busy.value=true;message.value='';try{
 const response=await fetch('/api/managers/login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({loginId:id.value.trim(),password:password.value})});const body=await response.json().catch(()=>null)
 if(!response.ok||body?.success!==true)throw new Error(body?.message||'로그인하지 못했습니다.')
 password.value='';if(!await refreshManagerProfile())throw new Error(state.authMessage||'관리자 정보를 확인하지 못했습니다.')
 await router.replace('/mobile')
 }catch(e){message.value=(e as Error).message}finally{busy.value=false}}
async function reload(){if(busy.value||state.loading)return; if(!await refreshManagerProfile()){await router.replace('/mobile/login');return}if(!permitted.value){await router.replace('/mobile/access');return}await refresh();if(isDetail.value)await loadDetail();if(tab.value==='history'||isDetail.value)await loadHistory()}
async function operate(facility:Underpass){
 if(busy.value||state.controlBusy||!canOperate(facility))return
 busy.value=true;message.value='';actionError.value=false;const targetId=facility.id, originalState=facility.controlState, originalPath=route.fullPath
 try{
 if(!navigator.onLine)throw new Error('인터넷 연결 후 다시 시도해 주세요.')
 if(!await refreshManagerProfile())throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.')
 await refresh();const target=facilities.value.find(f=>f.id===targetId)
 if(!ready.value||!target||!['OPEN','BLOCKED'].includes(target.controlState||''))throw new Error('현재 상태와 담당 권한을 확인한 후 다시 시도해 주세요.')
 if(route.fullPath!==originalPath)throw new Error('화면이 변경되어 요청을 취소했습니다.')
 if(target.controlState!==originalState)throw new Error('시설 상태가 변경되었습니다. 현재 상태를 확인하고 다시 시도해 주세요.')
 const next=target.controlState==='BLOCKED'?'정상':'통제',label=next==='정상'?'통제 해제':'통제'
 if(!window.confirm(`${target.name}\n현재: ${status(target)}\n작업: ${label}\n이 작업을 요청할까요?`))return
 await control(targetId,next);message.value=`${target.name} · ${label} 요청이 처리되었습니다. 아래 수신 상태를 확인해 주세요.`
 if(isDetail.value)await Promise.all([loadDetail(),loadHistory()])
 }catch(e){actionError.value=true;message.value=(e as Error).message}finally{busy.value=false}
}
async function logout(){if(busy.value)return;busy.value=true;message.value='';try{const response=await fetch('/api/auth/logout',{method:'POST',credentials:'include'});if(!response.ok&&response.status!==401)throw new Error('로그아웃하지 못했습니다. 다시 시도해 주세요.');clearManagerSession();query.value='';filter.value='ALL';await router.replace('/mobile/login')}catch(e){message.value=(e as Error).message}finally{busy.value=false}}
const pw=ref({currentPassword:'',newPassword:'',newPasswordConfirm:''})
watch(()=>state.profile?.loginId||state.profile?.id||state.profile?.name,()=>{pw.value={currentPassword:'',newPassword:'',newPasswordConfirm:''};password.value='';query.value='';filter.value='ALL';listScroll=0;history.value=[];historyFacility.value='';detail.value=null})
async function changePassword(){if(busy.value)return;if(pw.value.newPassword!==pw.value.newPasswordConfirm){message.value='새 비밀번호 확인이 일치하지 않습니다.';return}busy.value=true;message.value='';try{await adminApi('/managers/me/password',{method:'PUT',body:JSON.stringify(pw.value)});pw.value={currentPassword:'',newPassword:'',newPasswordConfirm:''};message.value='비밀번호를 변경했습니다.'}catch(e){message.value=(e as Error).message}finally{busy.value=false}}
function visibility(){if(document.visibilityState==='visible'&&permitted.value&&tab.value!=='login')void reload()}
onMounted(()=>document.addEventListener('visibilitychange',visibility))
onBeforeUnmount(()=>{disposed=true;request?.abort();historyRequest?.abort();document.removeEventListener('visibilitychange',visibility)})
</script>
<template>
 <div class="regional-mobile" :data-theme="theme">
  <header class="rm-header"><img :src="mascot" width="36" height="36" alt="ROUTEL"/><div><strong>ROUTEL 관리자 앱</strong><p>{{ state.profile?.name ? `${state.profile.name}님` : '관리자 로그인' }}<template v-if="permitted"> · {{ regionLabel }}</template></p></div><button class="rm-theme-toggle" :aria-label="theme==='light'?'다크 모드로 전환':'라이트 모드로 전환'" @click="theme=theme==='light'?'dark':'light'"><svg viewBox="0 0 24 24" aria-hidden="true"><path v-if="theme==='light'" d="M20 15a8 8 0 0 1-11-11 8.5 8.5 0 1 0 11 11Z"/><template v-else><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></template></svg></button></header>
  <main class="rm-main">
   <PageBack v-if="permitted && route.path !== '/mobile'" area="mobile" />
   <template v-if="tab==='login'"><h1>로그인</h1><p>담당 시설의 현황과 통제 상태를 확인하세요.</p><form class="rm-card rm-form" @submit.prevent="login"><label>아이디<input v-model="id" autocomplete="username" required :disabled="busy"/></label><label>비밀번호<PasswordInput v-model="password" autocomplete="current-password" required :disabled="busy"/></label><p v-if="message||state.authMessage" role="alert">{{ message||state.authMessage }}</p><button class="rm-primary" :disabled="busy">{{ busy?'로그인 중…':'로그인' }}</button></form></template>
   <template v-else-if="tab==='access'"><h1>관리자 앱 접근 안내</h1><p>현재 계정은 이 모바일 화면을 사용할 수 없습니다.</p><router-link to="/dashboard">권한에 맞는 관리자 웹으로 이동</router-link><button :disabled="busy" @click="logout">로그아웃</button><p role="alert">{{ message }}</p></template>
   <template v-else-if="permitted">
    <div class="rm-connection"><span>{{ state.loading?'확인 중':state.error?'데이터 연결 오류':state.lastUpdated?'데이터 연결됨':'확인 중' }}<small>마지막 수신 {{ time(state.lastUpdated) }}</small></span><button :disabled="state.loading||busy" @click="reload">새로고침</button></div>
    <p v-if="state.error" class="rm-alert" role="alert">{{ state.error }}<span v-if="state.lastUpdated"> · 이전 수신 자료입니다.</span></p>
    <p v-if="message" class="rm-feedback" :role="actionError?'alert':'status'">{{ message }}</p>
    <template v-if="tab==='overview'">
      <div class="rm-page-heading"><div><p class="rm-eyebrow">{{ regionLabel }} · 운영 현황</p><h1>종합 현황</h1></div><span class="rm-live-label">{{ roleLabel }}</span></div>
      <section class="rm-card rm-hero"><div class="rm-hero-orbit" aria-hidden="true"></div><span>OPERATIONS CENTER</span><h2>오늘의 시설 운영</h2><div class="rm-hero-total"><strong>{{ ready?facilities.length:'—' }}</strong><span>{{ isSuper?'전국':'담당 지역' }} 시설</span></div><p>상태 확인부터 통제까지, 빠르게.</p><router-link class="rm-hero-link" to="/mobile/facilities?status=ALL">시설 전체 확인 <span aria-hidden="true">→</span></router-link></section>
      <div class="rm-shortcuts" aria-label="시설 상태별 바로가기"><router-link v-for="item in [{key:'RISK',label:'주의·위험',count:riskGroups[1]!.count+riskGroups[2]!.count,icon:'M12 3 2 21h20L12 3Z M12 9v5 M12 17v1'},{key:'BLOCKED',label:'통제 중',count:blockedCount,icon:'M4 4h16v16H4z M8 12h8'},{key:'UNKNOWN',label:'상태 확인',count:facilities.filter(f=>f.controlState==='UNKNOWN'||f.observedRiskLevel==='UNKNOWN').length,icon:'M12 8v5 M12 16v1 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'}]" :key="item.key" :to="'/mobile/facilities?status='+item.key" :data-kind="item.key"><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="item.icon"/></svg><span>{{ item.label }}</span><strong>{{ ready?item.count:'—' }}<small>개</small></strong></router-link></div>
      <section class="rm-card rm-table-card"><div class="rm-section-heading"><h2>우선 확인 시설</h2><router-link to="/mobile/facilities">전체 보기</router-link></div><p class="rm-muted">통제 중인 시설과 위험 단계가 높은 시설부터 표시합니다.</p><div class="rm-table-scroll"><table class="rm-table"><thead><tr><th>시설 / 상태</th><th>위험 점수</th><th>빠른 제어</th></tr></thead><tbody><tr v-for="f in attention.slice(0,6)" :key="f.id"><td><router-link :to="`/mobile/facilities/${f.id}`">{{ f.name }}</router-link><span class="rm-state" :data-level="f.observedRiskLevel">{{ risk(f) }} · {{ status(f) }}</span></td><td><span class="rm-score" :data-level="f.observedRiskLevel">{{ formatDecimal(f.riskScore) }}</span></td><td><button class="rm-quick-control" :data-blocked="f.controlState==='BLOCKED'" :aria-label="f.name+' '+(f.controlState==='BLOCKED'?'통제 해제':'통제')" :disabled="!canOperate(f)" @click="operate(f)">{{ f.controlState==='BLOCKED'?'해제':'통제' }}</button></td></tr><tr v-if="!attention.length"><td colspan="3" class="rm-empty">{{ ready?'우선 확인할 시설이 없습니다.':'자료를 확인하고 있습니다.' }}</td></tr></tbody></table></div></section>
      <div class="rm-chart-grid">
        <section class="rm-card"><div class="rm-section-heading"><h2>위험 단계 분포</h2><span>현재 기준</span></div><div class="rm-bars" role="img" :aria-label="ready?riskGroups.map(g=>g.label+' '+g.count+'개').join(', '):'데이터 없음'"><div v-for="g in riskGroups" :key="g.key" class="rm-bar-row"><span>{{ g.label }}</span><div class="rm-bar-track"><i :data-level="g.key" :style="{width:ready&&facilities.length?g.count/facilities.length*100+'%':'0%'}"></i></div><b>{{ ready?g.count:'—' }}</b></div></div></section>
        <section class="rm-card rm-control-summary"><div class="rm-section-heading"><h2>시설 통제 비율</h2><span>전체 {{ ready?facilities.length:'—' }}개</span></div><div class="rm-donut-wrap"><svg class="rm-donut" viewBox="0 0 140 140" role="img" :aria-label="blockedPercent==null?'데이터 없음':`전체 시설 중 ${blockedPercent}% 통제 중`"><circle class="rm-donut-track" cx="70" cy="70" r="54"/><circle v-if="blockedPercent!=null" class="rm-donut-value" cx="70" cy="70" r="54" pathLength="100" :stroke-dasharray="`${blockedPercent} 100`"/><text x="70" y="69" text-anchor="middle">{{ blockedPercent==null?'—':blockedPercent+'%' }}</text><text class="rm-donut-caption" x="70" y="89" text-anchor="middle">통제 중</text></svg><p>통제 {{ ready?blockedCount:'—' }}개<span>전체 시설 대비</span></p></div></section>
      </div>

    </template>
    <template v-else-if="tab==='facilities'&&!isDetail"><div class="rm-page-heading"><div><p class="rm-eyebrow">{{ regionLabel }}</p><h1>시설 목록</h1></div><span class="rm-live-label">{{ ready?filtered.length:'—' }}개</span></div><label class="rm-search">시설명 검색<input v-model="query" type="search" placeholder="지하차도명 검색"/></label><div class="rm-list-tools"><button v-if="query" @click="query=''">검색 초기화</button><label>정렬<select v-model="sortOrder"><option value="priority">우선순위순</option><option value="name">시설명순</option></select></label></div><div class="rm-filters"><button v-for="v in [['ALL','전체'],['BLOCKED','통제 중'],['RISK','주의·위험'],['UNKNOWN','상태 확인']]" :key="v[0]" :aria-pressed="filter===v[0]" @click="filter=v[0]">{{ v[1] }}</button></div><section class="rm-card rm-table-card"><div class="rm-table-scroll"><table class="rm-table"><thead><tr><th>시설 / 상태</th><th>점수</th><th>빠른 제어</th></tr></thead><tbody><tr v-for="f in filtered" :key="f.id"><td><router-link :to="`/mobile/facilities/${f.id}`">{{ f.name }}</router-link><small>{{ f.region }}</small><span class="rm-state" :data-level="f.observedRiskLevel">{{ risk(f) }} · {{ status(f) }}</span></td><td><span class="rm-score" :data-level="f.observedRiskLevel">{{ formatDecimal(f.riskScore) }}</span></td><td><button class="rm-quick-control" :data-blocked="f.controlState==='BLOCKED'" :aria-label="f.name+' '+(f.controlState==='BLOCKED'?'통제 해제':'통제')" :disabled="!canOperate(f)" @click="operate(f)">{{ f.controlState==='BLOCKED'?'해제':'통제' }}</button></td></tr><tr v-if="!filtered.length"><td colspan="3" class="rm-empty">{{ state.loading?'조회 중…':state.error?'연결 상태를 확인해 주세요.':'해당 시설이 없습니다.' }}</td></tr></tbody></table></div></section></template>
    <template v-else-if="isDetail&&selected"><router-link to="/mobile/facilities">← 시설 목록</router-link><section class="rm-card"><h1>{{ selected.name }}</h1><p>{{ detail?.roadAddress || selected.region }}</p><p class="rm-badge">{{ risk(selected) }} · {{ status(selected) }}</p><button class="rm-primary rm-control" :disabled="!ready||busy||state.controlBusy||selected.controlState==='UNKNOWN'||!selected.controlState" @click="operate(selected)">{{ busy||state.controlBusy?'처리 중…':selected.controlState==='BLOCKED'?'통제 해제':'통제' }}</button><p v-if="selected.controlState==='UNKNOWN'">현재 통제 상태를 확인할 수 없어 제어할 수 없습니다.</p><p v-if="detailBusy">상세 조회 중…</p><p v-if="detailError" role="alert">{{ detailError }}</p><dl><dt>위험 점수</dt><dd>{{ selected.riskScore==null?'—':`${formatDecimal(selected.riskScore)}점` }}</dd><dt>관측 시각</dt><dd>{{ time(selected.observedUpdatedAt) }}</dd></dl></section><MobileRiskChart :id="selected.id" :updated="state.lastUpdated"/></template>
    <template v-if="tab==='history'||isDetail"><h1 v-if="!isDetail">통제 이력</h1><h2 v-else>최근 통제 이력</h2><label v-if="!isDetail">조회 시설<select v-model="historyFacility"><option value="" disabled>시설 선택</option><option v-for="f in facilities" :key="f.id" :value="f.id">{{ f.name }}</option></select></label><p class="rm-muted">마지막 갱신 {{ time(historyAt) }}</p><div class="rm-filters"><button v-for="v in [['ALL','전체'],['BLOCK','통제'],['RELEASE','해제']]" :key="v[0]" :aria-pressed="historyFilter===v[0]" @click="historyFilter=v[0];limit=20">{{ v[1] }}</button></div><p v-if="historyBusy">이력 조회 중…</p><p v-if="historyError" role="alert">{{ historyError }}{{ history.length?' · 이전 수신 기록입니다.':'' }} <button @click="loadHistory">재시도</button></p><section v-if="rows.length" class="rm-card rm-table-card"><div class="rm-table-scroll"><table class="rm-table"><thead><tr><th>시설 / 시각</th><th>작업</th><th>담당자</th></tr></thead><tbody><tr v-for="(r,i) in rows.slice(0,limit)" :key="`${r.createdAt}-${i}`"><td><router-link :to="`/mobile/facilities/${historyId}`">{{ facilities.find(f=>f.id===historyId)?.name }}</router-link><small>{{ time(r.createdAt) }}</small></td><td><span class="rm-state" :data-level="r.eventType==='BLOCK'?'DANGER':'SAFE'">{{ r.eventType==='BLOCK'?'통제':'해제' }}</span><small v-if="r.result">{{ r.result }}</small></td><td>{{ r.operatorId==null?'—':'#'+r.operatorId }}</td></tr></tbody></table></div></section><p v-if="!historyBusy&&!historyError&&!rows.length">{{ historyId?'통제·해제 기록이 없습니다.':'담당 시설을 선택해 주세요.' }}</p><button v-if="rows.length>limit" @click="limit+=20">더 보기</button></template>
    <template v-if="tab==='profile'"><h1>내 정보</h1><section class="rm-card"><dl><dt>이름</dt><dd>{{ state.profile?.name||'정보 없음' }}</dd><dt>담당 지역</dt><dd>{{ regionLabel }}</dd><dt>역할</dt><dd>{{ roleLabel }}</dd><template v-for="v in ['loginId','email','phone','department','position'] as const" :key="v"><dt v-if="state.profile?.[v]">{{ {loginId:'아이디',email:'이메일',phone:'연락처',department:'부서',position:'직위'}[v] }}</dt><dd v-if="state.profile?.[v]">{{ state.profile[v] }}</dd></template></dl></section><section class="rm-card"><h2>화면 설정</h2><label>화면 모드<select v-model="theme"><option value="light">라이트</option><option value="dark">다크</option></select></label></section><details class="rm-card"><summary>비밀번호 변경</summary><form class="rm-form" @submit.prevent="changePassword"><label>현재 비밀번호<PasswordInput v-model="pw.currentPassword" autocomplete="current-password" required/></label><label>새 비밀번호<PasswordInput v-model="pw.newPassword" autocomplete="new-password" minlength="8" maxlength="64" required/></label><label>새 비밀번호 확인<PasswordInput v-model="pw.newPasswordConfirm" autocomplete="new-password" minlength="8" maxlength="64" required/></label><button :disabled="busy">비밀번호 변경</button></form></details><button class="rm-logout" :disabled="busy" @click="logout">로그아웃</button></template>
   </template>
  </main>
  <nav v-if="permitted&&!['login','access'].includes(tab)" class="rm-bottom" aria-label="관리자 앱 메뉴"><router-link v-for="v in navItems" :key="v.to" :to="v.to" :aria-current="route.path===v.to||(v.to==='/mobile/facilities'&&isDetail)?'page':undefined"><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="v.icon"/></svg><span>{{ v.label }}</span></router-link></nav>
 </div>
</template>
