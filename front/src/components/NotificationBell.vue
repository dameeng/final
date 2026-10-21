<script setup lang="ts">
import { useNotificationGlow } from '../stores/notificationGlow'
const notificationGlow = useNotificationGlow()
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useApp } from '../stores/app'
import { useCustomerNotifications, notificationCategory } from '../stores/customerNotifications'
import { useManagerNotifications } from '../stores/managerNotifications'
import { valueLabels } from '../data/backendResources'
import { useBackendEvents } from '../composables/useBackendEvents'
import { displayDate } from '../utils/display-date'
const emit = defineEmits<{ opened: [] }>()
const app = useApp(),
  route = useRoute(),
  customerNotifications = useCustomerNotifications(),
  managerNotifications = useManagerNotifications(),
  opened = ref(false),
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
  const width = Math.min(360, innerWidth - 24),
    top = rect.bottom + 8
  position.value = {
    top: top + 'px',
    left: Math.max(12, Math.min(rect.right - width, innerWidth - width - 12)) + 'px',
    width: width + 'px',
    maxHeight: Math.max(120, Math.min(420, innerHeight - top - 12)) + 'px',
  }
}
async function toggle() {
  opened.value = !opened.value
  if (opened.value) {
    emit('opened')
    locate()
    void notifications.value.refresh()
    await nextTick()
    popup.value?.focus({ preventScroll: true })
  }
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
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape)
  window.removeEventListener('resize', changed)
  window.removeEventListener('scroll', changed, true)
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
          <p v-if="notifications.loading" role="status">알림을 불러오는 중입니다.</p>
          <div v-else-if="notifications.error" role="alert">
            <p>{{notifications.error}}</p>
            <button type="button" @click="notifications.refresh">다시 불러오기</button>
          </div>
          <ul v-else-if="notifications.recent.length">
            <li v-for="item in notifications.recent" :key="item.id" :class="{unread:!item.read,'notification-arrival-glow':notificationGlow.has('notification',item.id)}">
              <RouterLink :to="{path:historyPath,query:{notification:item.id}}" @click="close()">
                <span class="notification-popup-category">
                  {{categoryLabel(item.category)}}
                </span>
                <strong>{{item.title}}</strong>
                <span class="notification-popup-copy">{{item.body}}</span>
                <time>{{displayDate(item.createdAt)}}</time>
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
<style scoped>
.notification-bell {
  display: inline-flex;
  align-items: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
}
.notification-bell .header-alert-link {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 40px;
  min-width: 40px;
  max-width: 40px;
  height: 40px;
  min-height: 40px;
  max-height: 40px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.notification-bell .header-alert-link>svg {
  display: block;
  position: static;
  flex: 0 0 24px;
  width: 24px;
  min-width: 24px;
  max-width: 24px;
  height: 24px;
  min-height: 24px;
  max-height: 24px;
  transform: none;
}
.customer-notification-popup {
  position: fixed;
  z-index: 220;
  display: flex;
  flex-direction: column;
  background: var(--surface,#fff);
  color: var(--foreground,#20252b);
  border: 1px solid var(--line,#c9ced6);
  border-radius: 10px;
  box-shadow: 0 12px 36px #172a402b;
  overflow: hidden;
  font:
    14px/1.5 Arial,'Malgun Gothic',sans-serif;
}
.customer-notification-popup header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line,#c9ced6);
}
.customer-notification-popup h2 {
  margin: 0;
  font-size: 15px;
}
.customer-notification-popup h2 small {
  font-size: 11px;
  font-weight: 400;
  color: #64748b;
  margin-left: 6px;
}
.customer-notification-popup button {
  border: 1px solid var(--line);
  background: var(--surface);
  color: inherit;
  min-height: 32px;
  padding: 4px 10px;
  border-radius: 5px;
  cursor: pointer;
}
.customer-notification-popup header button {
  font-size: 22px;
  border: 0;
  padding: 0 6px;
}
.notification-popup-body {
  overflow: auto;
  min-height: 0;
}
.notification-popup-body>p,.notification-popup-body>[role=alert] {
  padding: 16px;
  margin: 0;
}
.notification-popup-body ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.notification-popup-body li+li {
  border-top: 1px solid var(--line);
}
.notification-popup-body a {
  display: grid;
  gap: 5px;
  padding: 14px 16px;
  color: inherit;
  text-decoration: none;
}
.notification-popup-body a:hover {
  background: #f2f6fa;
}
.notification-popup-body .unread a {
  background: #edf4fb;
}
.notification-popup-body strong {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.notification-popup-category {
  color: #225f9b;
  font-size: 11px;
}
.notification-popup-copy {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.notification-popup-body time {
  color: #64748b;
  font-size: 11px;
}
.customer-notification-popup footer {
  padding: 12px 16px;
  border-top: 1px solid var(--line);
}
.customer-notification-popup footer a {
  color: inherit;
  font-size: 12px;
  text-decoration: none;
}
</style>
