<script setup lang="ts">
import {inject} from 'vue'
import {adminKey} from '../../shared/admin/main'
import UnifiedLogPanel from '../../shared/admin/components/UnifiedLogPanel.vue'
const {state}=inject(adminKey)!
</script>
<template><div v-if="state.profile?.role==='REGIONAL_ADMIN'" class="regional-workspace"><div class="su-heading"><h1>통합 로그</h1><p>{{ state.profile.regionName||'담당 지역 미지정' }} · 통제·위험 변화·알림·전광판 기록</p></div><UnifiedLogPanel/></div></template>
