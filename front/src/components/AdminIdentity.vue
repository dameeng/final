<script setup lang="ts">
import { useAdminProfile } from '../stores/adminProfile'
import { useApp } from '../stores/app'
import { computed } from 'vue'
const admin = useAdminProfile(),
  app = useApp(),
  name = computed(() =>
    app.account?.role === 'REGIONAL_ADMIN' ? app.account.name : admin.profile.name,
  )
</script>
<template>
  <RouterLink class="side-user" to="/admin-profile" aria-label="관리자 마이페이지로 이동"
    >{{name?`관리자 ${name}님`:'관리자님'}}</RouterLink
  >
</template>
