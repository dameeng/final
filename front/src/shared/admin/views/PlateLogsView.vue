<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { adminKey } from '../main'
import { adminApi } from '../services/admin-api'
import { plateImageUrl } from '../services/plate-image'
import { dateLabel } from '../services/unified-logs'
const {state}=inject(adminKey)!
type Row={id:number;underpassId:number;cameraId:number;detectedNum:string;confidence:number|null;imagePath:string|null;detectedAt:string;status?:string}
const facility=ref(''), page=ref(1), pages=ref(1), rows=ref<Row[]>([]), busy=ref(false), error=ref('')
const regional=computed(()=>state.profile?.role==='REGIONAL_ADMIN')
const logBase=computed(()=>regional.value?'/regional/logs':'/super/logs')
let controller:AbortController|undefined,version=0
async function load(){
 controller?.abort();const seq=++version;controller=new AbortController();rows.value=[];error.value='';busy.value=true
 if(regional.value&&!facility.value){busy.value=false;return}
 const query=new URLSearchParams({page:String(page.value),size:'10'})
 if(facility.value)query.set('underpassId',facility.value)
 try{
  const data=await adminApi<Row[]|{items:Row[];totalPages:number}>(`/plate-logs?${query}`,{signal:controller.signal})
  if(seq!==version)return
  const received=Array.isArray(data)?data:data?.items
  if(!Array.isArray(received))throw new Error('번호판 인식 로그 응답을 확인할 수 없습니다.')
  const scoped=received.filter(row=>(!facility.value||String(row.underpassId)===facility.value)&&(!regional.value||state.underpasses.some(f=>f.id===String(row.underpassId))))
  pages.value=Math.max(1,Array.isArray(data)?Math.ceil(scoped.length/10):Number(data.totalPages)||1)
  rows.value=Array.isArray(data)?scoped.slice((page.value-1)*10,page.value*10):scoped
 }catch(e){if(seq===version)error.value=e instanceof Error?e.message:'번호판 인식 로그 조회 실패'}finally{if(seq===version)busy.value=false}
}
watch(()=>state.underpasses.map(f=>f.id).join('|'),()=>{if(regional.value&&!state.underpasses.some(f=>f.id===facility.value))facility.value=state.underpasses[0]?.id||''},{immediate:true})
watch(facility,()=>{page.value=1;void load()},{immediate:true})
onBeforeUnmount(()=>{version++;controller?.abort()})
</script>
<template><div class="routel-admin-page"><h1>번호판 인식 로그</h1><nav class="qa-log-links" aria-label="인식·발송 기록"><router-link to="/plate-logs">번호판 인식 로그</router-link><router-link to="/alert-evidence">수동 판별</router-link><router-link :to="{path:logBase,query:{category:'ALERT'}}">알림 발송 로그</router-link></nav><form @submit.prevent="page=1;load()"><label>시설<select v-model="facility"><option v-if="!regional" value="">전체 시설</option><option v-for="f in state.underpasses" :key="f.id" :value="f.id">{{ f.name }}</option></select></label><button :disabled="busy">조회</button></form><p v-if="error" role="alert">{{ error }} · 번호판 인식 로그 API 연결을 확인해 주세요.</p><div class="routel-admin-table-scroll"><table class="routel-admin-table"><thead><tr><th>인식 시각</th><th>시설</th><th>카메라</th><th>번호판</th><th>확신도</th><th>사진</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td>{{ dateLabel(row.detectedAt) }}</td><td>{{ state.underpasses.find(f=>f.id===String(row.underpassId))?.name || row.underpassId }}</td><td>{{ row.cameraId }}</td><td>{{ row.detectedNum || '미인식' }}</td><td>{{ row.confidence ?? '—' }}</td><td><img v-if="row.imagePath" class="qa-plate-thumb" :src="plateImageUrl(row.imagePath)" :alt="`${row.detectedNum || '차량'} 인식 사진`" /><span v-else>사진 없음</span></td></tr><tr v-if="!rows.length"><td colspan="6">{{ busy?'조회 중…':error?'기록을 불러오지 못했습니다.':regional&&!facility?'담당 시설을 선택해 주세요.':'인식 기록이 없습니다.' }}</td></tr></tbody></table></div><nav class="admin-pagination" aria-label="인식 로그 페이지"><button :disabled="busy||page<=1" @click="page--;load()">이전</button><span>{{ page }} / {{ pages }}</span><button :disabled="busy||page>=pages" @click="page++;load()">다음</button></nav></div></template>
