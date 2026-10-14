<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { adminApi, type Camera } from '../shared/admin/services/admin-api'

// ---- 시연 고정값 ----
const UNDERPASS_ID = 17
const CAMERA_ID = 1
const TARGET_CAR_NUM = '58조3904'

const ALERT_LOG_REFRESH_MS = 300
const ALERT_WAIT_TIMEOUT_MS = 90000

type AlertType = 'PREDICTIVE' | 'ROI_FINAL'
type AlertItem = {
  id: number; eventId: number; underpassId: number; customerId: number
  carId: number; carNum: string; alertType: AlertType; sentAt: string
}
type UnderpassDetail = {
  id: number; name: string
  currentStatus: 'NORMAL' | 'BLOCKED'
  currentRiskLevel: 'SAFE' | 'WARNING' | 'DANGER'
}

type Phase = 'idle' | 'approach-running' | 'approach-done' | 'blocking' | 'roi-running' | 'roi-done'

const roleLabels: Record<Camera['cameraRole'], string> = {
  CCTV: '일반 CCTV', APPROACH_LPR: '접근 · APPROACH', ROI_LPR: '진입 직전 · ROI',
}
const riskLabels: Record<UnderpassDetail['currentRiskLevel'], string> = {
  SAFE: '안전', WARNING: '경고', DANGER: '위험',
}
const statusLabels: Record<UnderpassDetail['currentStatus'], string> = {
  NORMAL: '정상', BLOCKED: '차단',
}

const camera = ref<Camera | null>(null)
const underpass = ref<UnderpassDetail | null>(null)
const loadingInfo = ref(false)
const infoError = ref('')

const phase = ref<Phase>('idle')
const stepBusy = ref(false)
const feedback = ref('')

const playing = ref(false)
const startedAt = ref(0)
const imgFailed = ref(false)

const approachAlert = ref<AlertItem | null>(null)
const roiAlert = ref<AlertItem | null>(null)
const liveLog = ref<AlertItem[]>([])
// "시작"을 눌러 영상을 튼 시점(ms). 그 이전에 찍힌 알림은 화면/로그에 보여주지 않는다.
const sessionStartedAt = ref<number | null>(null)

const alertTypeLabels: Record<AlertType, string> = { PREDICTIVE: '접근 예측', ROI_FINAL: 'ROI 최종' }
const justArrived = ref(false)

// 알림 도착 시 "띵" 효과음 (에셋 없이 Web Audio API로 짧은 비프음 생성)
function ding() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    osc.connect(gain); gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch { /* 자동재생 제한 등으로 실패해도 무시 */ }
}
function notify() {
  ding()
  justArrived.value = true
  setTimeout(() => { justArrived.value = false }, 700)
}

let cancelToken = { cancelled: false }
let logPollTimer: ReturnType<typeof setInterval> | null = null
let logPollBusy = false

const isAiStream = computed(() => !!camera.value?.streamUrl && camera.value.streamUrl.startsWith('/ai/stream/'))
const streamSrc = computed(() => {
  const url = camera.value?.streamUrl
  if (!url) return ''
  return url + (url.includes('?') ? '&' : '?') + 't=' + startedAt.value
})

const time = (v: string) => v ? new Date(v).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '—'

// 영상을 튼 시점 이후에 찍힌 알림만 로그에 노출
const visibleLog = computed(() => {
  if (sessionStartedAt.value == null) return []
  const threshold = sessionStartedAt.value
  return liveLog.value.filter(a => (Date.parse(a.sentAt) || 0) >= threshold)
})

function messageFor(alert: AlertItem) {
  const name = underpass.value?.name ?? `지하차도 #${UNDERPASS_ID}`
  if (alert.alertType === 'PREDICTIVE') {
    return `[긴급재난문자] ${name} 접근 차량이 감지되었습니다. 차량번호 ${alert.carNum}, 현재 위험 단계이니 우회를 권장합니다.`
  }
  return `[긴급재난문자] ${name} 진입 직전입니다. 현재 통제 중인 구간이니 즉시 정차 후 우회하세요. (차량번호 ${alert.carNum})`
}

