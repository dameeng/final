<script setup lang="ts">
import { computed } from 'vue'
type Row = Record<string, any>
type Metric = { label: string; value: number; tone?: string; unit?: string }
const props = defineProps<{ resource: string; items: Row[]; total: number }>()
const metrics = computed<Metric[]>(() => {
  const rows = props.items
  const count = (test: (row: Row) => boolean) => rows.filter(test).length
  const unique = (key: string) => new Set(rows.map(row => row[key]).filter(Boolean)).size
  const configs: Record<string, Metric[]> = {
    cameras: [
      { label: '접근 인식', value: count(row => row.cameraRole === 'APPROACH_LPR'), unit: '대' },
      { label: '최종 인식', value: count(row => row.cameraRole === 'FINAL_LPR'), unit: '대' },
      { label: '일반 CCTV', value: count(row => row.cameraRole === 'CCTV'), unit: '대' },
    ],
    customers: [
      { label: '연락처 등록', value: count(row => !!row.phone) },
      { label: '이메일 등록', value: count(row => !!row.email) },
      { label: '차량 등록 고객', value: count(row => Array.isArray(row.carNums) && row.carNums.length > 0) },
    ],
    inquiries: [
      { label: '답변 대기', value: count(row => row.status === 'PENDING'), tone: 'warning' },
      { label: '답변 완료', value: count(row => row.status === 'ANSWERED'), tone: 'success' },
      { label: '문의 고객', value: unique('customerName'), unit: '명' },
    ],
    notices: [
      { label: '중요 공지', value: count(row => row.important === true || row.important === 'true' || row.important === 1), tone: 'warning' },
      { label: '공지 분류', value: unique('category'), unit: '개' },
      { label: '누적 조회', value: rows.reduce((sum, row) => sum + Math.max(0, Number(row.viewCount) || 0), 0), unit: '회' },
    ],
    faqs: [
      { label: '질문 분류', value: unique('category'), unit: '개' },
      { label: '작성자', value: unique('authorName'), unit: '명' },
      { label: '누적 조회', value: rows.reduce((sum, row) => sum + Math.max(0, Number(row.viewCount) || 0), 0), unit: '회' },
    ],
    transits: [
      { label: '정상 통과', value: count(row => row.status === 'EXITED'), tone: 'success' },
      { label: '진입 중', value: count(row => row.status === 'IN_TRANSIT') },
      { label: '잔류 확인', value: count(row => row.status === 'REMAINING'), tone: 'warning' },
    ],
    ocr: [
      { label: '인식 성공', value: count(row => row.recognitionStatus === 'SUCCESS'), tone: 'success' },
      { label: '판별 대기', value: count(row => row.reviewStatus === 'PENDING'), tone: 'warning' },
      { label: '인식 실패', value: count(row => row.recognitionStatus === 'FAIL'), tone: 'danger' },
    ],
    reviews: [
      { label: '판별 대기', value: count(row => row.reviewStatus === 'PENDING'), tone: 'warning' },
      { label: '판별 확정', value: count(row => row.reviewStatus === 'CONFIRMED'), tone: 'success' },
      { label: '자동 처리', value: count(row => row.reviewStatus === 'AUTO_PROCESSED') },
    ],
    alerts: [
      { label: '발송 성공', value: count(row => row.pushStatus === 'SUCCESS'), tone: 'success' },
      { label: '발송 실패', value: count(row => row.pushStatus === 'FAIL'), tone: 'danger' },
      { label: '발송 대기', value: count(row => row.pushStatus === 'PENDING'), tone: 'warning' },
    ],
    events: [
      { label: '시설 이벤트', value: count(row => row.kind === 'EVENT') },
      { label: '전광판 이력', value: count(row => row.kind === 'DISPLAY') },
      { label: '대상 시설', value: unique('underpassName'), unit: '개소' },
    ],
    transfers: [
      { label: '이관 기관', value: unique('agency'), unit: '개' },
      { label: '문서 종류', value: unique('documentType'), unit: '개' },
      { label: '처리자', value: unique('managerName'), unit: '명' },
    ],
    presets: [
      { label: '차단 안내', value: count(row => row.category === 'BLOCK'), tone: 'warning' },
      { label: '해제 안내', value: count(row => row.category === 'RELEASE'), tone: 'success' },
      { label: '문구 분류', value: unique('category'), unit: '개' },
    ],
    reasons: [
      { label: '차단 사유', value: count(row => row.type === 'BLOCK'), tone: 'warning' },
      { label: '해제 사유', value: count(row => row.type === 'RELEASE'), tone: 'success' },
      { label: '현재 페이지', value: rows.length },
    ],
    shifts: [
      { label: '시작 시각 등록', value: count(row => !!row.startTime) },
      { label: '종료 시각 등록', value: count(row => !!row.endTime) },
      { label: '현재 페이지', value: rows.length },
    ],
    'pm-history': [
      { label: '점검 시작', value: count(row => row.kind === 'START') },
      { label: '기록 추가', value: count(row => row.kind === 'RECORD') },
      { label: '점검 종료', value: count(row => ['RESOLVED', 'ETC'].includes(row.kind)), tone: 'success' },
    ],
    'pm-settings': [
      { label: '설비 종류', value: unique('type'), unit: '개' },
      { label: '주의 기준 등록', value: count(row => row.cautionMin != null), tone: 'warning' },
      { label: '위험 기준 등록', value: count(row => row.dangerMin != null), tone: 'danger' },
    ],
  }
  return configs[props.resource] || []
})
</script>
<template>
  <section v-if="metrics.length" class="resource-overview" aria-label="조회 결과 요약">
    <div class="resource-overview-item is-total"><div class="resource-overview-heading"><span>{{ resource === 'cameras' ? '등록 카메라' : '전체 조회 결과' }}</span><small>{{ resource === 'cameras' ? '시설 기준' : '검색 조건' }}</small></div><strong>{{ total.toLocaleString('ko-KR') }}<small>{{ resource === 'cameras' ? '대' : '건' }}</small></strong></div>
    <div v-for="metric in metrics" :key="metric.label" class="resource-overview-item" :class="metric.tone && 'is-' + metric.tone">
      <div class="resource-overview-heading"><span>{{ metric.label }}</span><small>현재 페이지</small></div><strong>{{ metric.value.toLocaleString('ko-KR') }}<small>{{ metric.unit || '건' }}</small></strong>
    </div>
  </section>
