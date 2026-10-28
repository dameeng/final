<script setup lang="ts">
import RiskLevelBadge from '../components/RiskLevelBadge.vue'
import { useRiskChartClock } from '../composables/useRiskChartClock'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BackendLayout from '../components/BackendLayout.vue'
import BackendResource from './backend-resource.vue'
import FacilityCctvViewer from '../components/FacilityCctvViewer.vue'
import FacilityMaintenancePanel from '../components/FacilityMaintenancePanel.vue'
import UnderpassVmsPanel from '../components/UnderpassVmsPanel.vue'
import TunnelCctvDialog from '../components/TunnelCctvDialog.vue'
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
  cameraError = ref(''),
  error = ref(''),
  loading = ref(false),
  operations = ref<InstanceType<typeof BackendResource>>()
const controlNotice=ref('')
function onOperationSaved(result?:{id:string;status:'NORMAL'|'BLOCKED'}) {
  if(result?.id===id.value)controlNotice.value='경찰·소방 통제 안내 기록이 함께 생성되었습니다. 소방 PDF는 이관 문서에서 확인하세요.'
  void load()
}
// 상세 응답에는 regionId 만 있어서 지역 목록으로 이름을 찾는다 (한 번만 조회)
const regionNames = ref<Record<string, string>>({}),
  regionName = computed(
    () => facility.value?.regionName || regionNames.value[String(facility.value?.regionId ?? '')],
  )
backend<{ id: number; name: string }[]>('/api/regions')
  .then((list) => {
    regionNames.value = Object.fromEntries((list || []).map((region) => [String(region.id), region.name]))
  })
  .catch(() => {
    /* 지역명은 보조 정보라 실패하면 하이픈으로 둔다 */
  })
let controller: AbortController | undefined
async function load() {
  controller?.abort()
  if (!id.value) {
    facility.value = undefined
    cameras.value = []
    return
  }
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = ''
  cameraError.value = ''
  if (String(facility.value?.id ?? '') !== id.value) {
    facility.value = undefined
    cameras.value = []
    history.value = []
    forecast.value = []
  }
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
    else {
      cameras.value = []
      cameraError.value = '시설 CCTV 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
    }
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
watch(id, ()=>{controlNotice.value='';void load()}, { immediate: true })
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
      
      <div class="page-head service-heading">
        <div>
          <h1>
            {{facility?.name||'지하차도 상세'}} <RiskLevelBadge v-if="facility" :value="facility.currentRiskLevel" />
          </h1>
          <div class="sub">{{facility?.roadAddress}}</div>
        </div>
        <div class="facility-detail-actions">
          <TunnelCctvDialog v-if="facility" :facility-name="facility.name" :underpass-id="id" />
          <RouterLink v-if="facility&&tab!=='cctv'" class="btn primary" :to="{path:'/fac-detail',query:{id,underpassId:id,tab:'cctv'}}">시설 CCTV 보기</RouterLink>
          <RouterLink class="btn" to="/fac-list">← 목록으로</RouterLink>
        </div>
      </div>
      <p v-if="!id">지하차도 목록에서 시설을 선택해 주세요.</p>
      <p v-if="error" role="alert" class="service-error">
        {{error}} <button @click="load">다시 시도</button>
      </p>
      <p v-if="loading" role="status">시설 정보를 불러오는 중입니다.</p>
      <p v-if="controlNotice" class="service-message" role="status">{{controlNotice}} <RouterLink :to="{path:'/admin-data/transfers',query:{underpassId:id}}">경찰·소방 문서 보기 →</RouterLink></p>
      <nav class="tabs" aria-label="지하차도 상세 탭">
        <!-- 다섯 탭이 같은 경로(?tab= 만 다름)라 라우터 기본 활성 표시는 전부 켜진다. 현재 탭 하나에만 직접 표시 -->
        <RouterLink
          v-for="[value,label] in [['overview','개요'],['equip','설비'],['sign','전광판'],['cctv','CCTV'],['settings','설정']]"
          :key="value"
          v-slot="{href,navigate}"
          :to="{path:'/fac-detail',query:{id,underpassId:id,tab:value}}"
          custom
        >
          <a :href="href" :class="{'is-current':tab===value}" :aria-current="tab===value?'page':undefined" @click="navigate">{{label}}</a>
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
            <section class="card facility-information-card">
              <div class="facility-information-columns"><div class="facility-information-facts">
              <h2>시설 정보</h2>
              <dl class="service-detail">
                <dt>지역</dt>
                <dd>{{regionName||'—'}}</dd>
                <dt>도로명 주소</dt>
                <dd>{{facility.roadAddress||'—'}}</dd>
                <dt>높이</dt>
                <dd>{{facility.heightM??'—'}} m</dd>
                <dt>길이</dt>
                <dd>{{facility.lengthM??'—'}} m</dd>
              </dl>
              <RouterLink :to="{path:'/logs',query:{underpassId:id}}">최근 이벤트 · 통합 로그 →</RouterLink>
              </div><FacilityMaintenancePanel :underpass-id="id" /></div>
            </section>
          </div>
        </section>
<BackendResource v-else-if="tab==='equip'" embedded resource-key="cameras" />
<UnderpassVmsPanel v-else-if="tab==='sign'" :underpass-id="id" :underpass-name="facility?.name" :manageable="!!facility&&ownsFacility(facility)" />
<section v-else-if="tab==='cctv'" class="restored-cctv">
          <p v-if="cameraError" role="alert" class="service-error">{{cameraError}} <button type="button" @click="load">다시 시도</button></p>
          <FacilityCctvViewer v-else :cameras="cameras" :underpass-id="id" :facility-name="facility?.name" />
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
            @saved="onOperationSaved"
          />
        </div>
      </template>
    </section>
  </BackendLayout>
</template>
<style scoped>
.facility-detail-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.facility-information-card { container-type:inline-size; }
.facility-information-columns { display:grid; grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr); gap:24px; }
.facility-information-facts { min-width:0; padding-right:24px; border-right:1px solid var(--r-line); }
.facility-information-facts .service-detail { grid-template-columns:88px minmax(0,1fr); margin:24px 0; }
.facility-information-facts>a { display:inline-block; font-size:12px; line-height:1.6; color:var(--r-accent); text-decoration:none; }
@container (max-width:620px) {
  .facility-information-columns { grid-template-columns:minmax(0,1fr); gap:24px; }
  .facility-information-facts { padding-right:0; padding-bottom:24px; border-right:0; border-bottom:1px solid var(--r-line); }
}
</style>
