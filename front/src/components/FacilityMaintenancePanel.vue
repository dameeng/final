<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { managerAppPath } from '../utils/manager-app-path'
const route = useRoute()
import { backend, asPage, queryString } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'
import { PM_TYPES, PM_EVENT_STATUS, isPmChange } from '../utils/pm-labels'
import RiskLevelBadge from './RiskLevelBadge.vue'

const props=defineProps<{underpassId:string}>()
type Equipment={equipId:number;name:string;type:string;score:number|null;level:string|null;roadStatus?:string|null;openEventStatus?:string|null}
const rows=ref<Equipment[]>([]), page=ref(1), pages=ref(1), total=ref(0), loading=ref(false), error=ref('')
let controller:AbortController|undefined, timer:ReturnType<typeof setTimeout>|undefined
async function load() {
  controller?.abort()
  if(!props.underpassId)return
  const current=new AbortController()
  controller=current
  loading.value=true;error.value=''
  try {
    const data=asPage<Equipment>(await backend('/api/pm/equipments'+queryString({underpassId:props.underpassId,page:page.value,size:5}),{signal:current.signal}))
    if(current.signal.aborted)return
    rows.value=data.items;total.value=data.totalItems;pages.value=Math.max(1,data.totalPages)
    if(page.value>pages.value)page.value=pages.value
  } catch(e) {if(!current.signal.aborted)error.value=(e as Error).message}
  finally {if(!current.signal.aborted)loading.value=false}
}
watch(()=>props.underpassId,()=>{page.value=1;rows.value=[];total.value=0;pages.value=1;void load()},{immediate:true})
watch(page,()=>void load())
useBackendEvents(({name,data})=>{
  if(name==='connected'||isPmChange(name,data,['pm-equipment','pm-event','pm-action','pm-threshold'])) {
    clearTimeout(timer);timer=setTimeout(()=>void load(),200)
  }
})
onBeforeUnmount(()=>{controller?.abort();clearTimeout(timer)})
</script>
<template>
  <section class="facility-maintenance" aria-labelledby="facility-maintenance-title" :aria-busy="loading">
    <header><h2 id="facility-maintenance-title">예지보전</h2><span>설비 {{total}}개</span></header>
    <p class="facility-maintenance-caption">이 시설의 설비 상태와 점검 현황</p>
    <div v-if="error" class="facility-maintenance-state" role="alert"><p>{{error}}</p><button type="button" @click="load">다시 불러오기</button></div>
    <p v-else-if="loading&&!rows.length" class="facility-maintenance-state" role="status">설비 정보를 불러오는 중입니다.</p>
    <ul v-else-if="rows.length">
      <li v-for="row in rows" :key="row.equipId">
        <RouterLink :to="{path:managerAppPath('/pm-equipment-detail',route.path),query:{id:row.equipId}}">
          <span class="facility-maintenance-copy"><strong>{{row.name}}</strong><small>{{PM_TYPES[row.type]||row.type}} · {{PM_EVENT_STATUS[row.openEventStatus||'']||'진행 중인 점검 없음'}}</small></span>
          <span class="facility-maintenance-status"><small v-if="row.type==='ROAD'">{{row.roadStatus||'미분석'}}</small><RiskLevelBadge v-else-if="row.level" :value="row.level" /><small v-else>수신 대기</small><b v-if="row.type!=='ROAD'">{{row.score==null?'—':Number(row.score).toFixed(1)}}</b></span>
          <span class="facility-maintenance-arrow" aria-hidden="true">›</span>
        </RouterLink>
      </li>
    </ul>
    <p v-else class="facility-maintenance-state">등록된 예지보전 설비가 없습니다.</p>
    <nav v-if="pages>1" aria-label="시설 예지보전 목록 페이지"><button type="button" :disabled="page<=1||loading" @click="page--">이전</button><span>{{page}} / {{pages}}</span><button type="button" :disabled="page>=pages||loading" @click="page++">다음</button></nav>
  </section>
</template>
<style scoped>
.facility-maintenance { min-width:0; }
.facility-maintenance header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.facility-maintenance header>span { font-size:12px; color:var(--r-muted); white-space:nowrap; }
.facility-maintenance-caption { margin:10px 0 14px; color:var(--r-muted); font-size:12px; line-height:1.6; }
.facility-maintenance ul { list-style:none; padding:0; margin:0; }
.facility-maintenance li+li { border-top:1px solid var(--r-line); }
.facility-maintenance li>a { display:flex; align-items:center; gap:10px; padding:12px 0; color:var(--r-ink); text-decoration:none; }
.facility-maintenance li>a:hover strong { color:var(--r-accent); }
.facility-maintenance-copy { flex:1; min-width:0; }
.facility-maintenance-copy strong { display:block; font-size:13px; line-height:1.5; overflow-wrap:anywhere; }
.facility-maintenance-copy small { display:block; margin-top:4px; color:var(--r-muted); font-size:11px; line-height:1.5; }
.facility-maintenance-status { display:flex; align-items:center; gap:8px; flex-shrink:0; font-variant-numeric:tabular-nums; }
.facility-maintenance-status>small { font-size:11px; color:var(--r-muted); }
.facility-maintenance-status>b { font-size:13px; }
.facility-maintenance-arrow { color:var(--r-muted); }
.facility-maintenance-state { padding:20px 0; font-size:13px; color:var(--r-muted); line-height:1.7; }
.facility-maintenance-state button,.facility-maintenance nav button { min-height:32px; padding:5px 10px; background:var(--r-surface); border:1px solid var(--r-line); border-radius:6px; color:var(--r-ink); }
.facility-maintenance nav { display:flex; align-items:center; justify-content:flex-end; gap:10px; margin-top:12px; font-size:12px; color:var(--r-muted); }
.facility-maintenance nav button:disabled { opacity:.45; }
</style>
