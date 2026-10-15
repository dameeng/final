<script setup lang="ts">
import { inject, onMounted, reactive, ref } from 'vue'
import { adminKey } from '../main'
import { adminApi, facilityDetailApi, regionsApi, type Region } from '../services/admin-api'
import '../styles/manage.css'

const props=withDefaults(defineProps<{mode?:'all'|'facilities'|'regions'|'facility';initialId?:string}>(),{mode:'all'})
const { state, refresh, control } = inject(adminKey)!
const regions = ref<Region[]>([])
const message = ref('')
const busy = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({ name: '', regionId: '', roadAddress: '', latitude: '', longitude: '', heightM: '', lengthM: '', floodHistoryCount: '0' })
const regionName = ref('')

async function load() {
  try { regions.value = await regionsApi() }
  catch (e) { message.value = (e as Error).message }
}
function reset() {
  editingId.value = null
  Object.assign(form, { name: '', regionId: '', roadAddress: '', latitude: '', longitude: '', heightM: '', lengthM: '', floodHistoryCount: '0' })
}
async function edit(id: string) {
  try {
    const row = await facilityDetailApi(id)
    editingId.value = row.id
    Object.assign(form, {
      name: row.name, regionId: row.regionId == null ? '' : String(row.regionId), roadAddress: row.roadAddress || '',
      latitude: String(row.latitude ?? ''), longitude: String(row.longitude ?? ''),
      heightM: row.heightM == null ? '' : String(row.heightM), lengthM: row.lengthM == null ? '' : String(row.lengthM),
      floodHistoryCount: String(row.floodHistoryCount ?? 0),
    })
    if(!props.initialId)window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) { message.value = (e as Error).message }
}
async function save() {
  if (busy.value) return
  if(props.initialId && editingId.value !== Number(props.initialId)){message.value='시설 정보를 먼저 정상적으로 불러와야 수정할 수 있습니다.';return}
  busy.value = true; message.value = ''
  const payload = {
    name: form.name.trim(), regionId: Number(form.regionId), roadAddress: form.roadAddress.trim(),
    latitude: Number(form.latitude), longitude: Number(form.longitude),
    heightM: form.heightM === '' ? null : Number(form.heightM),
    lengthM: form.lengthM === '' ? null : Number(form.lengthM),
    floodHistoryCount: Number(form.floodHistoryCount),
  }
  try {
    await adminApi(`/underpasses${editingId.value ? `/${editingId.value}` : ''}`, {
      method: editingId.value ? 'PUT' : 'POST', body: JSON.stringify(payload),
    })
    message.value = editingId.value ? '시설 정보를 수정했습니다.' : '시설을 등록했습니다.'
    if(!props.initialId)reset(); await refresh()
  } catch (e) { message.value = (e as Error).message }
  finally { busy.value = false }
}
async function remove(id: string, name: string) {
  if (!window.confirm(`${name}을(를) 삭제하시겠습니까?`)) return
  try { await adminApi(`/underpasses/${id}`, { method: 'DELETE' }); message.value = '시설을 삭제했습니다.'; await refresh() }
  catch (e) { message.value = (e as Error).message }
}
async function changeControl(id: string, name: string, status: '통제' | '정상') {
  if (busy.value) return
  if (!window.confirm(`${name}을(를) ${status === '통제' ? '통제' : '해제'}할까요?`)) return
  busy.value = true; message.value = ''
  try { await control(id, status); message.value = `${name} ${status === '통제' ? '통제' : '해제'} 완료` }
  catch (e) { message.value = (e as Error).message }
  finally { busy.value = false }
}
async function addRegion() {
  if (!regionName.value.trim()) return
  try { await adminApi('/regions', { method: 'POST', body: JSON.stringify({ name: regionName.value.trim() }) }); regionName.value = ''; message.value = '지역을 추가했습니다.'; await load() }
  catch (e) { message.value = (e as Error).message }
}
async function renameRegion(region: Region) {
  const name = window.prompt('변경할 지역 이름', region.name)?.trim()
  if (!name || name === region.name) return
  try { await adminApi(`/regions/${region.id}`, { method: 'PUT', body: JSON.stringify({ name }) }); message.value = '지역 이름을 수정했습니다.'; await load(); await refresh() }
  catch (e) { message.value = (e as Error).message }
}
async function deleteRegion(region: Region) {
  if (!window.confirm(`${region.name} 지역을 삭제하시겠습니까? 소속 시설·담당자는 자동으로 "미배정" 지역으로 옮겨집니다.`)) return
  try { await adminApi(`/regions/${region.id}`, { method: 'DELETE' }); message.value = '지역을 삭제했습니다.'; await load(); await refresh() }
  catch (e) { message.value = (e as Error).message }
}
onMounted(() => { void load(); if(props.initialId)void edit(props.initialId) })
</script>