</template>
<style scoped>
.resource-overview { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:0 0 24px; min-width:0; }
.resource-overview-item { display:flex; flex-direction:column; align-items:flex-start; min-height:88px; box-sizing:border-box; padding:12px 20px; border:1px solid var(--r-line); border-radius:12px; background:var(--r-surface); min-width:0; }
.resource-overview-heading { display:flex; align-items:baseline; justify-content:space-between; gap:6px; width:100%; min-width:0; }
.resource-overview-heading>small { white-space:nowrap; font-size:9px; }
.resource-overview-heading>span { display:block; font-size:12px; line-height:20px; color:var(--r-muted); white-space:nowrap; }
.resource-overview-item strong { display:flex; align-items:baseline; gap:6px; margin:4px 0 0; font-size:28px; line-height:36px; font-weight:650; font-variant-numeric:tabular-nums; color:var(--r-ink); }
.resource-overview-item small { font-size:10px; line-height:16px; color:var(--r-muted); font-weight:400; }
.resource-overview-item strong small { font-size:12px; }
.is-total { background:var(--r-surface); }
.is-total strong { color:var(--r-accent); }.is-success strong { color:#168369; }.is-warning strong { color:#a67a22; }.is-danger strong { color:var(--admin-alert-ink); }
:global(:root[data-theme=dark]) .is-success strong { color:#7eddbb; }:global(:root[data-theme=dark]) .is-warning strong { color:#edc478; }
@media(max-width:1000px) { .resource-overview { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:500px) { .resource-overview-item { display:flex; flex-direction:column; align-items:flex-start; min-height:88px; box-sizing:border-box; padding:12px 14px; }.resource-overview-item strong { font-size:24px; }.resource-overview { gap:10px; } }
</style>