// ---- 조회 ----
async function loadInfo() {
  loadingInfo.value = true; infoError.value = ''
  try {
    const [cameras, detail, log] = await Promise.all([
      adminApi<Camera[]>(`/underpasses/${UNDERPASS_ID}/cameras`),
      adminApi<UnderpassDetail>(`/underpasses/${UNDERPASS_ID}`),
      fetchAlertList(),
    ])
    camera.value = cameras.find(c => c.id === CAMERA_ID) ?? null
    underpass.value = detail
    liveLog.value = log
    if (!camera.value) infoError.value = `카메라 #${CAMERA_ID}을 찾을 수 없습니다.`
  } catch (e) {
    infoError.value = e instanceof Error ? e.message : '지하차도/카메라 정보를 불러오지 못했습니다.'
  } finally {
    loadingInfo.value = false
  }
}

// ---- AI 인식 서비스 제어 ----
async function setAiRunning(run: boolean) {
  const response = await fetch(`/ai/control/plate/${run ? 'start' : 'stop'}`, { method: 'POST', keepalive: !run })
  if (!response.ok) throw new Error('번호판 인식 서비스에 연결하지 못했습니다.')
  const result = await response.json()
  playing.value = result.running === true
  if (run) {
    if (!playing.value) throw new Error('인식 서비스가 시작되지 않았습니다. 다시 시도해 주세요.')
    startedAt.value = Date.now()
    imgFailed.value = false
  }
}

// ---- 알림 폴링 (실시간 로그 패널은 0.3초 간격 백그라운드 폴러가 계속 갱신) ----
async function fetchAlertList(): Promise<AlertItem[]> {
  const result = await adminApi<{ items: AlertItem[] }>(
    `/alert-logs?underpassId=${UNDERPASS_ID}&keyword=${encodeURIComponent(TARGET_CAR_NUM)}&page=1&size=20`
  )
  return [...result.items].sort((a, b) => (Date.parse(b.sentAt) || 0) - (Date.parse(a.sentAt) || 0) || b.id - a.id)
}

// phase/step 과 무관하게 항상 돌면서 liveLog 를 최신 상태로 유지
async function refreshLiveLog() {
  if (logPollBusy) return
  logPollBusy = true
  try {
    liveLog.value = await fetchAlertList()
  } catch {
    // 일시적인 조회 실패는 다음 틱에서 재시도하므로 무시
  } finally {
    logPollBusy = false
  }
}

function startLogPolling() {
  if (logPollTimer) return
  logPollTimer = setInterval(refreshLiveLog, ALERT_LOG_REFRESH_MS)
}
function stopLogPolling() {
  if (logPollTimer) { clearInterval(logPollTimer); logPollTimer = null }
}