<template>
<div class="routel-admin-page">
  <main class="manage-page">
    <h1>{{ props.mode==='regions'?'지역 관리':props.mode==='all'?'지하차도·지역 관리':'시설 정보 관리' }}</h1>
    <p role="status">{{ message }}</p>
    <section v-if="props.mode!=='regions'">
      <h2>{{ editingId ? '지하차도 수정 · 지역 배정' : '지하차도 추가' }}</h2>
      <form class="manage-form" @submit.prevent="save">
        <label>시설명 <input v-model="form.name" required maxlength="100" /></label>
        <label>지역 <select v-model="form.regionId" required><option value="" disabled>지역 선택</option><option v-for="item in regions" :key="item.id" :value="String(item.id)">{{ item.name }}</option></select></label>
        <label>도로명주소 <input v-model="form.roadAddress" maxlength="255" /></label>
        <label>위도 <input v-model="form.latitude" type="number" step="any" min="-90" max="90" required /></label>
        <label>경도 <input v-model="form.longitude" type="number" step="any" min="-180" max="180" required /></label>
        <label>높이(m) <input v-model="form.heightM" type="number" step="any" min="0" /></label>
        <label>길이(m) <input v-model="form.lengthM" type="number" step="any" min="0" /></label>
        <label>침수 이력 횟수 <input v-model="form.floodHistoryCount" type="number" min="0" required /></label>
        <div><button :disabled="busy || !regions.length || (!!props.initialId && editingId !== Number(props.initialId))">{{ editingId ? '수정 저장' : '시설 등록' }}</button> <button v-if="editingId&&!props.initialId" type="button" @click="reset">취소</button></div>
      </form>
    </section>
    <section v-if="props.mode==='all'||props.mode==='facilities'">
      <h2>시설 목록</h2>
      <p v-if="state.error">{{ state.error }}</p>
      <div class="manage-scroll"><div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table"><thead><tr><th>시설</th><th>지역</th><th>상태</th><th>관리</th></tr></thead><tbody>
        <tr v-for="item in state.underpasses" :key="item.id"><td>{{ item.name }}</td><td>{{ item.region || '미배정' }}</td><td><span class="routel-admin-state" :data-state="item.status">{{ item.status }}</span></td><td><button type="button" @click="edit(item.id)">수정·배정</button> <button class="routel-danger-action" type="button" @click="remove(item.id, item.name)">삭제</button> <button type="button" :disabled="busy || !!state.error || item.status === '통제'" @click="changeControl(item.id, item.name, '통제')">통제</button> <button type="button" :disabled="busy || !!state.error || item.status !== '통제'" @click="changeControl(item.id, item.name, '정상')">통제 해제</button></td></tr>
      </tbody></table></div></div>
    </section>
    <section v-if="props.mode==='all'||props.mode==='regions'">
      <h2>지역 목록</h2>
      <p>시설이 없는 지역도 표시됩니다.</p>
      <form @submit.prevent="addRegion"><label>지역 이름 <input v-model="regionName" maxlength="50" required /></label> <button>지역 추가</button></form>
      <div class="manage-scroll"><div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table"><thead><tr><th>지역</th><th>관리</th></tr></thead><tbody>
        <tr v-for="item in regions" :key="item.id"><td>{{ item.name }}</td><td><button type="button" @click="renameRegion(item)">이름 변경</button> <button class="routel-danger-action" type="button" @click="deleteRegion(item)">삭제</button></td></tr>
      </tbody></table></div></div>
      <p>지역을 삭제하면 소속 시설·담당자는 자동으로 "미배정" 지역으로 옮겨진 뒤 삭제됩니다(거부되지 않습니다).</p>
    </section>
  </main>
</div>
</template>