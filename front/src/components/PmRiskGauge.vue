<script setup lang="ts">
import { computed } from 'vue'
const props=defineProps<{value:number|null;level?:string;caution:number;danger:number}>()
const value=computed(()=>props.value!=null&&Number.isFinite(props.value)?props.value:null)
const bounded=computed(()=>Math.max(0,Math.min(100,value.value??0)))
function point(score:number,radius=100){const angle=Math.max(0,Math.min(100,score))/100*Math.PI;return{x:128-Math.cos(angle)*radius,y:128-Math.sin(angle)*radius}}
const end=computed(()=>point(bounded.value))
const ticks=computed(()=>[props.caution,props.danger].filter(v=>Number.isFinite(v)&&v>=0&&v<=100).map(v=>({value:v,inner:point(v,87),outer:point(v,113)})))
</script>
<template>
  <figure class="pm-risk-gauge" :data-level="level" :aria-label="`위험 점수 ${value==null?'미수신':value.toFixed(1)+'점'}, 주의 기준 ${caution}, 위험 기준 ${danger}`">
    <svg viewBox="0 0 256 164" aria-hidden="true">
      <path d="M28 128 A100 100 0 0 1 228 128" class="gauge-track" />
      <path v-if="value!==null" d="M28 128 A100 100 0 0 1 228 128" pathLength="100" class="gauge-progress" :style="{strokeDasharray:`${bounded} 100`}" />
      <line v-for="tick in ticks" :key="tick.value" :x1="tick.inner.x" :y1="tick.inner.y" :x2="tick.outer.x" :y2="tick.outer.y" class="gauge-tick"><title>{{tick.value}}점 기준</title></line>
      <circle v-if="value!==null" :cx="end.x" :cy="end.y" r="6" class="gauge-end" />
      <text x="128" y="110" text-anchor="middle" class="gauge-value">{{value==null?'—':value.toFixed(1)}}</text>
      <text x="128" y="133" text-anchor="middle" class="gauge-unit">{{value==null?'관측값 없음':'위험 점수 / 100'}}</text>
      <text x="23" y="158" class="gauge-scale">0</text><text x="233" y="158" text-anchor="end" class="gauge-scale">100</text>
    </svg>
    <figcaption><span><i class="caution"></i>주의 {{caution}}</span><span><i class="danger"></i>위험 {{danger}}</span></figcaption>
  </figure>
</template>
<style scoped>
.pm-risk-gauge{--gauge-accent:var(--r-accent,#286ac1);width:min(100%,280px);margin:8px auto 0}
.pm-risk-gauge[data-level=SAFE]{--gauge-accent:#359b84}.pm-risk-gauge[data-level=CAUTION]{--gauge-accent:#bb8529}.pm-risk-gauge[data-level=DANGER]{--gauge-accent:var(--pm-alert-ink,#ad392d)}
svg{display:block;width:100%;height:auto;overflow:visible}.gauge-track,.gauge-progress{fill:none;stroke-width:17;stroke-linecap:round}.gauge-track{stroke:var(--r-line,#dbe5ef)}.gauge-progress{stroke:var(--gauge-accent);transition:stroke-dasharray .6s ease;animation:gauge-reveal .8s cubic-bezier(.2,.7,.2,1) both}.gauge-tick{stroke:var(--r-surface,#fff);stroke-width:3}.gauge-end{fill:var(--gauge-accent);stroke:var(--r-surface,#fff);stroke-width:3}.gauge-value{fill:var(--r-ink,#172d48);font-size:43px;font-weight:750;letter-spacing:-2px;font-variant-numeric:tabular-nums}.gauge-unit,.gauge-scale{fill:var(--r-muted,#63748a);font-size:11px}.gauge-scale{font-variant-numeric:tabular-nums}figcaption{display:flex;justify-content:center;gap:20px;margin-top:2px;color:var(--r-muted);font-size:11px}figcaption span{display:flex;align-items:center;gap:6px}i{display:block;width:6px;height:6px;border-radius:50%}i.caution{background:#bf8b36}i.danger{background:#ca6557}
@keyframes gauge-reveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0)}}
@media(prefers-reduced-motion:reduce){.gauge-progress{animation:none;transition:none}}
</style>