// 백그라운드 폴러가 이미 0.3초 간격으로 liveLog 를 갱신하고 있으므로,
// 여기서는 그 결과(liveLog.value)를 짧은 간격으로 확인만 한다 (중복 API 호출 방지)
async function waitForNewAlert(alertType: AlertType, excludeId: number | null, token: { cancelled: boolean }): Promise<AlertItem> {
  const deadline = Date.now() + ALERT_WAIT_TIMEOUT_MS
  const threshold = sessionStartedAt.value ?? 0
  while (Date.now() < deadline) {
    if (token.cancelled) throw new Error('중단되었습니다.')
    const found = liveLog.value.find(a =>
      a.alertType === alertType && a.carNum === TARGET_CAR_NUM && a.id !== excludeId && (Date.parse(a.sentAt) || 0) >= threshold
    ) ?? null
    if (found) return found
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('알림이 도착하지 않았습니다. 위험도/차단 상태 조건과 번호판 인식 여부를 확인해 주세요.')
}

// ---- 1단계: 접근 알림 ----
async function runApproach() {
  if (stepBusy.value || !camera.value) return
  stepBusy.value = true; feedback.value = ''; phase.value = 'approach-running'
  const token = (cancelToken = { cancelled: false })
  sessionStartedAt.value = Date.now() // 영상을 트는 시점 — 이보다 이전 알림은 보여주지 않는다
  try {
    const beforeId = liveLog.value.find(a => a.alertType === 'PREDICTIVE')?.id ?? null
    await setAiRunning(true)
    const found = await waitForNewAlert('PREDICTIVE', beforeId, token)
    if (token.cancelled) return
    approachAlert.value = found
    notify()
    // 영상은 계속 틀어둔 채로 다음 단계("다음" 버튼)를 누를 수 있게 둔다
    phase.value = 'approach-done'
  } catch (e) {
    if (!token.cancelled) {
      feedback.value = e instanceof Error ? e.message : '접근 알림 처리 중 오류가 발생했습니다.'
      phase.value = 'idle'
      await setAiRunning(false).catch(() => {})
    }
  } finally {
    if (!token.cancelled) stepBusy.value = false
  }
}

// ---- 2단계: 차단 + ROI 최종 알림 ----
async function runRoi() {
  if (stepBusy.value || !camera.value) return
  stepBusy.value = true; feedback.value = ''; phase.value = 'blocking'
  const token = (cancelToken = { cancelled: false })
  try {
    await setAiRunning(false).catch(() => {}) // 접근 단계 영상부터 정지하고 ROI용으로 다시 시작
    await adminApi(`/underpasses/${UNDERPASS_ID}/block`, { method: 'POST' }).catch(e => {
      // 이미 차단된 상태면 무시하고 계속 진행
      if (!/차단/.test(e instanceof Error ? e.message : '')) throw e
    })
    await loadInfo()

    const updated = await adminApi<Camera>(`/underpasses/${UNDERPASS_ID}/cameras/${CAMERA_ID}`, {
      method: 'PUT',
      body: JSON.stringify({
        cameraRole: 'ROI_LPR',
        streamUrl: camera.value.streamUrl,
        distanceM: camera.value.distanceM,
        latitude: camera.value.latitude,
        longitude: camera.value.longitude,
      }),
    })
    camera.value = updated

    phase.value = 'roi-running'
    const beforeId = liveLog.value.find(a => a.alertType === 'ROI_FINAL')?.id ?? null
    await setAiRunning(true)
    const found = await waitForNewAlert('ROI_FINAL', beforeId, token)
    if (token.cancelled) return
    roiAlert.value = found
    notify()
    // 영상은 계속 틀어둔 채로 둔다 (초기화할 때 정지)
    phase.value = 'roi-done'
  } catch (e) {
    if (!token.cancelled) {
      feedback.value = e instanceof Error ? e.message : 'ROI 최종 알림 처리 중 오류가 발생했습니다.'
      phase.value = 'approach-done'
      await setAiRunning(false).catch(() => {})
    }
  } finally {
    if (!token.cancelled) stepBusy.value = false
  }
}

// ---- 초기화 ----
async function reset() {
  cancelToken.cancelled = true
  stepBusy.value = true; feedback.value = ''
  try {
    await setAiRunning(false).catch(() => {})
    await adminApi(`/underpasses/${UNDERPASS_ID}/release`, { method: 'POST' }).catch(() => {})
    if (camera.value) {
      await adminApi(`/underpasses/${UNDERPASS_ID}/cameras/${CAMERA_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
          cameraRole: 'APPROACH_LPR',
          streamUrl: camera.value.streamUrl,
          distanceM: camera.value.distanceM,
          latitude: camera.value.latitude,
          longitude: camera.value.longitude,
        }),
      }).catch(() => {})
    }
  } finally {
    phase.value = 'idle'
    approachAlert.value = null
    roiAlert.value = null
    sessionStartedAt.value = null
    stepBusy.value = false
    await loadInfo()
  }
}

onMounted(() => {
  void loadInfo()
  startLogPolling()
})
onBeforeUnmount(() => {
  cancelToken.cancelled = true
  stopLogPolling()
  if (playing.value) void fetch('/ai/control/plate/stop', { method: 'POST', keepalive: true }).catch(() => {})
})
</script>

<template>
  <div class="demo-page">
    <header class="demo-header">
      <h1>PUF 시연 — 접근 알림 → 차단 → ROI 최종 알림</h1>
      <ol class="demo-steps">
        <li :class="{ active: phase === 'idle', done: phase !== 'idle' }">① 접근 카메라 알림</li>
        <li :class="{ active: phase === 'approach-running', done: ['approach-done','blocking','roi-running','roi-done'].includes(phase) }">② 고객 앱 알림(접근)</li>
        <li :class="{ active: phase === 'blocking', done: ['roi-running','roi-done'].includes(phase) }">③ 지하차도 차단</li>
        <li :class="{ active: phase === 'roi-running', done: phase === 'roi-done' }">④ ROI 최종 알림 · 고객 앱</li>
      </ol>
    </header>

    <p v-if="feedback" class="demo-feedback" role="alert">{{ feedback }}</p>
    <p v-if="infoError" class="demo-feedback" role="alert">{{ infoError }}</p>

    <section class="demo-card demo-controlbar">
      <dl class="demo-status-list">
        <div><dt>현재 상태</dt><dd :class="'status-' + (underpass?.currentStatus ?? '')">{{ underpass ? statusLabels[underpass.currentStatus] : '—' }}</dd></div>
        <div><dt>위험도</dt><dd :class="'risk-' + (underpass?.currentRiskLevel ?? '')">{{ underpass ? riskLabels[underpass.currentRiskLevel] : '—' }}</dd></div>
        <div><dt>카메라 #{{ CAMERA_ID }} 역할</dt><dd v-if="camera" class="demo-badge" :class="'role-' + camera.cameraRole">{{ roleLabels[camera.cameraRole] }}</dd></div>
      </dl>
      <div class="demo-actions demo-actions-row">
        <button type="button" class="demo-btn demo-btn-primary"
                :disabled="stepBusy || phase !== 'idle' || !camera"
                @click="runApproach">
          {{ phase === 'approach-running' ? '접근 알림 대기 중…' : '시작' }}
        </button>
        <button type="button" class="demo-btn demo-btn-primary"
                :disabled="stepBusy || phase !== 'approach-done'"
                @click="runRoi">
          {{ phase === 'blocking' ? '차단 처리 중…' : phase === 'roi-running' ? 'ROI 알림 대기 중…' : '다음' }}
        </button>
        <button type="button" class="demo-btn demo-btn-ghost" :disabled="stepBusy && phase === 'idle'" @click="reset">초기화</button>
      </div>
    </section>

    <div class="demo-triple-grid">
      <section class="demo-card demo-video-card">
        <div class="demo-card-heading"><h2>카메라 #{{ CAMERA_ID }} · 지하차도 #{{ UNDERPASS_ID }}</h2></div>
        <div class="demo-screen">
          <template v-if="camera && isAiStream">
            <img v-if="playing && !imgFailed" :key="startedAt" :src="streamSrc" alt="실시간 번호판 인식 영상" @error="imgFailed = true" />
            <p v-else class="demo-screen-caption">{{ imgFailed ? '영상 연결을 확인해 주세요.' : loadingInfo ? '카메라 정보를 불러오는 중…' : '대기 중' }}</p>
          </template>
          <template v-else-if="camera && camera.streamUrl">
            <video :src="camera.streamUrl" controls autoplay muted playsinline preload="metadata" />
          </template>
          <p v-else class="demo-screen-caption">{{ loadingInfo ? '카메라 정보를 불러오는 중…' : '등록된 영상 주소가 없습니다.' }}</p>
        </div>
        <p class="demo-screen-status" role="status">{{ playing ? '번호판 인식 중…' : '' }}</p>
      </section>

      <section class="demo-card demo-log-card">
        <div class="demo-card-heading"><h2>실시간 알림 발송 로그</h2></div>
        <ul class="demo-log-list">
          <li v-for="a in visibleLog" :key="a.id" class="demo-log-row">
            <span class="demo-log-badge" :class="'type-' + a.alertType">{{ alertTypeLabels[a.alertType] }}</span>
            <strong>{{ a.carNum }}</strong>
            <span class="demo-log-time">{{ time(a.sentAt) }}</span>
          </li>
        </ul>
        <p v-if="!visibleLog.length" class="demo-screen-caption">{{ stepBusy ? '인식 결과를 기다리는 중…' : sessionStartedAt == null ? '시작을 누르면 알림이 쌓입니다.' : '발송된 알림이 없습니다.' }}</p>
      </section>

      <section class="demo-card demo-phone-card">
        <div class="demo-card-heading"><h2>차량 {{ TARGET_CAR_NUM }} 알림</h2></div>
        <div class="demo-phone-crop" :class="{ 'is-ringing': justArrived }">
          <div class="demo-phone">
            <div class="demo-phone-screen">
              <p v-if="!approachAlert && !roiAlert" class="demo-phone-empty">수신된 알림이 없습니다.</p>
              <transition-group name="demo-alert" tag="div" class="demo-phone-messages">
                <article v-if="approachAlert" key="approach" class="demo-sms demo-sms-predictive">
                  <p class="demo-sms-text">{{ messageFor(approachAlert) }}</p>
                  <time class="demo-sms-time">{{ time(approachAlert.sentAt) }}</time>
                </article>
                <article v-if="roiAlert" key="roi" class="demo-sms demo-sms-roi">
                  <p class="demo-sms-text">{{ messageFor(roiAlert) }}</p>
                  <time class="demo-sms-time">{{ time(roiAlert.sentAt) }}</time>
                </article>
              </transition-group>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped src="./demo-theme.css"></style>
<style scoped>
.demo-controlbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.demo-actions-row { flex-direction: row; }
.demo-actions-row .demo-btn { width: auto; }

.demo-triple-grid { display: grid; grid-template-columns: 1.1fr 1fr 0.9fr; gap: 20px; align-items: stretch; }
@media (max-width: 1100px) { .demo-triple-grid { grid-template-columns: 1fr; } }

.demo-phone-card { display: flex; flex-direction: column; align-items: center; }

/* 휴대폰 윗부분만 보이도록 잘라서 보여주는 틀. 카드 높이(= CCTV 카드 높이)만큼 채우고, 아래쪽은 자연스럽게 사라진다 */
.demo-phone-crop {
  box-sizing: border-box;
  width: 100%; max-width: 280px; flex: 1 1 auto; min-height: 280px;
  overflow: hidden; position: relative; border-radius: 22px 22px 0 0;
  transition: box-shadow .2s ease;
}
.demo-phone {
  box-sizing: border-box;
  width: 100%; height: 100%; border: 8px solid #111827; border-bottom: none; border-radius: 22px 22px 0 0; background: #111827;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
  display: flex; flex-direction: column;
  /* 모서리는 깔끔하게 남기고, 아래쪽으로 갈수록 투명해지며 잘려서 자연스럽게 사라진다 */
  mask-image: linear-gradient(to bottom, #000 0%, #000 78%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 78%, transparent 100%);
}
.demo-phone-crop.is-ringing { box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.25); animation: demo-ring .5s ease; }
@keyframes demo-ring {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-4px); }
  50% { transform: translateY(0); }
  75% { transform: translateY(-2px); }
}
.demo-phone-screen {
  flex: 1 1 auto; min-height: 0; overflow-y: auto;
  background: #fff; border-radius: 14px 14px 0 0; padding: 16px 14px 14px; display: flex; flex-direction: column; gap: 10px;
}
.demo-phone-empty { color: var(--muted); font-size: 13px; text-align: center; margin-top: 40px; }
.demo-phone-messages { display: flex; flex-direction: column; gap: 10px; }
.demo-sms { border-radius: 14px; padding: 12px 14px; color: #fff; }
.demo-sms-predictive { background: linear-gradient(135deg, #f59e0b, #d97706); }
.demo-sms-roi { background: linear-gradient(135deg, #ef4444, #b91c1c); }
.demo-sms-text { margin: 0 0 6px; font-size: 13px; font-weight: 600; line-height: 1.5; }
.demo-sms-time { font-size: 11px; opacity: .85; }

.demo-alert-enter-active { transition: opacity .3s ease, transform .3s ease; }
.demo-alert-enter-from { opacity: 0; transform: translateY(8px); }

.demo-log-heading { margin-top: 18px; }
.demo-log-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; }
.demo-log-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: #f8fafc; font-size: 13px; }
.demo-log-badge { padding: 2px 10px; border-radius: 999px; font-weight: 700; font-size: 11px; }
.demo-log-badge.type-PREDICTIVE { background: #fef3c7; color: var(--warning); }
.demo-log-badge.type-ROI_FINAL { background: #fee2e2; color: var(--danger); }
.demo-log-time { color: var(--muted); margin-left: auto; }
</style>