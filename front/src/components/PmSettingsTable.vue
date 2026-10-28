<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { computed } from 'vue'
import { PM_TYPES } from '../utils/pm-labels'
import { displayDate } from '../utils/display-date'
import RiskLevelBadge from './RiskLevelBadge.vue'
const props=defineProps<{rows:Record<string,any>[];saving:boolean}>()
const selected=defineModel<number[]>({required:true})
const emit=defineEmits<{remove:[row:Record<string,any>]}>()
const allSelected=computed(()=>props.rows.length>0&&props.rows.every(row=>selected.value.includes(row.equipId)))
function toggleAll(){selected.value=allSelected.value?[]:props.rows.map(row=>row.equipId)}
</script>
<template>
  <div class="service-table-wrap pm-settings-table-wrap">
    <table class="service-table pm-settings-table">
      <thead><tr><th><input type="checkbox" aria-label="현재 페이지 설비 전체 선택" :checked="allSelected" :disabled="saving||!rows.length" @change="toggleAll" /></th><th>설비 · 종류</th><th>지하차도</th><th>단계별 시작 점수</th><th>최근 수정</th><th>처리</th></tr></thead>
      <tbody>
        <tr v-for="row in rows" :key="row.equipId">
          <td><input v-model="selected" type="checkbox" :value="row.equipId" :aria-label="row.name+' 선택'" :disabled="saving" /></td>
          <td><RouterLink :to="{path:'/pm-equipment-detail',query:{id:String(row.equipId)}}">{{row.name}}</RouterLink><small class="settings-equipment-type">{{PM_TYPES[row.type]||row.type}}</small></td>
          <td>{{row.underpassName}}</td>
          <td><div class="settings-thresholds"><span><RiskLevelBadge value="SAFE" /><b>0</b></span><span><RiskLevelBadge value="CAUTION" /><b>{{row.cautionMin}}</b></span><span><RiskLevelBadge value="DANGER" /><b>{{row.dangerMin}}</b></span></div></td>
          <td><span>{{row.updatedByName||'초기 기준'}}</span><small class="settings-updated-at">{{displayDate(row.updatedAt)}}</small></td>
          <td><button type="button" :disabled="saving" @click="emit('remove',row)">설비 삭제</button></td>
        </tr>
        <tr v-if="!rows.length"><td colspan="6" class="pm-table-empty">조회된 설비가 없습니다.</td></tr>
      </tbody>
    </table>
  </div>
</template>
