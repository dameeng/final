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
import { riskSplitChart } from '../utils/risk-chart'
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
  thresholds = ref<{ level: string; riskScoreMin: number }[]>([]),
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
    thresholds.value = []
  }
  try {
    facility.value = await backend('/api/underpasses/' + encodeURIComponent(id.value), {
      signal: current.signal,
    })
    const results = await Promise.allSettled([
      backend(
        // 10초마다 쌓이므로 최근 1시간(약 360건)을 받아 그래프에서 1분 평균으로 그린다
        '/api/underpasses/' + encodeURIComponent(id.value) + '/risk-scores?hours=1&limit=500',
        { signal: current.signal },
      ),
      backend('/api/underpasses/' + encodeURIComponent(id.value) + '/cameras', {
        signal: current.signal,
      }),
      backend('/api/underpasses/' + encodeURIComponent(id.value) + '/risk-forecast', {
        signal: current.signal,
      }),
      backend('/api/underpasses/' + encodeURIComponent(id.value) + '/thresholds', {
        signal: current.signal,
      }),
    ])
    if (current.signal.aborted) return
    if (results[0]?.status === 'fulfilled') history.value = asPage<any>(results[0].value).items
    // 기준값은 그래프 눈금용이라 못 받아도 0·50·100 눈금으로 그린다
    thresholds.value = results[3]?.status === 'fulfilled' ? asPage<any>(results[3].value).items : []
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
      history.value = appendRiskHistory(history.value, data, 500)
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
  riskSplitChart(history.value, forecast.value, { left: 44, right: 650, top: 24, bottom: 186, now: chartNow.value }),
)
// 세로 눈금: 0·100 + 이 시설의 단계 기준값 (못 받으면 50)
const scoreTicks = computed(() => {
  const mins = thresholds.value.map((t) => Number(t.riskScoreMin)).filter((v) => v > 0 && v < 100)
  return [...new Set([0, ...(mins.length ? mins : [50]), 100])].sort((a, b) => a - b)
})
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
          <h1><AdminPageIcon />
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
              <h2>위험 점수 추이 · 최근 1시간 관측 | 3시간 예측</h2>
              <p v-if="series.latest" class="sub">지금 <b>{{series.latest.score.toFixed(1)}}점</b> <RiskLevelBadge v-if="facility" :value="facility.currentRiskLevel" /></p>
              <svg
                v-if="!series.empty"
                class="restored-risk-chart"
                viewBox="0 0 670 230"
                role="img"
                aria-label="최근 1시간 관측과 앞으로 3시간 예측 위험 점수"
              >
                <g v-for="score in scoreTicks" :key="'s'+score">
                  <line x1="44" x2="650" :y1="series.y(score)" :y2="series.y(score)" stroke="currentColor" stroke-opacity=".18" />
                  <text x="38" :y="series.y(score)+4" text-anchor="end" font-size="11" fill="currentColor">{{score}}</text>
                </g>
                <line :x1="series.mid" :x2="series.mid" y1="18" y2="186" stroke="currentColor" />
                <text :x="series.mid" y="13" text-anchor="middle" font-size="11" fill="currentColor">지금</text>
                <text
                  v-for="tick in series.ticks"
                  :key="tick.x"
                  :x="tick.x"
                  y="204"
                  text-anchor="middle"
                  font-size="12"
                  :font-weight="tick.now?700:400"
                  fill="currentColor"
                >{{tick.now?'지금 '+tick.label:tick.label}}</text>
                <text :x="(44+series.mid)/2" y="224" text-anchor="middle" font-size="11" fill="currentColor">최근 1시간 관측 · 1분 평균</text>
                <text :x="(series.mid+650)/2" y="224" text-anchor="middle" font-size="11" fill="currentColor">앞으로 3시간 예측</text>
                <path :d="series.observedPath" fill="none" stroke="#2b5c8a" stroke-width="3" />
                <path
                  v-if="series.forecastPath"
                  :d="series.forecastPath"
                  fill="none"
                  stroke="#2b5c8a"
                  stroke-width="2.5"
                  stroke-opacity=".7"
                  stroke-dasharray="8 5"
                />
                <g v-for="p in series.forecastPoints" :key="'f'+p.x">
                  <circle :cx="p.x" :cy="p.y" r="3" fill="#2b5c8a" fill-opacity=".7" />
                  <text :x="p.x" :y="p.y-8" text-anchor="middle" font-size="11" fill="currentColor">{{Math.round(p.score)}}</text>
                </g>
                <circle v-if="series.latest" :cx="series.latest.x" :cy="series.latest.y" r="5" fill="#2b5c8a" />
              </svg>
              <p v-else>조회된 위험도 관측 기록이 없습니다.</p>
              <p v-if="!series.empty" class="sub">실선: 최근 1시간 관측 · 점선: 향후 3시간 예측 (가운데 선이 지금)</p>
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
