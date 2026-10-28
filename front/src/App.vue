<script setup lang="ts">
import './styles/customer-app-shell.css'
import './styles/notification-glow.css'
import { useNotificationGlow } from './stores/notificationGlow'
import { useBackendEvents } from './composables/useBackendEvents'
import { useBackendStream } from './composables/useBackendEvents'
import AdminAppNav from './components/AdminAppNav.vue'
import AdminAppHeader from './components/AdminAppHeader.vue'
import PwaStatus from './components/PwaStatus.vue'
import { watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { VNode } from 'vue'
import ServiceAppLayout from './components/ServiceAppLayout.vue'
import AdminAppFacilityLive from './pages/admin-app-facility-live.vue'
import AdminAppOverview from './pages/admin-app-overview.vue'
import ServiceAuth from './pages/service-auth.vue'
import ServiceNotifications from './pages/service-notifications.vue'
import ServiceAccount from './pages/service-account.vue'
import ServiceDashboard from './pages/service-dashboard.vue'
import AdminFacilityRestored from './pages/admin-facility-restored.vue'
import PmEquipmentLive from './pages/pm-equipment-live.vue'
import PmEquipmentDetailLive from './pages/pm-equipment-detail-live.vue'
import PmQueueLive from './pages/pm-queue-live.vue'
import PmHistoryLive from './pages/pm-history-live.vue'
import PmInspection from './pages/pm-inspection.vue'
import PmSettings from './pages/pm-settings-live.vue'
import PmDaily from './pages/pm-daily-live.vue'
import ServiceResource from './pages/backend-resource.vue'
import LiveMap from './pages/c-live-map.vue'
import { resourceRoutes } from './data/backendResources'
import AdminHandover from './components/AdminHandover.vue'
import ManagerUrgentAlert from './components/ManagerUrgentAlert.vue'
import DevicePushBridge from './components/DevicePushBridge.vue'
import CustomerHeader from './components/CustomerHeader.vue'
import CustomerArrivalAlert from './components/CustomerArrivalAlert.vue'
import CustomerFooter from './components/CustomerFooter.vue'
import MyPageLayout from './components/MyPageLayout.vue'
import CustomerPageLayout from './components/CustomerPageLayout.vue'
import PublicChatbot from './components/PublicChatbot.vue'
import CustomerRuGuide from './components/CustomerRuGuide.vue'
import { mobileInteractions } from './runtime/mobileInteractions'
import { useApp } from './stores/app'
import { useManagerNotifications } from './stores/managerNotifications'
import { useCustomerNotifications } from './stores/customerNotifications'
import { restoreManager } from './services/managerSession'
useBackendStream()
const app = useApp()
const managerNotifications = useManagerNotifications()
const customerNotifications = useCustomerNotifications()
const notificationGlow = useNotificationGlow()
watch(() => [app.account?.id, app.account?.role], () => notificationGlow.reset())
useBackendEvents(({ name, data }) => {
  if (name === 'notification-new') notificationGlow.mark('notification', data.id)
  if (name === 'notice-new') notificationGlow.mark('notice', data.id ?? data.noticeId)
  if (name === 'inquiry-new') notificationGlow.mark('inquiry', data.id ?? data.inquiryId)
  // 읽음 동기화는 새 알림이 아니라서 glow·토스트를 표시하지 않는다
  if (name === 'notification-read-change') {
    managerNotifications.applyReadChange(data)
    customerNotifications.applyReadChange(data)
  }
  // 담당 지역·근무조가 바뀌면 내 정보를 다시 받는다. 지역이 바뀌면 SSE 연결도 새 지역으로 다시 맺는다.
  if (name === 'manager-assignment-change')
    void restoreManager().then(() => managerNotifications.refresh())
})
watch(
  () => app.theme,
  (t) => (document.documentElement.dataset.theme = t),
  { immediate: true },
)
const route = useRoute(),
  router = useRouter()
const customer = computed(
  () =>
    !route.path.startsWith('/customer-app/') &&
    (route.path === '/' ||
      /^\/(?:c-|info\/|my-|login|signup|password-reset|find-id)/.test(route.path)),
)
watch(
  () => route.path,
  (path) => {
    if (!/^\/(admin|customer)-app\//.test(path)) return
    const kind = path.startsWith('/admin-app/') ? 'admin' : 'customer'
    const manifest = document.querySelector<HTMLLinkElement>('#app-manifest'),
      icon = document.querySelector<HTMLLinkElement>('#app-touch-icon')
    if (manifest) manifest.href = `/${kind}.webmanifest`
    if (icon) icon.href = `/icons/${kind}-ru-180-v1.png`
  },
  { immediate: true },
)
const serviceComponent = computed(() => {
  const path = route.path
  if (['/my-alerts', '/customer-app/screen-12'].includes(path)) return ServiceNotifications
  if (
    [
      '/c-auth',
      '/admin-login',
      '/admin-signup',
      '/admin-password-reset',
      '/login',
      '/signup',
      '/password-reset',
      '/admin-app/screen-1',
      '/customer-app/screen-1',
      '/customer-app/screen-2',
      '/customer-app/screen-3',
      '/customer-app/screen-4',
      '/customer-app/password-reset',
      '/admin-app/signup',
      '/admin-app/password-reset',
    ].includes(path)
  )
    return ServiceAuth
  if (['/c-notice', '/info/faq', '/customer-app/notices', '/customer-app/faq'].includes(path))
    return ServiceResource
  if (['/c-map', '/customer-app/screen-5', '/customer-app/screen-6'].includes(path)) return LiveMap
  if (path === '/fac-detail') return AdminFacilityRestored
  if (['/pm-equipment', '/admin-app/screen-9'].includes(path)) return PmEquipmentLive
  if (['/pm-equipment-detail', '/admin-app/screen-10'].includes(path)) return PmEquipmentDetailLive
  if (['/pm-queue', '/admin-app/screen-11'].includes(path)) return PmQueueLive
  if (['/pm-history', '/admin-app/history'].includes(path)) return PmHistoryLive
  if (['/pm-inspection', '/admin-app/inspection'].includes(path)) return PmInspection
  if (['/pm-settings', '/admin-app/pm-settings'].includes(path)) return PmSettings
  if (['/pm-daily', '/admin-app/pm-daily'].includes(path)) return PmDaily
  // screen-6(통제)·7(통제 중)·8(해제)은 시설 0번 고정 목업이었다. 실제 통제·해제 API를 쓰는 시설 화면으로 보낸다
  if (['/admin-app/screen-5', '/admin-app/screen-6', '/admin-app/screen-7', '/admin-app/screen-8'].includes(path))
    return AdminAppFacilityLive
  if (path === '/admin-app/screen-3') return AdminAppOverview
  if (path === '/admin-dashboard') return ServiceDashboard
  if (
    ['/admin-profile', '/admin-app/screen-14', '/my-home', '/my-account', '/my-withdraw'].includes(
      path,
    ) ||
    /^\/customer-app\/account\/(profile|emergency|cars|settings|withdraw)$/.test(path)
  )
    return ServiceAccount
  if (
    resourceRoutes[path] ||
    path.startsWith('/admin-data/') ||
    /^\/admin-app\/(ocr|reviews|transits)$/.test(path)
  )
    return ServiceResource
  return null
})
const managerApp = computed(
  () =>
    route.path.startsWith('/admin-app/') &&
    !['/admin-app/screen-1', '/admin-app/signup', '/admin-app/password-reset'].includes(route.path),
)
const appService = computed(
  () => !!serviceComponent.value && /^\/(admin|customer)-app\//.test(route.path),
)
const cleanups = new Map<HTMLElement, () => void>()
function mounted(vnode: VNode) {
  const el = vnode.el as HTMLElement
  if (
    !serviceComponent.value &&
    (route.path.startsWith('/customer-app/') || route.path.startsWith('/admin-app/'))
  )
    cleanups.set(el, mobileInteractions(el, route.path, router, app))
}
function unmounted(vnode: VNode) {
  const el = vnode.el as HTMLElement
  cleanups.get(el)?.()
  cleanups.delete(el)
}
</script>
<template>
  <div
    :class="{'admin-interface':!customer&&!route.path.startsWith('/customer-app/'),'manager-app-shell':managerApp,'customer-shell':customer,'customer-editorial':customer&&!['/c-map','/c-live-map'].includes(route.path),'customer-app-editorial':route.path.startsWith('/customer-app/')&&!['/customer-app/screen-5','/customer-app/screen-6'].includes(route.path),'service-mobile':appService,'admin-shell':!customer&&!route.path.startsWith('/admin-app/')&&!route.path.startsWith('/customer-app/')}"
  >
    <AdminAppHeader v-if="managerApp&&route.path!=='/admin-app/menu'" />
    <PwaStatus :hide-install="managerApp" v-if="/^\/(admin|customer)-app\//.test(route.path)" />
    <AdminHandover v-if="app.account?.role==='REGIONAL_ADMIN'" />
    <ManagerUrgentAlert v-if="app.account?.role==='REGIONAL_ADMIN'" />
    <CustomerHeader v-if="customer" />
    <CustomerArrivalAlert />
    <DevicePushBridge />
    <RouterView v-slot="{Component}">
      <CustomerPageLayout v-if="customer">
        <MyPageLayout v-if="route.path.startsWith('/my-')">
          <component
            :is="serviceComponent||Component"
            :key="$route.path"
            @vue:mounted="mounted"
            @vue:unmounted="unmounted"
          />
        </MyPageLayout>
        <component
          v-else
          :is="serviceComponent||Component"
          :key="$route.path"
          @vue:mounted="mounted"
          @vue:unmounted="unmounted"
        />
      </CustomerPageLayout>
      <ServiceAppLayout v-else-if="appService">
        <component :is="serviceComponent" :key="$route.path" />
      </ServiceAppLayout>
      <component
        v-else
        :is="serviceComponent||Component"
        :key="$route.path"
        @vue:mounted="mounted"
        @vue:unmounted="unmounted"
      />
    </RouterView>
    <AdminAppNav v-if="managerApp&&route.path!=='/admin-app/menu'" />
    <CustomerFooter v-if="customer" />
    <PublicChatbot v-if="customer||route.path.startsWith('/customer-app/')" />
    <CustomerRuGuide :key="managerApp?'manager-guide':'customer-guide'" :manager="managerApp" />
  </div>
</template>
