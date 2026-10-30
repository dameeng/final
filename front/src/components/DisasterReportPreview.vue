<script setup lang="ts">
defineProps<{ managerRegion?: string }>()
const fields = [
  ['보고번호', 'RT-2026-001 (예시)'],
  ['발생장소', '초량1지하차도 · 부산광역시 동구'],
  ['발생일시', '2026-10-30 14:30'],
  ['재난유형', '집중호우에 따른 침수 위험'],
  ['AI 위험단계', '경계'],
  ['시간당 강수량', '65 mm (가상값)'],
  ['CCTV 확인', '확인 필요'],
  ['인명피해', '확인 중'],
  ['도로 통제', '요청 예정'],
]
</script>
<template>
  <article class="disaster-report" aria-label="재난상황 전파 보고서 미리보기">
    <div class="report-brand">ROUTEL · 모의 재난상황보고서</div>
    <h2>재난상황 전파 보고서</h2>
    <p class="report-subtitle">예시 데이터 · 실제 재난 발생 및 통제 문서가 아닙니다.</p>
    <table aria-label="재난상황 기본 정보">
      <tbody>
        <tr v-for="[label, value] in fields" :key="label"><th scope="row">{{ label }}</th><td>{{ value }}<template v-if="label==='AI 위험단계'"><small class="risk-meta">위험 점수 76.4점 · 판정 시각 2026-10-30 14:30</small><small class="risk-meta">발생 당시 판정 결과 · 예시</small></template></td></tr>
        <tr v-if="managerRegion"><th scope="row">담당 지역</th><td>{{ managerRegion }}</td></tr>
      </tbody>
    </table>
    <section><h3>요청사항</h3><p>현장 위험 확인, 차량 진입 통제 및 우회 안내, 인명구조 필요 여부 판단</p></section>
    <section><h3>첨부자료</h3><p>별도 첨부 없음 · CCTV 이미지, AI 예측 결과, 지하차도 위치 좌표는 별도 확인 필요</p></section>
    <footer>전파 대상(예시): 관할 소방상황실 · 경찰 · 지자체 재난안전상황실</footer>
  </article>
</template>
<style scoped>
.disaster-report { box-sizing: border-box; width: 100%; max-width: 900px; margin: 0 auto; padding: 28px 32px; border: 1px solid var(--line,#dedede); border-radius: 14px; background: var(--surface,#fff); color: var(--ink,#202020); }
.report-brand { padding-bottom: 22px; border-bottom: 1px solid var(--line,#dedede); font-size: 13px; }
.disaster-report h2 { margin: 28px 0 12px; text-align: center; font-size: clamp(20px,3vw,26px); font-weight: 700; }
.report-subtitle { margin: 0 0 22px; text-align: center; color: var(--ink-sub,#777); font-size: 14px; }
.disaster-report table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 14px; }
.disaster-report th,.disaster-report td { padding: 12px 0; border: 0; border-bottom: 1px solid var(--line,#eee); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
.disaster-report th { width: 39%; padding-right: 16px; font-weight: 400; }
.disaster-report h3 { margin: 24px 0 12px; font-size: 19px; }
.disaster-report section p { margin: 0; font-size: 16px; line-height: 1.8; overflow-wrap: anywhere; }
.disaster-report footer { margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--line,#dedede); color: var(--ink-sub,#777); font-size: 13px; line-height: 1.7; }
@media(max-width:600px) { .disaster-report { padding: 20px 16px; } .disaster-report table { font-size: 13px; } .disaster-report th { width: 34%; } }
@media print { .disaster-report { max-width: none; border: 0; border-radius: 0; padding: 0; background: white; color: black; } .disaster-report tr,.disaster-report section { break-inside: avoid; } }
.risk-meta { display: block; margin-top: 5px; color: var(--ink-sub,#777); font-size: 12px; line-height: 1.7; }
</style>
