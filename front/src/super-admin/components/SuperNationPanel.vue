<script setup lang="ts">
import ZoomableMap from "../../shared/components/ZoomableMap.vue";


import { computed, ref, watch } from 'vue'
import type { Underpass } from '../../shared/admin/services/underpasses'
import { superKoreaRegions as koreaRegions } from '../data/super-korea-regions'
import { normalizeRegion } from '../../shared/admin/utils/region-risk'
const props=defineProps<{items:Underpass[];selected:string;ready:boolean;error:string}>()
const emit=defineEmits<{select:[region:string]}>()
const active=ref('')
const mapSvg=ref<SVGSVGElement|null>(null)
const nationalViewBox='-5 34 216 288'
const mapViewBox=ref(nationalViewBox)
watch(()=>props.selected,()=>{active.value=''})
const groups=[{key:'SAFE',label:'정상'},{key:'WARNING',label:'주의'},{key:'DANGER',label:'위험'},{key:'UNKNOWN',label:'정보 없음'}] as const
const rows=computed(()=>{
 const names=new Set<string>([...koreaRegions.map(r=>r.name),...props.items.map(i=>normalizeRegion(i.region))])
 return [...names].map(name=>{const items=props.items.filter(i=>normalizeRegion(i.region)===name);const counts={SAFE:0,WARNING:0,DANGER:0,UNKNOWN:0};for(const item of items)counts[item.observedRiskLevel||'UNKNOWN']++
 return {name,total:items.length,counts,ratio:items.length&&counts.UNKNOWN<items.length?counts.DANGER/items.length*100:null}
 }).sort((a,b)=>Number(a.name==='미배정')-Number(b.name==='미배정')||share(b,'DANGER')-share(a,'DANGER')||share(b,'WARNING')-share(a,'WARNING')||a.name.localeCompare(b.name,'ko'))
})
// 정렬: 미배정은 항상 맨 아래, 그다음 위험 비율 → 주의 비율 → 이름 순 (모두 0%일 때도 주의가 많은 지역이 위로)
function share(r:{total:number;counts:Record<string,number>},key:string){return r.total?r.counts[key]/r.total:-1}
// 지도 위 지역명 위치 (viewBox 좌표). 경기는 서울과 겹치지 않게 북동쪽, 인천은 섬 말고 육지 쪽에 둠
const labelAt:Record<string,[number,number]>={서울:[97.7,95.5],인천:[82,101],경기:[119,80],강원:[152,78],충북:[141,134],충남:[88,152],세종:[107,141],대전:[118,162],전북:[106,190],광주:[90,219],전남:[101,246],경북:[173,148],대구:[162,186],울산:[193,199],부산:[184,219],경남:[147,214],제주:[80,308]}
const byName=computed(()=>new Map(rows.value.map(r=>[r.name,r])))
const valid=computed(()=>props.ready&&!props.error)
const summary=(name:string)=>{const r=byName.value.get(name);return !valid.value?`${name} · ${props.error?'조회 실패':'확인 중'}`:!r?.total?`${name} · 등록 시설 없음`:`${name} · 전체 ${r.total}곳 · ${groups.map(g=>`${g.label} ${r.counts[g.key]}곳 (${(r.counts[g.key]/r.total*100).toFixed(1)}%)`).join(' · ')} · 위험 비율 ${r.ratio==null?'—':`${r.ratio.toFixed(1)}%`}`}
function tone(name:string){const r=byName.value.get(name);if(!valid.value||!r?.total||r.counts.UNKNOWN===r.total)return 'empty';const n=r.ratio!;return n===0?'zero':n<5?'low':n<10?'medium':n<20?'high':'highest'}
function select(name:string){emit('select',props.selected===name?'ALL':name)}
</script>
<template>
<section class="super-panel super-nation"><div class="super-panel-head"><div><h2>전국 시·도별 위험 현황</h2><p>현재 시설 위험 등급 · 지역 전체 시설 = 100%</p></div><button @click="emit('select','ALL')">전체 지역</button></div>
 <p v-if="error" class="super-error" role="alert">시설 조회 실패 · 이전 자료가 있어도 현재 비율은 표시하지 않습니다.</p>
 <div class="super-nation-grid"><div class="super-map-column">
  <ZoomableMap selection-only :height="620" @reset="emit('select','ALL')"><svg ref="mapSvg" class="super-nation-map" :viewBox="mapViewBox" role="group" aria-label="전국 시도별 위험 시설 비율 지도"><path v-for="r in koreaRegions" :key="r.name" :data-region="r.name" :d="r.path" :data-tone="tone(r.name)" fill-rule="evenodd" :class="{'is-active':active===r.name||selected===r.name}" tabindex="0" role="button" :aria-label="summary(r.name)" :aria-pressed="selected===r.name" @mouseenter="active=r.name" @mouseleave="active=''" @focus="active=r.name" @blur="active=''" @click="select(r.name)" @keydown.enter.prevent="select(r.name)" @keydown.space.prevent="select(r.name)"><title>{{ summary(r.name) }}</title></path><path v-for="r in koreaRegions.filter(r=>r.name===selected||r.name===active)" :key="'outline-'+r.name" class="super-region-outline" :d="r.path" fill="none" aria-hidden="true" /><g class="super-map-labels" aria-hidden="true"><text v-for="r in koreaRegions.filter(r=>labelAt[r.name])" :key="'label-'+r.name" :x="labelAt[r.name][0]" :y="labelAt[r.name][1]" :class="{'is-active':active===r.name||selected===r.name}">{{ r.name }}</text></g></svg></ZoomableMap>
  <p class="super-map-detail" aria-live="polite">{{ active ? summary(active) : selected!=='ALL' ? summary(selected) : '' }}</p>
  <div class="super-map-legend"><span v-for="(text,key) in {zero:'0%',low:'5% 미만',medium:'10% 미만',high:'20% 미만',highest:'20% 이상',empty:'시설 없음·정보 없음'}" :key="key"><i :data-tone="key"></i>{{ text }}</span></div>
 </div><div class="super-nation-bars"><div class="super-legend"><span v-for="g in groups" :key="g.key"><i :data-risk="g.key"></i>{{ g.label }}</span></div><div class="super-bar-axis"><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div>
 <button v-for="r in rows" :key="r.name" class="super-region-row" :class="{'is-active':active===r.name||selected===r.name,'is-unassigned':r.name==='미배정'}" :aria-pressed="selected===r.name" :aria-label="summary(r.name)" :title="summary(r.name)" @mouseenter="active=r.name" @mouseleave="active=''" @focus="active=r.name" @blur="active=''" @click="select(r.name)"><span class="super-region-name">{{ r.name }}<small>{{ valid ? `${r.total}곳` : '—' }}</small></span><span class="super-ratio-bar"><template v-if="valid && r.total"><span v-for="g in groups" :key="g.key" :data-risk="g.key" :style="{width:`${r.counts[g.key]/r.total*100}%`}"><span v-if="r.counts[g.key]/r.total>=.15">{{ Math.round(r.counts[g.key]/r.total*100) }}%</span></span></template><small v-else>{{ !valid ? error ? '조회 실패' : '조회 중' : '시설 없음' }}</small></span><span class="super-risk-ratio">{{ valid && r.ratio!=null ? `${r.ratio.toFixed(1)}%` : '—' }}</span></button>
 </div></div>
</section>
</template>
