<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '../stores/app'
import { useAdminProfile } from '../stores/adminProfile'
const route = useRoute(),
  router = useRouter(),
  app = useApp(),
  admin = useAdminProfile(),
  dialog = ref<HTMLDialogElement>(),
  message = ref('')
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
}
function close() {
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
  () => [route.fullPath, app.roleKey, app.authVersion],
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
  <dialog ref="dialog" class="admin-handover" aria-labelledby="admin-handover-title">
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
      <section class="handover-summary">
        <h3>직전 근무조 · 박○○</h3>
        <p>06:00~14:00</p>
        <dl>
          <div>
            <dt>통제</dt>
            <dd>1건</dd>
          </div>
          <div>
            <dt>위험 상승</dt>
            <dd>3건</dd>
          </div>
          <div>
            <dt>점검</dt>
            <dd>2건</dd>
          </div>
          <div>
            <dt>미처리 점검</dt>
            <dd>2건</dd>
          </div>
        </dl>
        <small>구성 예시 · 실제 근무 기록 연동 전입니다.</small>
      </section>
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
  </dialog>
</template>
<style scoped src="../styles/components/admin-handover.css"></style>
