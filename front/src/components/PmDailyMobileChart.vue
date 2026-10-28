<script setup lang="ts">
import {computed} from 'vue'
import {PM_TYPES} from '../utils/pm-labels'
const props=defineProps<{summary:Record<string,any>}>()
const states=[['safe','안전'],['caution','주의'],['danger','위험'],['noData','미수신']] as const
const count=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,n):0}
const rows=computed(()=>(props.summary.byType||[]).map((row:Record<string,any>)=>({
  type:row.type,label:PM_TYPES[row.type]||row.type,total:count(row.total),
  segments:states.map(([key,label])=>({key,label,value:count(row[key])})),
})))
const maximum=computed(()=>Math.max(1,...rows.value.map((row:any)=>Math.max(row.total,row.segments.reduce((sum:number,s:any)=>sum+s.value,0)))))
const total=computed(()=>rows.value.reduce((sum:number,row:any)=>sum+row.total,0))
</script>
<template>
  <section class="daily-mobile-chart" aria-labelledby="daily-mobile-chart-title">
    <header><div><span class="daily-mobile-chart-icon" aria-hidden="true"><UiIcon name="chart" /></span><h2 id="daily-mobile-chart-title">종류별 현황</h2></div><span class="daily-mobile-chart-total">전체 <strong>{{total}}</strong>대</span></header>
    <div class="daily-mobile-chart-legend" aria-label="상태 색상 안내"><span v-for="[key,label] in states" :key="key"><i :class="'state-'+key"></i>{{label}}</span></div>
    <div v-for="row in rows" :key="row.type" class="daily-mobile-chart-row">
      <div class="daily-mobile-chart-label"><strong>{{row.label}}</strong><span>{{row.total}}<small>대</small></span></div>
      <div class="daily-mobile-chart-track" role="img" :aria-label="row.label+': '+row.segments.map((s:any)=>s.label+' '+s.value+'대').join(', ')">
        <span v-for="segment in row.segments" :key="segment.key" :class="'state-'+segment.key" :style="{width:segment.value/maximum*100+'%'}" :title="segment.label+' '+segment.value+'대'"></span>
      </div>
      <div class="daily-mobile-chart-values"><span v-for="segment in row.segments.filter((s:any)=>s.value>0)" :key="segment.key"><i :class="'state-'+segment.key"></i>{{segment.label}} <b>{{segment.value}}</b></span><span v-if="!row.total">등록된 장비 없음</span></div>
    </div>
    <p v-if="!rows.length" class="daily-mobile-chart-empty">집계된 장비가 없습니다.</p>
    <footer><span>막대 길이: 장비 수 기준</span><span>최초 수신 대기 <b>{{summary.neverReceived??0}}</b>대</span></footer>
  </section>
</template>
<style scoped>
.daily-mobile-chart{margin:14px 0;padding:16px;border:1px solid var(--r-line);border-radius:14px;background:var(--r-surface);color:var(--r-ink);}
header,header>div{display:flex;align-items:center;gap:8px;}header{justify-content:space-between;gap:12px;margin-bottom:14px;}
h2{margin:0;font-size:15px;line-height:24px;font-weight:650;}
.daily-mobile-chart-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:var(--r-selected);color:var(--r-accent);--ui-icon-size:16px;}
.daily-mobile-chart-total{display:flex;align-items:baseline;gap:4px;font-size:11px;color:var(--r-muted);white-space:nowrap;}.daily-mobile-chart-total strong{font-size:20px;line-height:26px;color:var(--r-ink);font-weight:650;font-variant-numeric:tabular-nums;}
.daily-mobile-chart-legend{display:flex;flex-wrap:wrap;gap:6px 12px;margin-bottom:18px;color:var(--r-muted);font-size:11px;line-height:18px;}
.daily-mobile-chart-legend>span,.daily-mobile-chart-values>span{display:inline-flex;align-items:center;gap:4px;}
i{display:inline-block;width:7px;height:7px;border-radius:2px;flex:none;}
.state-safe{background:#3bad8a;}.state-caution{background:#e8ac3b;}.state-danger{background:#e66b88;}.state-noData{background:#8b9caf;}
.daily-mobile-chart-row+.daily-mobile-chart-row{margin-top:16px;}
.daily-mobile-chart-label{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:7px;font-size:13px;line-height:20px;}
.daily-mobile-chart-label strong{font-weight:600;}.daily-mobile-chart-label>span{font-size:16px;font-weight:650;font-variant-numeric:tabular-nums;}.daily-mobile-chart-label small{font-size:11px;font-weight:400;color:var(--r-muted);margin-left:3px;}
.daily-mobile-chart-track{display:flex;width:100%;height:12px;overflow:hidden;border-radius:5px;background:var(--r-soft);}
.daily-mobile-chart-track>span{display:block;height:100%;flex:none;}
.daily-mobile-chart-values{display:flex;gap:6px 12px;flex-wrap:wrap;margin-top:6px;color:var(--r-muted);font-size:11px;line-height:18px;}.daily-mobile-chart-values b{font-weight:600;color:var(--r-ink);}
footer{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;border-top:1px solid var(--r-line);padding-top:12px;margin-top:16px;font-size:10px;line-height:18px;color:var(--r-muted);}
footer b{font-weight:600;color:var(--r-ink);}.daily-mobile-chart-empty{margin:16px 0;text-align:center;font-size:13px;color:var(--r-muted);line-height:24px;}
@media(prefers-reduced-motion:no-preference){.daily-mobile-chart-track>span{animation:daily-mobile-bar-enter 500ms ease-out;transform-origin:left;}@keyframes daily-mobile-bar-enter{from{transform:scaleX(0)}to{transform:scaleX(1)}}}
@media(max-width:340px){.daily-mobile-chart{padding:14px;}.daily-mobile-chart-legend{gap:6px 9px;}}
</style>
