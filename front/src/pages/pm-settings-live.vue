<script setup lang="ts">
import ListResultCount from '../components/ListResultCount.vue'
import ResourceOverview from '../components/ResourceOverview.vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BackendLayout from '../components/BackendLayout.vue'
import AppPagination from '../components/AppPagination.vue'
import PmSettingsTable from '../components/PmSettingsTable.vue'
import { asPage, backend, queryString } from '../services/backend'
import { PM_TYPES } from '../utils/pm-labels'
import { displayDate } from '../utils/display-date'
import { managerAppPath } from '../utils/manager-app-path'
import { useBackendEvents } from '../composables/useBackendEvents'
import { useApp } from '../stores/app'
import { ownsFacility } from '../services/facilityAccess'
const app = useApp()
const route = useRoute()
const appView = computed(() => route.path.startsWith('/admin-app/'))
const rows = ref<Record<string,any>[]>([]), facilities = ref<Record<string,any>[]>([]), cameras = ref<Record<string,any>[]>([]), vms = ref<Record<string,any>[]>([])
const totalItems = ref(0)
const page = ref(1), pages = ref(1), selected = ref<number[]>([]), type = ref(''), underpassId = ref(String(route.query.underpassId||''))
const loading = ref(false), saving = ref(false), error = ref(''), message = ref(''), showCreate = ref(false)
const caution = ref(40), danger = ref(70), deleting = ref<Record<string,any>|null>(null), confirm = ref<HTMLDialogElement>()
const create = reactive({underpassId:'',type:'PUMP',installedAt:'',camId:'',itsVmsId:''})
let controller: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined
const lookup = new AbortController()
async function load() {
  controller?.abort(); const current = new AbortController(); controller = current
  loading.value = true; error.value = ''; selected.value = []
  try {
    const result = asPage<Record<string,any>>(await backend('/api/pm/thresholds'+queryString({page:page.value,size:appView.value?5:10,type:type.value,underpassId:underpassId.value}),{signal:current.signal}))
    if (!current.signal.aborted) { rows.value=result.items; totalItems.value=result.totalItems; pages.value=Math.max(1,result.totalPages); const target=rows.value.find(row=>String(row.equipId)===String(route.query.equipId)); if(target){selected.value=[target.equipId];caution.value=target.cautionMin;danger.value=target.dangerMin} if (page.value>pages.value) {page.value=pages.value;void load()} }
  } catch (e) { if (!current.signal.aborted) error.value=(e as Error).message }
  finally { if (!current.signal.aborted) loading.value=false }
}
async function initialize() {
  try {
    const all: Record<string,any>[] = []
    for (let page=1;;page++) {
      const result=asPage<Record<string,any>>(await backend('/api/underpasses'+queryString({page,size:100,scope:app.account?.role==='REGIONAL_ADMIN'?'MINE':undefined}),{signal:lookup.signal}))
      all.push(...result.items); if (page>=result.totalPages||!result.items.length) break
    }
    if (!lookup.signal.aborted) facilities.value=app.account?.role==='REGIONAL_ADMIN'?all.filter(ownsFacility):all
  } catch(e) { if(!lookup.signal.aborted) error.value=(e as Error).message }
}
let optionRequest: AbortController|undefined
watch(()=>[create.underpassId,create.type],async()=>{
  optionRequest?.abort(); const current=new AbortController();optionRequest=current
  create.camId='';create.itsVmsId='';cameras.value=[];vms.value=[]
  if(!create.underpassId||!['CCTV','DISPLAY'].includes(create.type))return
  try {
    const result=asPage<Record<string,any>>(await backend(create.type==='CCTV'?`/api/underpasses/${create.underpassId}/cameras`:'/api/its-vms?size=500',{signal:current.signal}))
    if(!current.signal.aborted) {if(create.type==='CCTV')cameras.value=result.items;else vms.value=result.items}
  }catch(e){if(!current.signal.aborted)error.value=(e as Error).message}
})
async function saveThresholds() {
  if(saving.value||!selected.value.length)return
  if(!(caution.value>0&&caution.value<danger.value&&danger.value<=100)){error.value='0 < 주의 < 위험 ≤ 100이 되도록 입력해 주세요.';return}
  saving.value=true;error.value='';message.value=''
  try {await backend('/api/pm/thresholds',{method:'PUT',body:{equipIds:selected.value,cautionMin:caution.value,dangerMin:danger.value}});await load();message.value='선택한 설비의 기준을 저장했습니다.'}
  catch(e){error.value=(e as Error).message}finally{saving.value=false}
}
async function register() {
  if(saving.value)return
  saving.value=true;error.value='';message.value=''
  try {
    await backend('/api/pm/equipments',{method:'POST',body:{underpassId:Number(create.underpassId),type:create.type,installedAt:create.installedAt||undefined,camId:create.type==='CCTV'&&create.camId?Number(create.camId):undefined,itsVmsId:create.type==='DISPLAY'&&create.itsVmsId?Number(create.itsVmsId):undefined}})
    showCreate.value=false;await load();message.value='설비를 등록했습니다. 설비 이름은 자동 부여됩니다.'
  }catch(e){error.value=(e as Error).message}finally{saving.value=false}
}
function askDelete(row:Record<string,any>){deleting.value=row;confirm.value?.showModal()}
async function remove() {
  if(!deleting.value||saving.value)return
  saving.value=true;error.value=''
  try{await backend('/api/pm/equipments/'+deleting.value.equipId,{method:'DELETE'});confirm.value?.close();deleting.value=null;await load();message.value='설비를 삭제했습니다. 기존 점수와 점검 기록은 보존됩니다.'}
  catch(e){error.value=(e as Error).message}finally{saving.value=false}
}
useBackendEvents(({name,data})=>{if(name==='data-changed'&&['pm-equipment','pm-threshold'].includes(data.resource)&&!saving.value){clearTimeout(timer);timer=setTimeout(()=>void load(),250)}})
watch([type,underpassId],()=>{page.value=1;void load()})
void initialize();void load()
onBeforeUnmount(()=>{controller?.abort();lookup.abort();optionRequest?.abort();clearTimeout(timer);confirm.value?.close()})
</script>
<template>
  <BackendLayout><main class="service-workspace pm-admin-tools pm-settings-live"><div class="service-heading"><h1><AdminPageIcon />예지보전 설비·기준 설정</h1><div class="service-actions"><button type="button" :disabled="saving" @click="showCreate=!showCreate">설비 등록</button></div></div>
    <p v-if="error" role="alert">{{error}}</p><p v-if="message" role="status">{{message}}</p>
    <form v-if="showCreate" class="pm-settings-card" @submit.prevent="register"><h2>설비 등록</h2><label>지하차도<select aria-label="등록 지하차도" v-model="create.underpassId" required :disabled="saving"><option value="">선택</option><option v-for="facility in facilities" :key="facility.id" :value="String(facility.id)">{{facility.name}}</option></select></label><label>설비 종류<select aria-label="등록 설비 종류" v-model="create.type" :disabled="saving"><option v-for="key in ['CCTV','DISPLAY','PUMP','WATER_LEVEL']" :key="key" :value="key">{{PM_TYPES[key]}}</option></select></label>
    <label v-if="create.type==='CCTV'">연결 카메라<select v-model="create.camId" :disabled="saving"><option value="">연결하지 않음</option><option v-for="cam in cameras" :key="cam.id" :value="String(cam.id)">{{cam.name||cam.direction||'카메라 '+cam.id}}</option></select></label><label v-if="create.type==='DISPLAY'">연결 전광판<select v-model="create.itsVmsId" :disabled="saving"><option value="">연결하지 않음</option><option v-for="item in vms" :key="item.id" :value="String(item.id)">{{item.name||item.id}}</option></select></label><label>설치일<input v-model="create.installedAt" type="date" :disabled="saving" /></label><button :disabled="saving">등록</button></form>
    <form class="service-filters" @submit.prevent="load"><label>지하차도<select v-model="underpassId"><option value="">전체</option><option v-for="facility in facilities" :key="facility.id" :value="String(facility.id)">{{facility.name}}</option></select></label><label>종류<select v-model="type"><option value="">전체</option><option v-for="key in ['CCTV','DISPLAY','PUMP','WATER_LEVEL']" :key="key" :value="key">{{PM_TYPES[key]}}</option></select></label></form>
    <form class="pm-settings-card threshold-form" @submit.prevent="saveThresholds"><h2>선택 설비 기준 변경 · {{selected.length}}개</h2><label>주의 시작 점수<input v-model.number="caution" type="number" min="0.01" max="99.99" step="0.01" required :disabled="saving" /></label><label>위험 시작 점수<input v-model.number="danger" type="number" min="0.02" max="100" step="0.01" required :disabled="saving" /></label><button :disabled="saving||loading||!selected.length">기준 저장</button></form>
    <p v-if="loading" role="status">설비 기준을 불러오는 중입니다.</p><ResourceOverview v-if="!loading && !appView" resource="pm-settings" :items="rows" :total="totalItems" /><ListResultCount v-if="!loading" :count="totalItems" /><PmSettingsTable v-if="!loading&&!appView" v-model="selected" :rows="rows" :saving="saving" @remove="askDelete" /><ul v-if="!loading&&appView" class="pm-settings-list"><li v-for="row in rows" :key="row.equipId"><label class="equipment-select"><input v-model="selected" type="checkbox" :value="row.equipId" :disabled="saving" :aria-label="row.name+' 선택'" /><strong>{{row.name}}</strong><span>{{row.underpassName}} · {{PM_TYPES[row.type]}}</span></label><p>안전 0 · 주의 {{row.cautionMin}} · 위험 {{row.dangerMin}}</p><small>{{row.updatedByName||'초기 기준'}} · {{displayDate(row.updatedAt)}}</small><RouterLink class="equipment-card-link" :aria-label="row.name+' 상세 보기'" :to="{path:managerAppPath('/pm-equipment-detail',route.path),query:{id:String(row.equipId)}}"></RouterLink><button class="equipment-delete" type="button" :disabled="saving" @click="askDelete(row)">설비 삭제</button></li></ul><p v-if="!loading&&!rows.length">조회된 설비가 없습니다.</p><AppPagination v-if="appView" :page="page" :pages="pages" :disabled="loading||saving" @change="page=$event;load()" /><div v-else class="pm-pager"><button type="button" :disabled="loading||saving||page<=1" @click="page--;load()">이전</button><span>{{page}} / {{pages}}</span><button type="button" :disabled="loading||saving||page>=pages" @click="page++;load()">다음</button></div>
    <dialog ref="confirm" class="pm-delete-dialog" :class="{'pm-delete-app-dialog':appView}" aria-labelledby="pm-delete-title" @cancel="deleting=null"><h2 id="pm-delete-title">설비 삭제</h2><p>{{deleting?.name}} 설비를 삭제하시겠습니까?</p><p>기존 점수와 점검 기록은 보존됩니다.</p><p v-if="error" role="alert">{{error}}</p><footer class="pm-delete-actions"><button type="button" :disabled="saving" @click="remove">삭제</button><button type="button" :disabled="saving" @click="confirm?.close();deleting=null">취소</button></footer></dialog>
  </main></BackendLayout>
