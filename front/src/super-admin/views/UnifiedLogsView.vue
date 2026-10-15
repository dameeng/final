<script setup lang="ts">
import {inject} from 'vue'
import {adminKey} from '../../shared/admin/main'
import UnifiedLogPanel from '../components/UnifiedLogPanel.vue'
const {state}=inject(adminKey)!
</script>
<template><div v-if="state.profile?.role==='SUPER_ADMIN'" class="super-workspace"><div class="su-heading"><h1>통합 로그</h1><p>통제·해제, 위험 변화, 알림 발송과 전광판 기록을 한곳에서 조회합니다.</p></div><UnifiedLogPanel/></div></template>
