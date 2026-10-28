<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '../stores/app'
import { useAdminProfile } from '../stores/adminProfile'
import { backend } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'
import type { Handover } from '../services/handover'
import HandoverSummary from './HandoverSummary.vue'
const route = useRoute(),
  router = useRouter(),
  app = useApp(),
  admin = useAdminProfile(),
  dialog = ref<HTMLDialogElement>(),
  message = ref('')
const report = ref<Handover | null>(null), loading = ref(false)
let request: AbortController | undefined
async function load() {
  request?.abort(); const current = new AbortController(); request = current
  loading.value = true; message.value = ''; report.value = null
  try { const result = await backend<Handover | null>('/api/shift-handovers/previous', { signal: current.signal }); if (!current.signal.aborted) report.value = result }
  catch (e) { if (!current.signal.aborted) message.value = (e as Error).message }
  finally { if (!current.signal.aborted) loading.value = false }
}
// 근무조·담당 지역이 바뀌면 열려 있는 팝업의 이전 근무자 정보를 다시 조회한다
useBackendEvents(({ name }) => {
  if (name === 'manager-assignment-change' && dialog.value?.open) void load()
})
const name = computed(() =>
  app.account?.role === 'REGIONAL_ADMIN' ? app.account.name : admin.profile.name,
)
const region = computed(() =>
  app.account?.role === 'REGIONAL_ADMIN'
    ? app.account.regions?.map((region) => region.name).join(' · ') || '담당 지역 미지정'
    : admin.region,
)
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
const hiddenKey = () => `routel-handover-hide:${app.roleKey}`
const seenKey = () => `routel-handover-seen:${app.roleKey}:${app.authVersion}`
function isHidden() {
  try {
    return localStorage.getItem(hiddenKey()) === today()
  } catch {
    return false
  }
}
function hasSeen() {
  try {
    return sessionStorage.getItem(seenKey()) === today()
  } catch {
    return false
  }
}
function markSeen() {
  try {
    sessionStorage.setItem(seenKey(), today())
  } catch {}
}
async function open(manual = false) {
  if (!manual && localStorage.getItem('routel-session-kind') === 'manager' && !app.account) return
  if (!manual && (isHidden() || hasSeen())) return
  await nextTick()
  if (!dialog.value || dialog.value.open) return
  message.value = ''
  dialog.value.showModal()
  markSeen()
  void load()
}
function close() {
  request?.abort()
  dialog.value?.close()
}
function hideToday() {
  try {
    localStorage.setItem(hiddenKey(), today())
    close()
  } catch {
    message.value = '설정을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'
  }
}
function navigate(path: string) {
  close()
  void router.push(path)
}
function manualOpen() {
  void open(true)
}
const stop = watch(
  [() => route.path+JSON.stringify(Object.entries(route.query).filter(([key])=>key!=='__view')), () => app.roleKey, () => app.authVersion],
  () => {
    close()
    if (route.path === '/admin-dashboard') void open()
  },
  { flush: 'post' },
)
onMounted(() => {
  window.addEventListener('routel:open-handover', manualOpen)
  if (route.path === '/admin-dashboard') void open()
})
onBeforeUnmount(() => {
  stop()
  window.removeEventListener('routel:open-handover', manualOpen)
  close()
})
</script>
<template>
  <WorkflowPage ref="dialog" class="admin-handover" aria-labelledby="admin-handover-title">
    <header>
      <div>
        <p>{{region}} · 근무 인수인계</p>
        <h2 id="admin-handover-title">이전 근무 인수인계</h2>
      </div>
      <button type="button" class="ui-icon-button handover-x" aria-label="인수인계 창 닫기" @click="close">
          <UiIcon name="close" />
        </button>
    </header>
    <div class="handover-body">
      <p>{{name}}님, 직전 근무조의 기록을 확인해 주세요.</p>
      <p v-if="loading" role="status">직전 근무 기록을 불러오는 중입니다.</p>
      <HandoverSummary v-else-if="report" :report="report" />
      <p v-else-if="!message">직전 근무 기록이 없습니다.</p>
      <button v-if="message" type="button" @click="load">다시 불러오기</button>
      <div class="handover-links">
        <button type="button" @click="navigate('/shift-report')">데일리 리포트 · PDF 보기 →</button>
        <button type="button" @click="navigate('/pm-queue?pending=1')">미처리 점검 대상 보기 →</button>
      </div>
      <p v-if="message" role="status">{{message}}</p>
    </div>
    <footer>
      <button type="button" @click="hideToday">오늘 하루 안 보기</button>
      <button type="button" class="handover-primary" @click="close">확인하고 닫기</button>
    </footer>
  </WorkflowPage>
</template>
<style scoped src="../styles/components/admin-handover.css"></style>
