<script setup lang="ts">
import { useNotificationGlow } from '../stores/notificationGlow'
const notificationGlow = useNotificationGlow()
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useApp } from '../stores/app'
import { useCustomerNotifications, notificationCategory } from '../stores/customerNotifications'
import { useManagerNotifications } from '../stores/managerNotifications'
import { valueLabels } from '../data/backendResources'
import { useBackendEvents } from '../composables/useBackendEvents'
import { displayDate } from '../utils/display-date'
import { notificationTarget } from '../utils/notification-target'
import type { CustomerNotification } from '../stores/customerNotifications'
const emit = defineEmits<{ opened: [] }>()
const app = useApp(),
  route = useRoute(),
  router = useRouter(),
  customerNotifications = useCustomerNotifications(),
  managerNotifications = useManagerNotifications(),
  opened = ref(false),
  openingId = ref<number|null>(null),
  actionError = ref(''),
  button = ref<HTMLButtonElement>(),
  popup = ref<HTMLElement>(),
  position = ref({ top: '0px', left: '0px', width: '340px', maxHeight: '400px' })
const manager = computed(() => app.account?.role === 'REGIONAL_ADMIN')
const notifications = computed(() =>
  manager.value
    ? {
        recent: managerNotifications.recent,
        loading: managerNotifications.loading,
        error: managerNotifications.error,
        refresh: managerNotifications.refreshPreview,
        reset: managerNotifications.reset,
        ingest: managerNotifications.ingest,
        read: managerNotifications.read,
      }
    : customerNotifications,
)
const popupId = computed(() =>
  manager.value ? 'manager-notification-popup' : 'customer-notification-popup',
)
function categoryLabel(value: string) {
  return manager.value ? valueLabels[value] || '알림' : notificationCategory(value)
}
const historyPath = computed(() =>
  manager.value
    ? route.path.startsWith('/admin-app/')
      ? '/admin-app/notifications'
      : '/admin-data/manager-notifications'
    : route.path.startsWith('/customer-app/')
      ? '/customer-app/screen-12'
      : '/my-alerts',
)
function locate() {
  const rect = button.value?.getBoundingClientRect()
  if (!rect) return
  const shell = button.value?.closest<HTMLElement>('.service-app-layout,.manager-app-shell,.mobile-page .ph,.mobile-page')
  const bounds = shell?.getBoundingClientRect()
  const viewport = window.visualViewport
  const viewportLeft = viewport?.offsetLeft || 0
  const viewportTop = viewport?.offsetTop || 0
  const viewportRight = viewportLeft + (viewport?.width || innerWidth)
  const viewportBottom = viewportTop + (viewport?.height || innerHeight)
  const leftEdge = Math.max(viewportLeft, bounds?.left ?? viewportLeft) + 12
  const rightEdge = Math.min(viewportRight, bounds?.right ?? viewportRight) - 12
  const bottomEdge = Math.min(viewportBottom, bounds?.bottom ?? viewportBottom) - 12
  const width = Math.max(1, Math.min(360, rightEdge - leftEdge))
  const top = Math.max(viewportTop + 8, Math.min(rect.bottom + 8, bottomEdge - 120))
  position.value = {
    top: top + 'px',
    left: Math.max(leftEdge, Math.min(rect.right - width, rightEdge - width)) + 'px',
    width: width + 'px',
    maxHeight: Math.max(0, Math.min(420, bottomEdge - top)) + 'px',
  }
}
async function toggle() {
  actionError.value=''
  opened.value = !opened.value
  if (opened.value) {
    emit('opened')
    locate()
    void notifications.value.refresh()
    await nextTick()
    popup.value?.focus({ preventScroll: true })
  }
}
function target(item:CustomerNotification) {
  return notificationTarget(item,manager.value,route.path,historyPath.value)
}
async function openNotification(event:MouseEvent,item:CustomerNotification) {
  const modified=event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0
  if(!modified)event.preventDefault()
  if(openingId.value!==null)return
  const user=app.account?.id, role=app.account?.role, destination=target(item)
  openingId.value=item.id
  actionError.value=''
  try {
    if(!item.read)await notifications.value.read(item.id)
    if(app.account?.id!==user||app.account?.role!==role)return
    if(!modified) { close();await router.push(destination) }
  } catch(e) {
    actionError.value='알림을 읽음 처리하지 못했습니다. 다시 눌러주세요.'
  } finally { openingId.value=null }
}
function close(focus = false) {
  opened.value = false
  if (focus) button.value?.focus({ preventScroll: true })
}
function outside(event: PointerEvent) {
  if (!button.value?.contains(event.target as Node) && !popup.value?.contains(event.target as Node))
    close()
}
function escape(event: KeyboardEvent) {
  if (event.key === 'Escape' && opened.value) close(true)
}
function changed() {
  if (opened.value) locate()
}
watch(
  () => route.fullPath,
  () => close(),
)
watch(
  () => [app.account?.id, app.account?.role],
  () => {
    close()
    notifications.value.reset()
    if (app.account?.role === 'customer') void customerNotifications.refresh()
    else if (manager.value) void managerNotifications.refresh()
  },
  { immediate: true },
)
useBackendEvents(({ name, data }) => {
  if (name === 'connected' && (!manager.value || opened.value)) void notifications.value.refresh()
  else if (name === 'notification-new') notifications.value.ingest(data)
})
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', escape)
  window.addEventListener('resize', changed)
  window.addEventListener('scroll', changed, true)
  window.visualViewport?.addEventListener('resize', changed)
  window.visualViewport?.addEventListener('scroll', changed)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape)
  window.removeEventListener('resize', changed)
  window.removeEventListener('scroll', changed, true)
  window.visualViewport?.removeEventListener('resize', changed)
  window.visualViewport?.removeEventListener('scroll', changed)
})
</script>
<template>
  <span class="notification-bell">
    <button
      ref="button"
      type="button"
      class="header-alert-link"
      :class="{'notification-arrival-glow':notificationGlow.bell}"
      :aria-label="(manager?'관리자 알림':'알림')+(app.unread?' '+app.unread+'건':'')"
      :aria-expanded="opened"
      :aria-controls="popupId"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <UiIcon name="bell" />
      <span v-if="app.unread" class="header-alert-count" aria-hidden="true">
        {{app.unread>99?'99+':app.unread}}
      </span>
    </button>
    <Teleport to="body">
      <section
        v-if="opened"
        :id="popupId"
        ref="popup"
        class="customer-notification-popup"
        :style="position"
        tabindex="-1"
        role="dialog"
        aria-modal="false"
        aria-label="최근 알림"
      >
        <header>
          <h2>최근 알림 <small v-if="app.unread">{{app.unread}}건 안 읽음</small>
          </h2>
          <button class="ui-icon-button" type="button" aria-label="알림 창 닫기" @click="close(true)">
          <UiIcon name="close" />
        </button>
        </header>
        <div class="notification-popup-body">
          <p v-if="actionError" role="alert">{{actionError}}</p>
          <p v-if="notifications.loading" role="status">알림을 불러오는 중입니다.</p>
          <div v-else-if="notifications.error" role="alert">
            <p>{{notifications.error}}</p>
            <button type="button" @click="notifications.refresh">다시 불러오기</button>
          </div>
          <ul v-else-if="notifications.recent.length">
            <li v-for="item in notifications.recent" :key="item.id" :class="{unread:!item.read,'notification-arrival-glow':notificationGlow.has('notification',item.id)}">
              <RouterLink :to="target(item)" custom v-slot="{href}">
                <a :href="href" :aria-busy="openingId===item.id" @click="openNotification($event,item)">
                <span class="notification-popup-category">
                  {{categoryLabel(item.category)}}
                </span>
                <strong>{{item.title}}</strong>
                <span class="notification-popup-copy">{{item.body}}</span>
                <time>{{displayDate(item.createdAt)}}</time>
                </a>
              </RouterLink>
            </li>
          </ul>
          <p v-else>새 알림이 없습니다.</p>
        </div>
        <footer>
          <RouterLink :to="historyPath" @click="close()">알림 내역 전체 보기 →</RouterLink>
        </footer>
      </section>
    </Teleport>
  </span>
</template>
<style scoped src="../styles/components/notification-bell.css"></style>
