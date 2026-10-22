<script setup lang="ts">
import RiskLevelBadge from '../components/RiskLevelBadge.vue'
import { useRiskChartClock } from '../composables/useRiskChartClock'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BackendLayout from '../components/BackendLayout.vue'
import BackendResource from './backend-resource.vue'
import FacilityCctvViewer from '../components/FacilityCctvViewer.vue'
import { riskGroup } from '../services/backendCatalog'
import { riskChartSeries } from '../utils/risk-chart'
import { useBackendEvents } from '../composables/useBackendEvents'
import { patchFacility, facilityEvents, appendRiskHistory } from '../services/streamUpdates'
import { ownsFacility } from '../services/facilityAccess'
import { backend, asPage } from '../services/backend'
import { backendResources, valueLabels } from '../data/backendResources'
const route = useRoute(),
  id = computed(() => String(route.query.id || '')),
  tab = computed(() => String(route.query.tab || 'overview'))
const facility = ref<Record<string, any>>(),
  history = ref<any[]>([]),
  forecast = ref<any[]>([]),
  forecastError = ref(''),
  cameras = ref<any[]>([]),
  error = ref(''),
  loading = ref(false),
  operations = ref<InstanceType<typeof BackendResource>>()
let controller: AbortController | undefined
async function load() {
  controller?.abort()
  if (!id.value) return
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = ''
  try {
    facility.value = await backend('/api/underpasses/' + encodeURIComponent(id.value), {
      signal: current.signal,
    })
    const results = await Promise.allSettled([
      backend(
        '/api/underpasses/' + encodeURIComponent(id.value) + '/risk-scores?hours=6&limit=100',
        { signal: current.signal },
      ),
      backend('/api/underpasses/' + encodeURIComponent(id.value) + '/cameras', {
        signal: current.signal,
      }),
      backend('/api/underpasses/' + encodeURIComponent(id.value) + '/risk-forecast', {
        signal: current.signal,
      }),
    ])
    if (current.signal.aborted) return
    if (results[0]?.status === 'fulfilled') history.value = asPage<any>(results[0].value).items
    if (results[1]?.status === 'fulfilled') cameras.value = asPage<any>(results[1].value).items
    if (results[2]?.status === 'fulfilled') {
      forecast.value = Array.isArray(results[2].value) ? results[2].value : []
      forecastError.value = ''
    } else {
      forecast.value = []
      forecastError.value = '예측 정보를 불러오지 못했습니다.'
    }
  } catch (e) {
    if (!current.signal.aborted) error.value = (e as Error).message
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}
let streamRefresh: ReturnType<typeof setTimeout> | undefined
useBackendEvents((event) => {
  const { name, data } = event
  if (facilityEvents.includes(name)) {
    if (facility.value) facility.value = patchFacility(facility.value, event)
    if (name === 'risk-update' && String(data.underpassId) === id.value)
      history.value = appendRiskHistory(history.value, data)
    return
  }
  if (name === 'data-changed' && data.resource === 'risk-forecast') {
    if (String(data.id) === id.value && controller && !controller.signal.aborted)
      void backend('/api/underpasses/' + encodeURIComponent(id.value) + '/risk-forecast', {
        signal: controller.signal,
      })
        .then((rows) => {
          if (!controller?.signal.aborted) {
            forecast.value = Array.isArray(rows) ? rows : []
            forecastError.value = ''
          }
        })
        .catch(() => {
          forecastError.value = '예측 정보를 불러오지 못했습니다.'
        })
    return
  }
  if (
    name === 'connected' ||
    (name === 'data-changed' && ['underpass', 'camera', 'threshold'].includes(data.resource)) ||
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
  controller?.abort()
})
const chartNow = useRiskChartClock()
const series = computed(() =>
  riskChartSeries(history.value, forecast.value, 30, 610, 180, 150, { now: chartNow.value }),
)
const points = computed(() => series.value.observed)
function control() {
  if (facility.value && ownsFacility(facility.value))
    void operations.value?.open(
      'action',
      facility.value,
      backendResources.facilities!.actions?.[facility.value.currentStatus === 'BLOCKED' ? 1 : 0],
    )
}
</script>
<template>
  <BackendLayout class="page-fac-detail">
    <section class="service-workspace restored-facility-detail">
      <div class="crumb">지하차도 관리 &gt; {{facility?.name||'시설 상세'}}</div>
      <div class="page-head service-heading">
        <div>
          <h1>
            {{facility?.name||'지하차도 상세'}} <RiskLevelBadge v-if="facility" :value="facility.currentRiskLevel" />
          </h1>
          <div class="sub">{{facility?.roadAddress}}</div>
        </div>
        <RouterLink class="btn" to="/fac-list">← 목록으로</RouterLink>
      </div>
      <p v-if="!id">지하차도 목록에서 시설을 선택해 주세요.</p>
      <p v-if="error" role="alert" class="service-error">
        {{error}} <button @click="load">다시 시도</button>
      </p>
      <p v-if="loading" role="status">시설 정보를 불러오는 중입니다.</p>
      <nav class="tabs" aria-label="지하차도 상세 탭">
        <RouterLink
          v-for="[value,label] in [['overview','개요'],['equip','설비'],['sign','전광판'],['cctv','CCTV'],['settings','설정']]"
          :key="value"
          :to="{path:'/fac-detail',query:{id,underpassId:id,tab:value}}"
          :class="{'is-current':tab===value}"
        >
          {{label}}
        </RouterLink>
      </nav>
<template v-if="facility">
        <section v-if="tab==='overview'" aria-label="개요">
          <div class="restored-overview-grid">
            <section class="card">
              <h2>위험 단계</h2>
              <strong class="detail-score">
                {{facility.riskScore??facility.currentRiskScore??'—'}}점</strong>
              <div class="restored-risk-gauge">
                <b
                  :style="{width:Math.max(0,Math.min(100,Number(facility.riskScore??facility.currentRiskScore)||0))+'%'}"
                ></b>
              </div>
              <dl class="service-detail">
                <dt>위험 단계</dt>
                <dd><RiskLevelBadge :value="facility.currentRiskLevel" /></dd>
                <dt>현재 수위</dt>
                <dd>{{facility.currentWaterCm??'—'}} cm</dd>
                <dt>강우량</dt>
                <dd>{{facility.rainfallMm??'—'}} mm</dd>
              </dl>
            </section>
            <section class="card">
              <h2>통제</h2>
              <strong class="detail-score">
                {{facility.currentStatus==='BLOCKED'?'입구 차단 중':'정상 운영'}}
              </strong>
              <dl class="service-detail">
                <dt>통과 중 차량</dt>
                <dd>{{facility.remainingCount??'—'}}대</dd>
                <dt>판별 대기</dt>
                <dd>{{facility.pendingReviewCount??'—'}}건</dd>
              </dl>
              <button
                class="btn primary"
                :disabled="!ownsFacility(facility)"
                :title="ownsFacility(facility)?'':'담당 외 시설은 통제할 수 없습니다.'"
                @click="control"
              >
                {{facility.currentStatus==='BLOCKED'?'통제 해제':'통제'}}
              </button>
            </section>
            <section class="card">
              <h2>위험 점수 추이 · 관측 및 예측</h2>
              <svg
                v-if="points||series.forecast"
                class="restored-risk-chart"
                viewBox="0 0 670 210"
                role="img"
                aria-label="관측된 위험 점수 추이"
              >
                <path d="M30 20V180H640" fill="none" stroke="#8a93a0" />
                <line
                  v-if="series.boundary!==null"
                  :x1="series.boundary"
                  :x2="series.boundary"
                  y1="30"
                  y2="180"
                  stroke="#c9ced6"
                  stroke-dasharray="3 4"
                />
                <text
                  v-for="tick in series.ticks"
                  :key="tick.x"
                  :x="tick.x"
                  y="200"
                  text-anchor="middle"
                  font-size="12"
                  fill="currentColor"
                >
                  {{tick.label}}
                </text>
                <circle
                  v-if="series.lastObserved"
                  :cx="series.lastObserved.x"
                  :cy="series.lastObserved.y"
                  r="4"
                  fill="#2b5c8a"
                />
                <path
                  v-if="series.carryPath"
                  :d="series.carryPath"
                  fill="none"
                  stroke="#2b5c8a"
                  stroke-opacity=".5"
                  stroke-width="2"
                  stroke-dasharray="2 3"
                />
                <path :d="series.observedPath" fill="none" stroke="#2b5c8a" stroke-width="3" />
                <path
                  v-if="series.forecastPath"
                  :d="series.forecastPath"
                  fill="none"
                  stroke="#2b5c8a"
                  stroke-width="3"
                  stroke-dasharray="8 5"
                />
              </svg>
              <p v-else>조회된 위험도 관측 기록이 없습니다.</p>
              <p v-if="series.forecast">실선: 관측 · 점선: 향후 3시간 예측</p>
              <p v-if="series.carryPath" class="sub">엷은 점선: 최근 관측값을 현재까지 유지 (추가 관측 아님)</p>
              <p v-if="forecastError">{{forecastError}}</p>
            </section>
            <section class="card">
              <h2>시설 정보</h2>
              <dl class="service-detail">
                <dt>지역</dt>
                <dd>{{facility.regionName||'—'}}</dd>
                <dt>도로명 주소</dt>
                <dd>{{facility.roadAddress||'—'}}</dd>
                <dt>높이</dt>
                <dd>{{facility.heightM??'—'}} m</dd>
                <dt>길이</dt>
                <dd>{{facility.lengthM??'—'}} m</dd>
              </dl>
              <RouterLink :to="{path:'/logs',query:{underpassId:id}}">최근 이벤트 · 통합 로그 →</RouterLink>
            </section>
          </div>
        </section>
<BackendResource v-else-if="tab==='equip'" embedded resource-key="cameras" />
<BackendResource v-else-if="tab==='sign'" embedded resource-key="display" />
<section v-else-if="tab==='cctv'" class="restored-cctv">
          <FacilityCctvViewer :cameras="cameras" :underpass-id="id" />
        </section>
<section v-else-if="tab==='settings'" class="restored-overview-grid">
          <section class="card">
            <h2>시설 정보</h2>
            <dl class="service-detail">
              <dt>시설명</dt>
              <dd>{{facility.name}}</dd>
              <dt>도로명 주소</dt>
              <dd>{{facility.roadAddress}}</dd>
            </dl>
            <button class="btn" @click="operations?.open('edit',facility)">시설 정보 수정</button>
            <button
              class="btn"
              @click="operations?.open('action',facility,backendResources.facilities!.actions?.[3])"
            >입출구 카메라 지정</button>
          </section>
          <section class="card"><BackendResource embedded resource-key="thresholds" /></section>
        </section>
<div class="restored-facility-operations">
          <BackendResource
            ref="operations"
            operations-only
            embedded
            resource-key="facilities"
            @saved="load"
          />
        </div>
      </template>
    </section>
  </BackendLayout>
</template>
