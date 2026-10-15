<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { adminApi, facilityDetailApi, type Region } from '../../shared/admin/services/admin-api'
import type { Underpass } from '../../shared/admin/services/underpasses'
import { unassigned, timeLabel, type Manager, type Pending } from '../services/super-dashboard'
const props=defineProps<{facilities:Underpass[];managers:Manager[];pending:Pending[];regions:Region[];errors:Record<string,string>;ready:Record<string,boolean>;complete:Record<string,boolean>;facilityError:string;loading:boolean}>()
const emit=defineEmits<{changed:[]}>()
const pendingPage=ref(1),choices=ref<Record<number,string>>({}),destination=ref(''),checked=ref<string[]>([])
const busy=ref(false),message=ref(''),failed=ref(false)
let disposed=false
onBeforeUnmount(()=>{disposed=true})
const unassignedRows=computed(()=>[
 ...props.facilities.filter(unassigned).map(i=>({key:`f:${i.id}`,id:i.id,name:i.name,kind:'시설'})),
 ...props.managers.filter(i=>i.role==='REGIONAL_ADMIN'&&i.status==='ACTIVE'&&unassigned(i)).map(i=>({key:`m:${i.id}`,id:String(i.id),name:i.name,kind:'담당자'}))
])
const destinations=computed(()=>props.regions.filter(r=>r.name.trim()!=='미배정'))
const pendingPages=computed(()=>Math.max(1,Math.ceil(props.pending.length/5)))
const pageRows=computed(()=>props.pending.slice((Math.min(pendingPage.value,pendingPages.value)-1)*5,Math.min(pendingPage.value,pendingPages.value)*5))
async function decide(row:Pending,action:'approve'|'reject'){
 if(busy.value || props.errors.pending || !props.ready.pending)return
 const region=destinations.value.find(r=>String(r.id)===choices.value[row.id])
 if(action==='approve'&&!region){message.value='담당 지역을 선택해 주세요.';failed.value=true;return}
 if(!confirm(`${row.name} (${row.loginId})\n${action==='approve'?`${region!.name} 지역 담당자로 승인`:'가입 신청 반려'}하시겠습니까?`))return
 busy.value=true;message.value='';failed.value=false
 try{await adminApi(`/managers/${row.id}/${action}`,{method:'POST',...(action==='approve'?{body:JSON.stringify({regionId:region!.id})}:{})});if(!disposed){message.value=`${row.name}: ${action==='approve'?'승인':'반려'} 처리 완료`;emit('changed')}}catch(e){if(!disposed){failed.value=true;message.value=e instanceof Error?e.message:'처리 실패'}}finally{if(!disposed)busy.value=false}
}
async function assign(){
 const region=destinations.value.find(r=>String(r.id)===destination.value)
 const targets=unassignedRows.value.filter(r=>checked.value.includes(r.key))
 if(busy.value||props.loading||!region||!targets.length||props.facilityError||props.errors.managers||props.errors.regions)return
 if(!confirm(`${targets.map(r=>`${r.kind} ${r.name}`).join('\n')}\n→ ${region.name}에 배정하시겠습니까?`))return
 busy.value=true;message.value='';failed.value=false
 const successes:string[]=[],failures:string[]=[]
 for(const target of targets){
  if(disposed)break
  try{
   if(target.kind==='담당자')await adminApi(`/managers/${target.id}/region`,{method:'PUT',body:JSON.stringify({regionId:region.id})})
   else {const d=await facilityDetailApi(target.id);await adminApi(`/underpasses/${target.id}`,{method:'PUT',body:JSON.stringify({name:d.name,regionId:region.id,roadAddress:d.roadAddress,latitude:d.latitude,longitude:d.longitude,heightM:d.heightM,lengthM:d.lengthM,floodHistoryCount:d.floodHistoryCount})})}
   successes.push(target.key)
  }catch(e){failures.push(`${target.name}: ${e instanceof Error?e.message:'배정 실패'}`)}
 }
 if(disposed)return
 checked.value=checked.value.filter(k=>!successes.includes(k));busy.value=false;failed.value=failures.length>0
 message.value=`${successes.length}건 배정 완료${failures.length?` / ${failures.join(' · ')}`:''}`;emit('changed')
}
</script>
<template>
 <div class="super-management-status" v-if="message" :role="failed?'alert':'status'">{{ message }}</div>
 <section class="super-panel super-unassigned"><div class="super-panel-head"><h2>미배정 재배정</h2><router-link to="/facility-manage">지역 관리</router-link></div><p class="super-note">전국 현재 기준 · 선택 항목만 배정</p>
 <p v-if="facilityError||errors.managers||errors.regions" class="super-error" role="alert">{{ facilityError||errors.managers||errors.regions }} · 이전 목록에서는 배정할 수 없습니다.</p><p v-if="!complete.managers && ready.managers" class="super-note">관리자 목록 일부 조회 · 조회된 항목만 표시</p>
 <div class="super-scroll super-assign-list"><label v-for="row in unassignedRows" :key="row.key"><input v-model="checked" type="checkbox" :value="row.key" :disabled="busy||loading"/><span>{{ row.name }}<small>{{ row.kind }}</small></span></label><p v-if="!unassignedRows.length" class="super-empty">{{ loading||!ready.managers?'조회 중':facilityError||errors.managers?'조회 실패':complete.managers?'미배정 항목 없음':'조회된 미배정 항목 없음' }}</p></div>
 <div class="super-action-row"><select v-model="destination" aria-label="배정할 지역" :disabled="busy"><option value="">지역 선택</option><option v-for="r in destinations" :key="r.id" :value="String(r.id)">{{ r.name }}</option></select><button :disabled="busy||loading||!checked.length||!destination||!!facilityError||!!errors.managers||!!errors.regions" @click="assign">{{ busy?'처리 중…':'선택 항목 배정' }}</button></div></section>
 <section class="super-panel super-approvals"><div class="super-panel-head"><h2>가입 승인</h2><router-link to="/manager-approvals">전체 승인 화면</router-link></div><p class="super-note">전국 현재 기준 · 기간·지역 필터 제외</p><p v-if="errors.pending" class="super-error" role="alert">{{ errors.pending }}</p><p v-if="!complete.pending&&ready.pending" class="super-note">일부 조회 · 전체 건수 확인 필요</p>
 <div class="super-scroll super-pending-list"><article v-for="p in pageRows" :key="p.id"><strong>{{ p.name }}</strong><span>{{ p.loginId }} · {{ timeLabel(p.createdAt) }}</span><div class="super-action-row"><select v-model="choices[p.id]" :disabled="busy" :aria-label="`${p.name} 승인 지역`"><option :value="undefined">담당 지역 선택</option><option v-for="r in destinations" :key="r.id" :value="String(r.id)">{{ r.name }}</option></select><button :disabled="busy||loading||!!errors.pending||!!errors.regions||!choices[p.id]" @click="decide(p,'approve')">승인</button><button :disabled="busy||loading||!!errors.pending" @click="decide(p,'reject')">반려</button></div></article><p v-if="!pending.length" class="super-empty">{{ loading||!ready.pending?'조회 중':errors.pending?'조회 실패':'승인 대기 없음' }}</p></div><div v-if="pendingPages>1" class="super-action-row"><button :disabled="pendingPage<=1" @click="pendingPage--">이전</button><span>{{ Math.min(pendingPage,pendingPages) }} / {{ pendingPages }}</span><button :disabled="pendingPage>=pendingPages" @click="pendingPage++">다음</button></div></section>

</template>
