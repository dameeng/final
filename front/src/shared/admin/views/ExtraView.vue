<script setup lang="ts">
import { formatDecimal } from '../../utils/format-number'

import { computed, inject, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { adminKey } from '../main'
import { regionsApi } from '../services/admin-api'
const props = defineProps<{ section: string; facilityId?:string }>(),
  route = useRoute(),
  { state } = inject(adminKey)!
// '/thresholds' 메뉴는 '/facilities/:id'와 달리 라우트에 시설 id가 안 들어있다(main.ts 라우트 정의 참고).
// 그래서 'detail' 섹션(상세정보, /facilities/:id로 옴)만 라우트 파라미터를 쓰고,
// 'thresholds'는 화면 안에서 직접 시설을 고르게 한다.
const thresholdsFacilityId = ref<string | null>(null)
watch(
  () => state.underpasses,
  (list) => { if (!thresholdsFacilityId.value && list.length) thresholdsFacilityId.value = list[0].id },
  { immediate: true },
)
const facility = computed(() => {
  const id = props.facilityId || (props.section === 'thresholds' ? thresholdsFacilityId.value : route.params.id)
  return state.underpasses.find((x) => x.id === id)
}),
  message = ref('')
const titles: Record<string, string> = {
  detail: '지하차도 상세정보',
  thresholds: '임계치 설정',
  permissions: '관리자 권한',
}

// 목록 응답(UnderpassListItem)엔 강수량이 없어서, 선택된 시설의 최신 위험도 기록(risk-scores)에서 끌어온다.
const rainfallMm = ref<number | null>(null)
async function loadRainfall() {
  if (!facility.value) { rainfallMm.value = null; return }
  try {
    const response = await fetch(`/api/underpasses/${encodeURIComponent(facility.value.id)}/risk-scores?limit=1`, { credentials: 'include', cache: 'no-store' })
    const body = await response.json()
    const latest = Array.isArray(body?.data) ? body.data.at(-1) : null
    rainfallMm.value = latest && Number.isFinite(Number(latest.rainfallMm)) ? Number(latest.rainfallMm) : null
  } catch { rainfallMm.value = null }
}
watch(facility, () => void loadRainfall(), { immediate: true })

// 임계치(MP-19): underpass별 SAFE/WARNING/DANGER 3단계 표시점수(risk_score_min) 기준.
// 조회는 관리자 전체, 수정은 최고관리자만 가능(백엔드 ThresholdController와 동일하게 프런트에서도 제한).
type ThresholdRow = { level: 'SAFE' | 'WARNING' | 'DANGER'; riskScoreMin: number; updatedAt: string | null; input: string }
const LEVEL_LABEL: Record<string, string> = { SAFE: '정상', WARNING: '주의', DANGER: '위험' }
const thresholds = ref<ThresholdRow[]>([])
const canEditThresholds = computed(() => state.profile?.role === 'SUPER_ADMIN' || (state.profile?.role==='REGIONAL_ADMIN' && state.profile.regionId!=null && facility.value?.regionId===state.profile.regionId))
async function loadThresholds() {
  if (!facility.value) { thresholds.value = []; return }
  try {
    const response = await fetch(`/api/underpasses/${encodeURIComponent(facility.value.id)}/thresholds`, { credentials: 'include', cache: 'no-store' })
    const body = await response.json()
    if (!response.ok || !Array.isArray(body?.data)) throw new Error()
    thresholds.value = body.data.map((row: { level: string; riskScoreMin: number; updatedAt: string | null }) => ({
      level: row.level as ThresholdRow['level'],
      riskScoreMin: Number(row.riskScoreMin),
      updatedAt: row.updatedAt,
      input: String(row.riskScoreMin),
    }))
  } catch { thresholds.value = [] }
}
watch(
  [facility, () => props.section],
  ([, section]) => { if (section === 'thresholds') void loadThresholds() },
  { immediate: true },
)
async function saveThreshold(row: ThresholdRow) {
  if(!canEditThresholds.value)return
  if (!facility.value) return
  const value = Number(row.input)
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    message.value = '0~100 사이 값을 입력해 주세요.'
    return
  }
  try {
    const response = await fetch(
      `/api/underpasses/${encodeURIComponent(facility.value.id)}/thresholds/${row.level}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riskScoreMin: value }),
      },
    )
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.message || '저장에 실패했습니다.')
    row.riskScoreMin = value
    message.value = body?.message || '저장되었습니다.'
  } catch (e) {
    message.value = e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.'
  }
}

// ---- 관리자 권한(permissions): 탈퇴 처리 + 담당 지역 재배정. 최고관리자 전용 ----
type ManagerRow = {
  id: number
  loginId: string
  name: string
  email: string
  role: 'SUPER_ADMIN' | 'REGIONAL_ADMIN'
  status: 'PENDING' | 'ACTIVE' | 'WITHDRAWN'
  regionId: number | null
  regionName: string | null
}
const unassignedManagers = ref<ManagerRow[]>([])
const unassignedLoading = ref(false), unassignedError = ref(''), assigning = ref(false)
async function loadUnassignedManagers() {
 if (!canManage.value || unassignedLoading.value) return
 unassignedLoading.value = true; unassignedError.value = ''
 const found:ManagerRow[]=[]
 try {
  for(let page=1;page<=100;page++){
   const response=await fetch(`/api/managers?page=${page}&size=100&status=ACTIVE&role=REGIONAL_ADMIN`,{credentials:'include',cache:'no-store'})
   const body=await response.json()
   if(!response.ok || !Array.isArray(body?.data?.items))throw new Error(body?.message||'미배정 관리자 조회 실패')
   found.push(...body.data.items.filter((m:ManagerRow)=>m.role==='REGIONAL_ADMIN' && m.status==='ACTIVE' && (m.regionId==null || m.regionName==='미배정')))
   if(page>=Number(body.data.totalPages||1))break
   if(page===100)throw new Error('관리자 목록 전체를 불러오지 못했습니다.')
  }
  unassignedManagers.value=found
  found.forEach(m=>{if(!(m.id in regionChoice.value))regionChoice.value[m.id]=''})
 } catch(e){unassignedManagers.value=[];unassignedError.value=e instanceof Error?e.message:'조회 실패'}
 finally{unassignedLoading.value=false}
}
const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: '최고관리자', REGIONAL_ADMIN: '지역담당자' }
const STATUS_LABEL: Record<string, string> = { PENDING: '승인 대기', ACTIVE: '활성', WITHDRAWN: '탈퇴·거절' }
const managers = ref<ManagerRow[]>([])
const regions = ref<{ id: number; name: string }[]>([])
const regionChoice = ref<Record<number, string>>({})
// 서버 검색/필터: keyword, status, role은 /api/managers 쿼리로 보낸다. 탈퇴·거절 계정은 includeWithdrawn=true여야 나온다.
const managerKeyword = ref('')
const managerStatus = ref<'ACTIVE' | 'WITHDRAWN' | ''>('ACTIVE')
const managerRole = ref<'SUPER_ADMIN' | 'REGIONAL_ADMIN' | ''>('')
const managerPage = ref(1)
const managerTotalPages = ref(1)
const canManage = computed(() => state.profile?.role === 'SUPER_ADMIN')
async function loadManagers() {
  if (!canManage.value) { managers.value = []; return }
  try {
    const params = new URLSearchParams({ page: String(managerPage.value), size: '20' })
    if (managerKeyword.value.trim()) params.set('keyword', managerKeyword.value.trim())
    if (managerStatus.value) params.set('status', managerStatus.value)
    if (managerRole.value) params.set('role', managerRole.value)
    if (managerStatus.value !== 'ACTIVE') params.set('includeWithdrawn', 'true')
    const response = await fetch(`/api/managers?${params}`, { credentials: 'include', cache: 'no-store' })
    const body = await response.json()
    if (!response.ok || !Array.isArray(body?.data?.items)) throw new Error()
    managers.value = body.data.items
    managerTotalPages.value = Math.max(1, Number(body.data.totalPages ?? 1))
    for (const m of managers.value) regionChoice.value[m.id] = m.regionId != null ? String(m.regionId) : ''
  } catch { managers.value = [] }
}
async function loadRegions() {
  try { regions.value = await regionsApi() } catch { regions.value = [] }
}
async function reassign(row: ManagerRow) {
  if(!canManage.value || assigning.value || row.role!=='REGIONAL_ADMIN' || row.status!=='ACTIVE')return
  const value = regionChoice.value[row.id]
  if (!value) { message.value = '지역을 선택해 주세요.'; return }
  assigning.value=true
  try {
    const response = await fetch(`/api/managers/${row.id}/region`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regionId: Number(value) }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.message || '지역 변경에 실패했습니다.')
    message.value = body?.message || '담당 지역을 변경했습니다.'
    await loadManagers(); await loadUnassignedManagers()
  } catch (e) {
    message.value = e instanceof Error ? e.message : '지역 변경 중 오류가 발생했습니다.'
  } finally {assigning.value=false}
}
async function withdraw(row: ManagerRow) {
  if (!confirm(`${row.name}(${row.loginId}) 관리자를 탈퇴 처리할까요?`)) return
  try {
    const response = await fetch(`/api/managers/${row.id}/withdraw`, { method: 'POST', credentials: 'include' })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.message || '탈퇴 처리에 실패했습니다.')
    message.value = body?.message || '탈퇴 처리했습니다.'
    await loadManagers()
  } catch (e) {
    message.value = e instanceof Error ? e.message : '탈퇴 처리 중 오류가 발생했습니다.'
  }
}
function searchManagers() { managerPage.value = 1; void loadManagers() }
function moveManagerPage(step: number) {
  const next = managerPage.value + step
  if (next < 1 || next > managerTotalPages.value) return
  managerPage.value = next
  void loadManagers()
}
watch(
  [() => props.section, () => state.profile],
  ([section]) => { if (section === 'permissions') { void loadManagers(); void loadRegions(); void loadUnassignedManagers() } },
  { immediate: true },
)
</script>

<template>
<div class="routel-admin-page">
  <h1>{{ titles[section] }}</h1>
  <template v-if="section === 'detail'">
    <template v-if="facility">
      <p>
        <router-link to="/facilities">시설 목록</router-link>
      </p>
      <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table">
        <tbody>
          <tr>
            <td valign="top">
            <h2>{{ facility.name }}</h2>
            <dl>
              <dt>시설 ID</dt>
              <dd>{{ facility.id }}</dd>
              <dt>지역</dt>
              <dd>{{ facility.region }}</dd>
              <dt>상태</dt>
              <dd>{{ facility.status }}</dd>
              <dt>강수량</dt>
              <dd>{{ rainfallMm ?? "—" }} mm</dd>
              <dt>최근 갱신</dt>
              <dd>{{ facility.updatedAt }}</dd>
            </dl>
              <router-link to="/facilities">통제·해제</router-link>
              · <router-link :to="`/facilities/${facility.id}/cctv`">CCTV 보기</router-link>
            </td>
          </tr>
        </tbody>
      </table></div>
    </template>
    <p v-else>시설을 찾을 수 없습니다.</p>
  </template>
  <template v-else-if="section === 'thresholds'">
    <p>
      <label>시설 <span v-if="props.facilityId">{{ facility?.name }}</span>
        <select v-model="thresholdsFacilityId" v-if="!props.facilityId">
          <option v-for="item in state.underpasses" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
    </p>
    <p v-if="!facility">시설을 찾을 수 없습니다.</p>
    <template v-else>
      <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table">
        <tbody>
          <tr>
            <th>단계</th>
            <th>표시점수 기준 (0~100)</th>
            <th>최근 수정</th>
            <th v-if="canEditThresholds">변경</th>
          </tr>
          <tr v-for="row in thresholds" :key="row.level">
            <td>{{ LEVEL_LABEL[row.level] ?? row.level }}</td>
            <td>{{ formatDecimal(row.riskScoreMin) }}</td>
            <td>{{ row.updatedAt ?? '-' }}</td>
            <td v-if="canEditThresholds">
              <input type="number" min="0" max="100" step="0.01" v-model="row.input" class="routel-threshold-input" />
              <button type="button" @click="saveThreshold(row)">저장</button>
            </td>
          </tr>
          <tr v-if="!thresholds.length">
            <td :colspan="canEditThresholds ? 4 : 3" align="center">불러올 수 없습니다.</td>
          </tr>
        </tbody>
      </table></div>
      <p v-if="!canEditThresholds">임계치 값 변경은 최고관리자만 가능합니다.</p>
      <p role="status">{{ message }}</p>
    </template>
  </template>
  <template v-else-if="section === 'permissions'">
    <p v-if="!canManage">최고관리자만 사용할 수 있습니다.</p>
    <template v-else>
      <section class="review-unassigned">
        <div class="review-inquiry-heading"><h2>미배정 관리자</h2><button type="button" :disabled="unassignedLoading||assigning" @click="loadUnassignedManagers">새로고침</button></div>
        <p v-if="unassignedLoading" role="status">불러오는 중…</p><p v-if="unassignedError" role="alert">{{ unassignedError }}</p>
        <ul><li v-for="row in unassignedManagers" :key="row.id"><span><strong>{{ row.name }}</strong><small>{{ row.loginId }}</small></span><span class="review-status" data-status="PENDING">미배정</span><label>담당 지역<select v-model="regionChoice[row.id]" :disabled="assigning"><option value="">지역 선택</option><option v-for="r in regions.filter(r=>r.name!=='미배정')" :key="r.id" :value="String(r.id)">{{ r.name }}</option></select></label><button type="button" :disabled="assigning||!regionChoice[row.id]" @click="reassign(row)">배정</button></li></ul>
        <p v-if="!unassignedLoading&&!unassignedError&&!unassignedManagers.length">미배정 관리자가 없습니다.</p>
        <p v-if="message" role="status">{{ message }}</p>
      </section>
      <h2>전체 관리자</h2>
      <form @submit.prevent="searchManagers">
        <label>검색 <input v-model="managerKeyword" type="search" placeholder="이름·아이디·이메일" /></label>
        <label>상태 <select v-model="managerStatus"><option value="ACTIVE">활성</option><option value="WITHDRAWN">탈퇴·거절</option><option value="">전체</option></select></label>
        <label>권한 <select v-model="managerRole"><option value="">전체</option><option value="SUPER_ADMIN">최고관리자</option><option value="REGIONAL_ADMIN">지역담당자</option></select></label>
        <button type="submit">조회</button>
      </form>
      <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table">
      <tbody>
        <tr>
          <th>관리자 ID</th>
          <th>아이디</th>
          <th>이름</th>
          <th>현재 권한</th>
          <th>담당 지역</th>
          <th>지역 변경</th>
          <th>상태</th>
          <th>탈퇴</th>
        </tr>
        <tr v-for="row in managers" :key="row.id">
          <td>{{ row.id }}</td>
          <td>{{ row.loginId }}</td>
          <td>{{ row.name }}</td>
          <td>{{ ROLE_LABEL[row.role] ?? row.role }}</td>
          <td>{{ row.regionName ?? '미배정' }}</td>
          <td>
            <template v-if="row.role === 'REGIONAL_ADMIN' && row.status === 'ACTIVE'">
              <select v-model="regionChoice[row.id]">
                <option value="">선택</option>
                <option v-for="r in regions" :key="r.id" :value="String(r.id)">{{ r.name }}</option>
              </select>
              <button type="button" :disabled="assigning" @click="reassign(row)">변경</button>
            </template>
            <span v-else>-</span>
          </td>
          <td>{{ STATUS_LABEL[row.status] ?? row.status }}</td>
          <td>
            <button class="routel-danger-action" v-if="row.role !== 'SUPER_ADMIN' && row.status === 'ACTIVE'" type="button" @click="withdraw(row)">탈퇴 처리</button>
            <span v-else>-</span>
          </td>
        </tr>
        <tr v-if="!managers.length">
          <td colspan="8" align="center">조건에 맞는 관리자가 없습니다.</td>
        </tr>
          </tbody>
      </table></div>
      <p class="admin-pagination">
        <button type="button" :disabled="managerPage <= 1" @click="moveManagerPage(-1)">이전</button>
        {{ managerPage }} / {{ managerTotalPages }}
        <button type="button" :disabled="managerPage >= managerTotalPages" @click="moveManagerPage(1)">다음</button>
      </p>
      <p role="status">{{ message }}</p>
    </template>
  </template>

</div>
</template>