<script setup lang="ts">
import { useRoute } from 'vue-router'
import RiskLevelBadge from './RiskLevelBadge.vue'
import PmActionKindBadge from './PmActionKindBadge.vue'
import { managerAppPath } from '../utils/manager-app-path'
import { PM_TYPES, PM_EVENT_STATUS, pmLabel } from '../utils/pm-labels'
defineProps<{ items: Record<string, any>[]; inspection?: boolean }>()
const route = useRoute()
const level = (row: Record<string, any>) => row.currentLevel || row.level || row.eventLevel
const score = (row: Record<string, any>) => {
  const value = row.currentScore ?? row.score
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : null
}
</script>
<template>
  <div class="pm-equipment-cards" :aria-label="inspection?'점검 목록':'설비 목록'">
    <RouterLink
      v-for="row in items" :key="row.actionId??row.eventId??row.equipId"
      class="pm-equipment-card"
      :to="{path:managerAppPath('/pm-equipment-detail',route.path),query:{id:String(row.equipId)}}"
    >
      <span class="pm-equipment-card-copy">
        <span class="pm-equipment-card-facility" :title="row.underpassName">{{row.underpassName||'지하차도 미상'}}</span>
        <span class="pm-equipment-card-device"><strong>{{row.name||'설비 '+row.equipId}}</strong><span>· {{pmLabel(PM_TYPES,row.type)}}</span></span>
        <span v-if="row.actionId" class="pm-equipment-card-action"><PmActionKindBadge :kind="row.kind" :label="row.kindLabel" /><span>{{row.content}}</span></span>
      </span>
      <span v-if="inspection" class="pm-equipment-card-risk">
        <span class="pm-inspection-state" :class="'pm-inspection-state--'+String(row.status||'unknown').toLowerCase()">{{pmLabel(PM_EVENT_STATUS,row.status,'—')}}</span>
        <strong v-if="score(row)!==null" class="pm-equipment-card-score" :aria-label="(row.currentScore!=null?'현재 위험 점수 ':'발생 당시 위험 점수 ')+score(row)+'점'"><small>{{row.currentScore!=null?'현재':'발생'}}</small> {{score(row)}}<small>점</small></strong>
        <small v-else class="pm-equipment-card-no-score">점수 미수신</small>
      </span>
      <span v-else class="pm-equipment-card-risk">
        <RiskLevelBadge v-if="level(row)" :value="level(row)" />
        <span v-else class="pm-equipment-card-unknown" aria-label="위험 단계 미확인">—</span>
        <strong v-if="score(row)!==null" class="pm-equipment-card-score" :aria-label="'위험 점수 '+score(row)+'점'">{{score(row)}}<small>점</small></strong>
        <small v-else class="pm-equipment-card-no-score">점수 미수신</small>
      </span>
    </RouterLink>
  </div>
</template>
<style scoped>
.pm-equipment-cards { display:grid; grid-template-columns:minmax(0,1fr); gap:10px; }
.pm-equipment-card-action{display:flex;align-items:center;gap:8px;margin-top:6px;min-width:0;font-size:12px;}
.pm-equipment-card-action>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pm-equipment-card { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:88px; padding:14px 16px; box-sizing:border-box; border:1px solid var(--r-line,#dce7f2); border-radius:12px; background:var(--r-surface,#fff); color:var(--r-ink,#172e49); text-decoration:none; }
.pm-equipment-card-copy { flex:1; min-width:0; }
.pm-equipment-card-risk { display:flex; flex-direction:column; align-items:flex-end; gap:5px; flex:0 0 auto; }
.pm-equipment-card-score { font-size:17px; line-height:22px; font-weight:700; font-variant-numeric:tabular-nums; color:var(--r-ink,#172e49); white-space:nowrap; }
.pm-equipment-card-score small { margin-left:3px; font-size:11px; font-weight:500; color:var(--r-muted,#5c738b); }
.pm-equipment-card-no-score { font-size:11px; line-height:18px; color:var(--r-muted,#5c738b); white-space:nowrap; }
.pm-equipment-card-facility { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; line-height:20px; color:var(--r-muted,#5c738b); }
.pm-equipment-card-device { display:flex; align-items:baseline; flex-wrap:wrap; gap:4px 6px; margin-top:5px; font-size:14px; line-height:24px; }
.pm-equipment-card-device strong { font-size:16px; font-weight:700; overflow-wrap:anywhere; }
.pm-equipment-card-device>span { color:var(--r-muted,#5c738b); word-break:keep-all; }
.pm-equipment-card :deep(.risk-level-badge),.pm-equipment-card-unknown { flex-shrink:0; min-width:38px; box-sizing:border-box; text-align:center; font-size:13px; }
.pm-equipment-card :deep(.risk-level-badge--alert),.pm-equipment-card :deep(.risk-level-badge--severe) { background:var(--admin-alert-surface,#fff0f2); color:var(--admin-alert-ink,#b84455); }
.pm-equipment-card-unknown { padding:3px 8px; border:1px solid var(--r-line,#dce7f2); border-radius:5px; color:var(--r-muted,#5c738b); }
.pm-inspection-state { flex-shrink:0; padding:4px 8px; border-radius:5px; background:var(--r-soft,#f5f8fc); color:var(--r-muted,#5c738b); font-size:12px; line-height:20px; white-space:nowrap; }
.pm-inspection-state--check_needed { background:var(--admin-alert-surface,#fff0f2); color:var(--admin-alert-ink,#a02e40); }
.pm-inspection-state--in_progress { background:var(--r-selected,#eaf3ff); color:var(--r-accent,#2375d6); }
.pm-inspection-state--resolved { background:#e8f5ee; color:#147754; }
</style>
