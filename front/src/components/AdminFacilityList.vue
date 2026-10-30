<script setup lang="ts">
import ListResultCount from './ListResultCount.vue'
import {
  riskGroup,
  matchesRisk,
  boardCategoryLabel,
  riskSummaryLabel,
} from '../services/backendCatalog'
import { ownsFacility } from '../services/facilityAccess'

defineProps<{ items: Record<string, any>[]; total: number; riskFilter: string; riskCounts: Record<string, number> }>()
defineEmits<{
  filter: [value: string]
  detail: [row: Record<string, any>]
  edit: [row: Record<string, any>]
  remove: [row: Record<string, any>]
  control: [row: Record<string, any>]
}>()
const riskCards: { value: string; label: string; className: string }[] = [
  { value: '', label: '전체', className: '' },
  { value: 'SAFE', label: '안전', className: 'is-normal' },
  { value: 'WARNING', label: '주의', className: 'is-review' },
  { value: 'DANGER', label: '위험', className: 'is-blocked' },
]
const riskClass = (value: string) =>
  riskGroup(value) === 'DANGER' ? 'danger' : riskGroup(value) === 'WARNING' ? 'warn' : 'safe'
</script>
<template>
  <div class="restored-facilities">
    <section class="facility-directory-summary" aria-label="조회된 지하차도 운영 현황">
      <button v-for="card in riskCards" :key="card.value" type="button" class="facility-summary-item" :class="card.className" :aria-pressed="riskFilter === card.value" :aria-label="card.label + ' ' + (riskCounts[card.value] || 0) + '곳'" @click="$emit('filter', card.value)">
        <span class="facility-summary-copy"><span>{{ card.label }}</span><strong>{{ riskCounts[card.value] || 0 }}<small>곳</small></strong></span>
      </button>
    </section>
    <ListResultCount :count="total" />
    <div class="tbl-wrap">
      <table class="tbl" id="tbl">
        <thead>
          <tr>
            <th>지하차도</th>
            <th>위험 단계 · 점수</th>
            <th>통제</th>
            <th>통과 중 차량</th>
            <th>판별 대기</th>
            <th>지역</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id" :class="{ 'facility-blocked-row': row.currentStatus === 'BLOCKED' }">
            <td>
              <button type="button" class="link row-open" @click="$emit('detail',row)">
                <span class="facility-tunnel-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V10a8 8 0 0 1 16 0v11M8 21V10a4 4 0 0 1 8 0v11M2 21h20M12 13v2m0 4v2" /></svg></span><span class="facility-name-copy"><strong>{{row.name}}</strong><small>{{ row.regionName || '지역 미등록' }}</small></span>
              </button>
            </td>
            <td>
              <span
                class="badge"
                :class="row.currentStatus==='BLOCKED'?'danger':riskClass(row.currentRiskLevel)"
              >
                {{riskSummaryLabel(row.currentRiskLevel,row.currentStatus==='BLOCKED')}}
              </span> <strong>{{row.riskScore??'—'}}</strong>
            </td>
            <td>
              <span class="facility-operation-status" :class="row.currentStatus==='BLOCKED'?'stat ack':'sub'">
                {{row.currentStatus==='BLOCKED'?'통제 중':'정상 운영'}}
              </span>
            </td>
            <td><span class="facility-count" :class="{ 'has-count': Number(row.remainingCount) > 0 }"><strong>{{row.remainingCount??'—'}}</strong><small>대</small></span></td>
            <td><span class="facility-count review-count" :class="{ 'has-count': Number(row.pendingReviewCount) > 0 }"><strong>{{row.pendingReviewCount??'—'}}</strong><small>건</small></span></td>
            <td><span class="facility-region">{{row.regionName||'—'}}</span></td>
            <td>
              <div class="row">
                <RouterLink
                  class="btn sm"
                  :to="'/fac-detail?id='+row.id"
                  target="_blank"
                  rel="noopener"
                >새 탭 ↗</RouterLink>
                <button
                  type="button"
                  class="btn sm control-action"
                  :disabled="!ownsFacility(row)"
                  :title="ownsFacility(row)?'':'담당 외 시설은 통제할 수 없습니다.'"
                  @click="$emit('control',row)"
                >
                  {{row.currentStatus==='BLOCKED'?'해제':'통제'}}
                </button>
              </div>
            </td>
          </tr>
<tr v-if="!items.length"><td colspan="7">조회된 지하차도가 없습니다.</td></tr>
        </tbody>
      </table>
    </div>
    <p class="sub">이름을 누르면 요약 서랍이 열려요. ‘새 탭 ↗’으로 여러 지하차도를 나란히 볼 수 있어요.</p>
  </div>
</template>