</template>
<style scoped>
.pm-settings-list>li { position:relative; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:6px 12px; }
.equipment-card-link { position:absolute; inset:0; border-radius:inherit; }
.equipment-card-link:focus-visible { outline:2px solid var(--r-accent); outline-offset:2px; }
.equipment-select { position:relative; z-index:1; grid-column:1; }
.pm-settings-list>li>p,.pm-settings-list>li>small { grid-column:1; pointer-events:none; }
.equipment-delete { position:relative; z-index:1; grid-column:2; grid-row:1/4; align-self:center; color:var(--admin-alert-ink,#b84455); }
.pm-settings-live { max-width:1100px; margin:auto; } .pm-settings-card,.pm-settings-list>li { padding:18px; margin:16px 0; border:1px solid var(--r-line); border-radius:12px; background:var(--r-surface); } .pm-settings-card { display:flex; flex-wrap:wrap; gap:12px; align-items:end; } h2 { flex-basis:100%; margin:0 0 8px; font-size:16px; } label { display:flex; flex-direction:column; gap:7px; font-size:13px; } input:not([type=checkbox]),select { min-height:38px; min-width:0; max-width:100%; box-sizing:border-box; padding:8px; border:1px solid var(--r-line); border-radius:8px; background:var(--r-surface); color:inherit; font:inherit; } button { min-height:38px; padding:8px 12px; border:1px solid var(--r-line); border-radius:8px; background:var(--r-surface); color:inherit; } .pm-settings-list { list-style:none; padding:0; } .equipment-select { flex-direction:row; flex-wrap:wrap; align-items:center; } .equipment-select span { color:var(--r-muted); font-size:12px; } small { color:var(--r-muted); } .row-actions { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:12px; } .pm-delete-dialog { max-width:calc(100% - 40px); padding:24px; border:1px solid var(--r-line); border-radius:14px; background:var(--r-surface); color:var(--r-ink); } .pm-delete-dialog::backdrop {background:#10203988;} @media(max-width:600px){.pm-settings-card>label{width:100%;}.pm-settings-card input,.pm-settings-card select{width:100%;}}
</style>
