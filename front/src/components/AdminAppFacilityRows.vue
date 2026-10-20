<script setup lang="ts">
import {valueLabels} from '../data/backendResources'
defineProps<{items:Record<string,any>[]}>()
</script>
<template><div class="app-facility-rows"><RouterLink v-for="row in items" :key="row.id" :to="'/admin-app/screen-5?id='+row.id"><div class="g"><b>{{row.name}}</b><small>{{row.currentStatus==='BLOCKED'?'통제 중':'정상 운영'}} · 차량 {{row.remainingCount??'—'}}대</small></div><span class="lv" :class="row.currentRiskLevel==='DANGER'?'d':row.currentRiskLevel==='WARNING'?'w':'s'">{{valueLabels[row.currentRiskLevel]||'미확인'}}</span></RouterLink><p v-if="!items.length">조회 조건에 맞는 시설이 없습니다.</p></div></template>
