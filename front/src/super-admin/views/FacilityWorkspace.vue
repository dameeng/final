<script setup lang="ts">
import { formatDecimal } from '../../shared/utils/format-number'

import {computed,inject,onBeforeUnmount,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {adminKey} from '../../shared/admin/main'
import {adminApi,type FacilityDetail} from '../../shared/admin/services/admin-api'
import FacilityManageView from '../../shared/admin/views/FacilityManageView.vue'
import OperationsView from '../../shared/admin/views/OperationsView.vue'
import ExtraView from '../../shared/admin/views/ExtraView.vue'
import UnifiedLogPanel from '../components/UnifiedLogPanel.vue'
import {dateLabel} from '../services/unified-logs'
const {state,control,refresh}=inject(adminKey)!
const route=useRoute()
const id=computed(()=>typeof route.params.id==='string'?route.params.id:'')
const facility=computed(()=>state.underpasses.find(f=>f.id===id.value))
const region=ref(''),query=ref('')
const regions=computed(()=>[...new Set(state.underpasses.map(f=>f.region))].sort())
const filteredList=computed(()=>state.underpasses.filter(f=>(!region.value||f.region===region.value)&&f.name.toLowerCase().includes(query.value.trim().toLowerCase())))
const sort=ref('priority')
const list=computed(()=>[...filteredList.value].sort((a,b)=>sort.value==='name'?a.name.localeCompare(b.name,'ko'):sort.value==='risk'?(b.riskScore??-1)-(a.riskScore??-1):(Number(b.controlState==='BLOCKED')-Number(a.controlState==='BLOCKED')||(b.riskScore??-1)-(a.riskScore??-1))))

const tab=computed(()=>['overview','operations','settings','logs'].includes(String(route.query.tab))?String(route.query.tab):'overview')
const detail=ref<FacilityDetail|null>(null),detailError=ref(''),loading=ref(false),feedback=ref(''),busy=ref(false),reload=ref(0)
let controller:AbortController|undefined,seq=0
const risk=(level?:string)=>({SAFE:'정상',WARNING:'주의',DANGER:'위험'}[level||'']||'—')
const controlLabel=(value?:string)=>value==='BLOCKED'?'통제 중':value==='OPEN'?'통행 가능':'확인 필요'
watch(id,async value=>{
 controller?.abort();const v=++seq;detail.value=null;detailError.value='';feedback.value='';loading.value=false
 if(!value)return
 state.selectedId=value;controller=new AbortController();loading.value=true
 try{const data=await adminApi<FacilityDetail>('/underpasses/'+encodeURIComponent(value),{signal:controller.signal});if(v===seq)detail.value=data}
 catch{if(v===seq)detailError.value='시설 상세 조회 실패'}
 finally{if(v===seq)loading.value=false}
},{immediate:true})
async function change(){
 const f=facility.value
 if(!f||busy.value||state.error||state.loading||!['OPEN','BLOCKED'].includes(f.controlState||''))return
 const action=f.controlState==='BLOCKED'?'통제 해제':'통제'
 if(!confirm(f.name+'\n현재: '+controlLabel(f.controlState)+'\n'+action+'하시겠습니까?'))return
 busy.value=true;feedback.value=''
 try{await control(f.id,action==='통제'?'통제':'정상');feedback.value=f.name+' '+action+' 요청이 처리되었습니다. 현재 상태를 확인해 주세요.';reload.value++}
 catch(e){feedback.value=e instanceof Error?e.message:'제어 요청 실패'}
 finally{busy.value=false}
}
onBeforeUnmount(()=>{seq++;controller?.abort()})
</script>
<template><div v-if="state.profile?.role==='SUPER_ADMIN'" class="super-workspace">
 <template v-if="!id">
  <div class="su-heading"><h1>지하차도 관리</h1><p>시설을 선택해 현황과 관제, 설정, 기록을 확인합니다.</p></div>
  <nav class="su-tabs"><router-link to="/super/facilities" :aria-current="!route.query.tab?'page':undefined">시설 목록</router-link><router-link to="/super/facilities?tab=manage" :aria-current="route.query.tab==='manage'?'page':undefined">시설 등록·수정</router-link><router-link to="/super/facilities?tab=thresholds" :aria-current="route.query.tab==='thresholds'?'page':undefined">임계치 설정</router-link></nav>
  <section v-if="route.query.tab==='manage'" class="su-card su-embedded"><FacilityManageView mode="facilities"/></section>
  <section v-else-if="route.query.tab==='thresholds'" class="su-card su-embedded"><ExtraView section="thresholds"/></section>
  <section v-else class="su-card">
   <div class="su-filters"><label>지역<select v-model="region"><option value="">전체 지역</option><option v-for="r in regions" :key="r">{{ r }}</option></select></label><label>정렬<select v-model="sort"><option value="priority">통제 우선</option><option value="risk">위험 점수 높은 순</option><option value="name">시설명 순</option></select></label><label class="su-search">시설명 검색<input v-model="query" placeholder="지하차도명 검색"></label><button :disabled="state.loading" @click="refresh">새로고침</button></div>
   <p class="su-muted">{{ state.loading?'조회 중':state.error?'이전 수신 자료 · 연결 확인 필요':list.length+'개 시설' }}</p>
   <div class="su-table-wrap"><table><thead><tr><th>시설명</th><th>지역</th><th>위험 단계</th><th>통제 여부</th><th>상세</th></tr></thead><tbody><tr v-for="f in list" :key="f.id"><td>{{ f.name }}</td><td>{{ f.region||'미배정' }}</td><td><span class="su-badge" :data-tone="f.observedRiskLevel">{{ risk(f.observedRiskLevel) }}</span></td><td><span class="su-badge" :data-tone="f.controlState">{{ controlLabel(f.controlState) }}</span></td><td><router-link class="su-button" :to="'/super/facilities/'+f.id">시설 상세</router-link></td></tr><tr v-if="!list.length"><td colspan="5" class="su-empty">{{ state.loading?'조회 중':state.error?'시설 조회 실패':'조건에 맞는 시설이 없습니다.' }}</td></tr></tbody></table></div>
  </section>
 </template>
 <template v-else-if="facility">
  <router-link to="/super/facilities">← 시설 목록</router-link>
  <div class="su-heading su-line"><div><h1>{{ facility.name }}</h1><p>{{ detail?.roadAddress||facility.region }} · 선택 시설 기준</p></div><router-link class="su-button" :to="{path:'/super/logs',query:{facility:id}}">이 시설 전체 로그 →</router-link></div>
  <nav class="su-tabs" aria-label="시설 상세 업무"><router-link v-for="t in [['overview','개요'],['operations','관제'],['settings','설정'],['logs','시설 로그']]" :key="t[0]" :to="{path:route.path,query:{tab:t[0]}}" :aria-current="tab===t[0]?'page':undefined">{{ t[1] }}</router-link></nav>
  <div v-if="tab==='overview'" class="su-two">
   <section class="su-card"><h2>현재 현황</h2><div class="su-status"><span class="su-badge" :data-tone="facility.observedRiskLevel">{{ risk(facility.observedRiskLevel) }}</span><span class="su-badge" :data-tone="facility.controlState">{{ controlLabel(facility.controlState) }}</span></div>
    <button class="su-primary" :disabled="busy||state.controlBusy||state.loading||!!state.error||!['OPEN','BLOCKED'].includes(facility.controlState||'')" @click="change">{{ busy?'처리 중…':facility.controlState==='BLOCKED'?'통제 해제':'통제' }}</button><p role="status">{{ feedback }}</p>
    <p v-if="loading">상세 조회 중</p><p v-if="detailError" class="su-error">{{ detailError }}</p>
    <dl><dt>위험 점수</dt><dd>{{ facility.riskScore==null?'—':formatDecimal(facility.riskScore)+'점' }}</dd><dt>관측 시각</dt><dd>{{ dateLabel(facility.observedUpdatedAt||'') }}</dd></dl>
    <p class="su-muted">위험 단계와 통제 여부는 별개입니다. 관측값이 없으면 정상으로 대체하지 않습니다.</p>
   </section>
   <UnifiedLogPanel :key="id+reload" :facility-id="id" compact/>
  </div>
  <section v-else-if="tab==='operations'" class="su-card su-embedded">
   <div class="su-tabs"><router-link to="/alert-evidence">번호판 판별 대기</router-link></div>
   <OperationsView :key="id" :locked-facility="id"/>
  </section>
  <section v-else-if="tab==='settings'" class="su-card su-embedded">
   <div class="su-tabs"><router-link :to="{path:route.path,query:{tab:'settings',panel:'facility'}}" :aria-current="route.query.panel!=='thresholds'?'page':undefined">시설 정보</router-link><router-link :to="{path:route.path,query:{tab:'settings',panel:'thresholds'}}" :aria-current="route.query.panel==='thresholds'?'page':undefined">임계치</router-link></div>
   <ExtraView v-if="route.query.panel==='thresholds'" :key="id" section="thresholds" :facility-id="id"/><FacilityManageView v-else :key="id" mode="facility" :initial-id="id"/>
  </section>
  <UnifiedLogPanel v-else :key="id" :facility-id="id"/>
 </template>
 <section v-else class="su-card"><h1>시설 확인</h1><p>{{ state.loading?'시설 조회 중':'시설을 찾을 수 없습니다. 목록을 확인해 주세요.' }}</p><router-link to="/super/facilities">시설 목록</router-link></section>
</div></template>
