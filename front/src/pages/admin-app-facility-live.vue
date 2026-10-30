<script setup lang="ts">
import RiskLevelBadge from '../components/RiskLevelBadge.vue'
import { adminResourceTitles } from '../data/adminTitles'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { patchFacility, facilityEvents } from '../services/streamUpdates'
import { useBackendEvents } from '../composables/useBackendEvents'
import { ownsFacility } from '../services/facilityAccess'
import { backend } from '../services/backend'
import { backendResources, type Action } from '../data/backendResources'
import BackendResource from './backend-resource.vue'
const route = useRoute(),
  id = computed(() => String(route.query.id || '')),
  facility = ref<Record<string, any>>(),
  operations = ref<InstanceType<typeof BackendResource>>(),
  error = ref(''),
  loading = ref(false)
const recordLinks = [
  { key: 'reviews', description: '확인이 필요한 번호판', icon: 'M9 5H5v16h14V5h-4M9 3h6v4H9zM8 13l2 2 5-5' },
  { key: 'transits', description: '차량 진입·통과 내역', icon: 'M3 8h14m-4-4 4 4-4 4M21 16H7m4-4-4 4 4 4' },
  { key: 'ocr', description: '번호판 인식 결과', icon: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M5 12h14M8 8h8v8H8z' },
]
const facilitySpecs = computed(() => [
  { label: '높이', value: facility.value?.heightM, unit: 'm' },
  { label: '길이', value: facility.value?.lengthM, unit: 'm' },
  { label: '차로 수', value: facility.value?.lanes, unit: '차로' },
  { label: '안전등급', value: !facility.value?.safetyGrade || ['UNKNOWN','NONE','N/A'].includes(String(facility.value.safetyGrade).toUpperCase()) ? '미확인' : facility.value.safetyGrade, unit: '' },
].filter(item => item.value != null && item.value !== ''))
let abort: AbortController | undefined
async function load() {
  abort?.abort()
  if (!id.value) {
    facility.value = undefined
    return
  }
  const request = new AbortController()
  abort = request
  loading.value = true
  error.value = ''
  if (String(facility.value?.id ?? '') !== id.value) {
    facility.value = undefined
  }
  try {
    facility.value = await backend('/api/underpasses/' + encodeURIComponent(id.value), {
      signal: request.signal,
    })
  } catch (e) {
    if (!request.signal.aborted) {
      error.value = (e as Error).message
    }
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}
let streamRefresh: ReturnType<typeof setTimeout> | undefined
useBackendEvents((event) => {
  const { name, data } = event
  if (facilityEvents.includes(name) && facility.value) {
    facility.value = patchFacility(facility.value, event)
    return
  }
  if (
    name === 'connected' ||
    (name === 'data-changed' && data.resource === 'underpass') ||
    (String(data.underpassId) === id.value &&
      ['transit-update', 'plate-queue-add', 'plate-queue-done'].includes(name))
  ) {
    clearTimeout(streamRefresh)
    streamRefresh = setTimeout(() => void load(), 200)
  }
})
watch(id, load, { immediate: true })
onBeforeUnmount(() => {
  clearTimeout(streamRefresh)
  abort?.abort()
})
function action(item: Action) {
  if (facility.value && ownsFacility(facility.value))
    void operations.value?.open('action', facility.value, item)
}
</script>
<template>
  <section class="app-facility-detail">
    <p v-if="loading" role="status">시설 정보 조회 중…</p>
    <p v-if="error" role="alert">{{error}}</p>
    <template v-if="facility">
      <section class="app-facility-summary">
      <div class="app-facility-heading">
        <h1>{{facility.name}}</h1>
        <button
          type="button"
          class="app-facility-control"
          :disabled="!ownsFacility(facility)"
          :title="ownsFacility(facility)?'':'담당 외 시설은 통제할 수 없습니다.'"
          @click="action(backendResources.facilities!.actions![facility.currentStatus==='BLOCKED'?1:0]!)"
        >{{facility.currentStatus==='BLOCKED'?'통제 해제':'통제 시작'}}</button>
      </div>
      <div class="app-detail-badges">
        <RiskLevelBadge :value="facility.currentRiskLevel" />
        <span class="app-operation-badge" :class="{'is-blocked':facility.currentStatus==='BLOCKED'}">{{facility.currentStatus==='BLOCKED'?'통제 중':facility.currentStatus==='NORMAL'||facility.currentStatus==='OPEN'?'정상 운영':'상태 미확인'}}</span>
      </div>
      <dl v-if="facilitySpecs.length" class="app-facility-specs">
        <div v-for="item in facilitySpecs" :key="item.label"><dt>{{item.label}}</dt><dd>{{item.value}}<small v-if="item.unit">{{item.unit}}</small></dd></div>
      </dl>
      </section>
      <section class="app-facility-metrics" aria-labelledby="app-facility-metrics-title">
      <header><h2 id="app-facility-metrics-title">시설 현황</h2><span>현재 수신 정보</span></header>
      <div class="app-metric-grid">
        <div class="app-metric">
          <small>위험 점수</small>
          <b>{{facility.riskScore??facility.currentRiskScore??'미수신'}}<span v-if="facility.riskScore!=null||facility.currentRiskScore!=null">점</span></b>
          <span class="app-metric-caption">위험도 평가</span>
        </div>
        <div class="app-metric">
          <small>강수량</small>
          <b>{{facility.rainfallMm??'미수신'}}<span v-if="facility.rainfallMm!=null">mm</span></b>
          <span class="app-metric-caption">관측 강수량</span>
        </div>
        <div class="app-metric">
          <small>잔류 차량</small>
          <b>{{facility.remainingCount??'미수신'}}<span v-if="facility.remainingCount!=null">대</span></b>
          <span class="app-metric-caption">시설 내 차량</span>
        </div>
        <div class="app-metric">
          <small>판별 대기</small>
          <b>{{facility.pendingReviewCount??'미수신'}}<span v-if="facility.pendingReviewCount!=null">건</span></b>
          <span class="app-metric-caption">번호판 확인 대상</span>
        </div>
      </div>
      </section>
      <section class="app-facility-records" aria-labelledby="app-facility-records-title">
        <h2 id="app-facility-records-title">차량 기록</h2>
        <nav aria-label="지하차도 차량 기록">
          <RouterLink v-for="record in recordLinks" :key="record.key" :to="{path:'/admin-app/'+record.key,query:{underpassId:id,...(record.key==='reviews'?{reviewStatus:'PENDING'}:{})}}">
            <span class="app-record-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="record.icon" /></svg></span>
            <span class="app-record-copy"><strong>{{adminResourceTitles[record.key]}}</strong><small>{{record.description}}</small></span>
            <span class="app-record-arrow" aria-hidden="true">›</span>
          </RouterLink>
        </nav>
      </section>
      <div class="app-hidden-operations">
        <BackendResource
          ref="operations"
          operations-only
          resource-key="facilities"
          embedded
          @saved="load"
        />
      </div>
    </template>
    <RouterLink v-else-if="!loading" to="/admin-app/screen-4">통제 목록에서 시설을 선택해 주세요.</RouterLink>
  </section>
</template>
<style scoped>
.app-facility-summary { padding:16px; border:1px solid var(--r-line,#dce7f2); border-radius:14px; background:var(--r-surface,#fff); }
.app-facility-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
.app-facility-heading h1 { flex:1; min-width:0; margin:0; font-size:19px; line-height:28px; overflow-wrap:anywhere; }
.app-facility-control { flex:0 0 88px; height:40px; border:1px solid transparent; border-radius:8px; background:var(--r-primary,#18528a); color:#fff; font:inherit; font-size:13px; font-weight:650; cursor:pointer; }
.app-facility-control:disabled { opacity:.5; cursor:default; }
.app-facility-specs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin:14px 0 0; padding-top:14px; border-top:1px solid var(--r-line,#dce7f2); }
.app-facility-specs>div { display:flex; align-items:baseline; justify-content:space-between; gap:6px; min-width:0; }
.app-facility-specs dt { font-size:12px; color:var(--r-muted,#5c738b); }
.app-facility-specs dd { margin:0; font-size:13px; font-weight:600; }
.app-facility-specs dd small { margin-left:3px; font-size:11px; font-weight:400; color:var(--r-muted,#5c738b); }
.app-facility-metrics { margin-top:18px; }
.app-facility-metrics>header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.app-facility-metrics h2,.app-facility-records h2 { margin:0; font-size:14px; line-height:20px; }
.app-facility-metrics>header>span { color:var(--r-muted,#5c738b); font-size:11px; }
.app-metric-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.app-metric { display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:6px; min-width:0; min-height:108px; box-sizing:border-box; padding:14px; border:1px solid var(--r-line,#dce7f2); border-radius:12px; background:var(--r-surface,#fff); }
.app-metric>small { color:var(--r-muted,#5c738b); font-size:12px; }
.app-metric>b { font-size:22px; line-height:28px; font-weight:750; font-variant-numeric:tabular-nums; }
.app-metric>b>span { margin-left:4px; font-size:12px; font-weight:500; }
.app-metric-caption { color:var(--r-muted,#5c738b); font-size:11px; line-height:16px; }
.app-facility-records { margin:18px 0 0; padding:16px; border:1px solid var(--r-line,#dce7f2); border-radius:14px; background:var(--r-surface,#fff); }
.app-facility-records nav { display:grid; grid-template-columns:minmax(0,1fr); margin-top:10px; }
.app-facility-records a { display:flex; align-items:center; gap:12px; min-height:74px; padding:12px 0; box-sizing:border-box; border-bottom:1px solid var(--r-line,#dce7f2); color:var(--r-ink,#172e49); font-size:13px; line-height:20px; text-decoration:none; word-break:keep-all; }
.app-facility-records a:last-child { border-bottom:0; padding-bottom:0; }
.app-record-icon { display:grid; place-items:center; flex:0 0 38px; height:38px; border-radius:10px; background:var(--r-selected,#eaf3ff); color:var(--r-accent,#2375d6); }
.app-record-icon svg { width:22px; height:22px; }
.app-record-copy { flex:1; min-width:0; }
.app-record-copy strong { display:block; font-size:13px; font-weight:650; }
.app-record-copy small { display:block; margin-top:3px; color:var(--r-muted,#5c738b); font-size:11px; line-height:16px; }
.app-record-arrow { flex-shrink:0; color:var(--r-muted,#5c738b); font-size:22px; }
.app-facility-records a:is(:hover,:focus-visible) { background:var(--r-selected,#eaf3ff); border-color:var(--r-accent,#2375d6); }
</style>
