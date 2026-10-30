<script setup lang="ts">
import PmPendingBadge from './PmPendingBadge.vue'
import UiIcon from './UiIcon.vue'
import type { UiIconName } from '../utils/ui-icons'
import { useRoute } from 'vue-router'
import { adminSidebarGroups, sidebarLinkActive } from '../data/adminSidebar'
const route = useRoute()
withDefaults(defineProps<{ live?: boolean }>(), { live: false })
const groups = adminSidebarGroups
const groupIcons: Record<string, UiIconName> = {
  '지하차도 관리': 'map',
  '설비·점검 관리': 'tool',
  '차량 인식·통행': 'car',
  '재난 대응': 'shield',
  '고객 지원': 'chat',
  '운영 설정': 'settings',
}
</script>
<template>
  <RouterLink class="sidebar-home" to="/admin-dashboard"><span class="sidebar-heading-content"><UiIcon name="dashboard" />종합 현황</span></RouterLink>
  <nav class="admin-sidebar-groups" aria-label="관리자 주요 메뉴">
    <details
      v-for="group in groups"
      :key="group.title"
      class="sidebar-group"
      :open="group.links.some((link)=>sidebarLinkActive(link,route.path))||(group===groups[0]&&route.path==='/admin-dashboard')"
    >
      <summary class="sidebar-group-label"><span class="sidebar-heading-content"><UiIcon :name="groupIcons[group.title] || 'menu'" />{{group.title}}</span></summary>
      <template v-for="[label,preview,path] in group.links" :key="label">
        <RouterLink
          :to="preview||path!"
          :aria-current="sidebarLinkActive([label!,preview!,path!],route.path)?'page':undefined"
        >
          {{label}}
          <PmPendingBadge v-if="(preview||path)==='/pm-queue'" />
        </RouterLink>
      </template>
    </details>
  </nav>
</template>
