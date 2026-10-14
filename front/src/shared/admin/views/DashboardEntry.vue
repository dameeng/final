<script setup lang="ts">
import { inject } from 'vue'
import { adminKey } from '../main'
import DashboardView from './DashboardView.vue'
import SuperDashboardView from '../../../super-admin/views/SuperDashboardView.vue'
import RegionalDashboardView from '../../../regional-admin/views/RegionalDashboardView.vue'
const { state } = inject(adminKey)!
</script>
<template>
  <RegionalDashboardView v-if="state.profile?.role === 'REGIONAL_ADMIN'" />
  <SuperDashboardView v-else-if="state.profile?.role === 'SUPER_ADMIN'" />
  <DashboardView v-else />
</template>
