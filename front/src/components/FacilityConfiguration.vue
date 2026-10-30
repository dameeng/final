<script setup lang="ts">
import ListResultCount from './ListResultCount.vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import RiskLevelBadge from './RiskLevelBadge.vue'
import { displayDate } from '../utils/display-date'
import { valueLabels } from '../data/backendResources'
const props=defineProps<{kind:'thresholds'|'cameras';facilityId:string;facilityName?:string;rows:Record<string,any>[];total:number;canWrite:boolean;embedded?:boolean}>()
const emit=defineEmits<{action:[kind:string,row?:Record<string,any>]}>()
const thresholds=computed(()=>[...props.rows].sort((a,b)=>Number(a.riskScoreMin)-Number(b.riskScoreMin)))
const registeredStreams=computed(()=>props.rows.filter(row=>!!row.streamUrl).length)
const latest=computed(()=>props.rows.map(row=>row.updatedAt).filter(Boolean).sort().reverse()[0])
</script>
<template>
  <div class="facility-configuration" :class="{'configuration-embedded':embedded}">
    <header v-if="!embedded" class="configuration-summary">
      <div class="configuration-summary-copy"><span class="configuration-eyebrow">선택한 지하차도</span><h2>{{facilityName||'선택한 시설'}}</h2><p>{{kind==='thresholds'?'위험 단계를 구분하는 점수 기준을 관리합니다.':'시설에 등록된 카메라의 역할과 영상 정보를 관리합니다.'}}</p><RouterLink :to="{path:'/fac-detail',query:{id:facilityId}}">시설 개요 확인 →</RouterLink></div>
      <div class="configuration-summary-count"><span>{{kind==='thresholds'?'설정된 단계':'등록 카메라'}}</span><strong>{{total}}<small>{{kind==='thresholds'?'단계':'대'}}</small></strong><span v-if="kind==='cameras'">현재 페이지 영상 주소 등록 {{registeredStreams}}대</span><span v-else-if="latest">최근 수정 {{displayDate(latest)}}</span></div>
    </header>

    <section v-if="rows.length&&kind==='thresholds'" class="configuration-content" aria-label="위험 단계별 임계치">
      <div v-if="!embedded" class="configuration-section-heading"><h3>단계별 판단 기준</h3><span>최소 위험 점수 기준 · 낮은 순</span></div>
      <ListResultCount :count="total" />
      <div class="configuration-threshold-grid"><article v-for="(row,index) in thresholds" :key="row.level" class="configuration-threshold-card" :data-level="row.level">
        <header class="configuration-stage-heading"><RiskLevelBadge :value="row.level" /><span>최소 위험 점수</span></header><div class="configuration-score"><strong>{{row.riskScoreMin??'—'}}</strong><span>점 이상</span></div>
        <p>{{index<thresholds.length-1?Number(thresholds[index+1]?.riskScoreMin)+'점 미만까지 적용':'설정된 최상위 단계'}}</p>
        <footer><small><span v-if="row.updatedAt">최근 수정 </span>{{row.updatedAt?displayDate(row.updatedAt):'수정 이력 없음'}}</small><button v-if="canWrite" type="button" @click="emit('action','edit',row)">기준 수정</button></footer>
      </article></div>
    </section>

    <section v-else-if="rows.length" class="configuration-content" aria-label="등록된 카메라">
      <div class="configuration-section-heading"><h3>카메라 구성</h3><span>역할과 영상 주소를 확인하세요</span></div>
      <ListResultCount :count="total" />
      <div class="configuration-camera-grid"><article v-for="row in rows" :key="row.id" class="configuration-camera-card">
        <header><span class="configuration-device-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="13" height="10" rx="2"/><path d="m16 8 5-2v8l-5-2M9 15v4M5 19h8"/></svg></span><div><h4>카메라 {{row.id}}</h4><span>{{valueLabels[row.cameraRole]||row.cameraRole||'역할 미지정'}}</span></div></header>
        <dl><div><dt>영상 주소</dt><dd class="configuration-stream" :title="row.streamUrl||''">{{row.streamUrl||'등록된 영상 주소가 없습니다.'}}</dd></div><div><dt>거리</dt><dd>{{row.distanceM==null?'미등록':row.distanceM+' m'}}</dd></div></dl>
        <footer><button v-if="row.streamUrl" type="button" class="configuration-primary" @click="emit('action','video',row)">영상 보기</button><button type="button" @click="emit('action','detail',row)">상세</button><button v-if="canWrite" type="button" @click="emit('action','edit',row)">수정</button><button v-if="canWrite" type="button" @click="emit('action','remove',row)">삭제</button></footer>
      </article></div>
    </section>

    <section v-else><ListResultCount :count="total" /><div class="configuration-empty"><span class="configuration-empty-icon" aria-hidden="true"><UiIcon :name="kind==='cameras'?'eye':'document'" /></span><h3>{{kind==='cameras'?'등록된 카메라가 없습니다':'등록된 임계치가 없습니다'}}</h3><p>{{kind==='cameras'?'카메라를 등록하면 역할과 영상 정보를 이곳에서 확인할 수 있습니다.':'이 시설에 설정된 단계 기준이 아직 없습니다. 다른 시설의 기준을 확인하거나 설정 담당자에게 문의하세요.'}}</p><button v-if="kind==='cameras'&&canWrite" type="button" class="configuration-primary" @click="emit('action','create')">카메라 등록</button></div></section>

    <aside v-if="!embedded" class="configuration-guide"><span aria-hidden="true"><UiIcon name="help" /></span><div><h3>{{kind==='thresholds'?'임계치 확인 안내':'카메라 관리 안내'}}</h3><p>{{kind==='thresholds'?'설정된 최소 점수부터 해당 위험 단계가 적용됩니다. 위험 단계와 실제 통제 상태를 함께 확인하세요.':'영상 주소가 등록되어 있어도 실제 재생 가능 여부는 다를 수 있습니다. 영상 보기에서 화면을 확인하고, 카메라의 용도가 바뀌면 역할도 수정해 주세요.'}}</p></div></aside>
  </div>
</template>
<style scoped>
.configuration-embedded .configuration-threshold-card { padding:18px; background:var(--r-soft); }
.configuration-embedded .configuration-score { margin-top:16px; }
.configuration-embedded .configuration-score strong { font-size:28px; line-height:36px; }
.configuration-embedded .configuration-threshold-card>p { margin-bottom:18px; line-height:20px; }
.configuration-embedded .configuration-threshold-card footer { flex-direction:column; align-items:stretch; gap:10px; }
.configuration-embedded .configuration-threshold-card footer button { background:var(--r-surface); }
.configuration-stage-heading { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
.configuration-stage-heading>span:last-child { font-size:11px; line-height:20px; color:var(--r-muted); }
.configuration-threshold-card { --stage-accent:var(--r-line); border-top:3px solid var(--stage-accent)!important; display:flex; flex-direction:column; }
.configuration-threshold-card[data-level=SAFE] { --stage-accent:#168369; }
.configuration-threshold-card[data-level=WATCH] { --stage-accent:#8171c5; }
.configuration-threshold-card:is([data-level=WARNING],[data-level=CAUTION]) { --stage-accent:#c7912a; }
.configuration-threshold-card:is([data-level=DANGER],[data-level=ALERT],[data-level=SEVERE]) { --stage-accent:#bd455b; }
.configuration-threshold-card footer { margin-top:auto; }
.facility-configuration{display:flex;flex-direction:column;gap:20px;min-width:0;container-type:inline-size;color:var(--r-ink);}
.configuration-summary{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:26px 28px;border:1px solid var(--r-line);border-radius:14px;background:linear-gradient(120deg,var(--r-surface),var(--r-soft));}
.configuration-eyebrow{font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--r-muted);}
.configuration-summary h2{font-size:25px;letter-spacing:-.035em;margin:8px 0;}.configuration-summary p{font-size:13px;color:var(--r-muted);line-height:1.8;margin:0 0 12px;}.configuration-summary a{font-size:12px;font-weight:600;}
.configuration-summary-copy{min-width:0;}.configuration-summary-count{display:flex;flex-direction:column;gap:7px;align-items:flex-end;flex-shrink:0;}.configuration-summary-count>span{color:var(--r-muted);font-size:11px;}.configuration-summary-count strong{font-size:36px;color:var(--r-accent);line-height:1.2;font-weight:650;}.configuration-summary-count small{margin-left:7px;font-size:13px;font-weight:500;}
.configuration-section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;}.configuration-section-heading h3{margin:0;font-size:15px;}.configuration-section-heading>span{font-size:11px;color:var(--r-muted);}
.configuration-threshold-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;}.configuration-threshold-card,.configuration-camera-card{min-width:0;padding:22px;border:1px solid var(--r-line);border-radius:12px;background:var(--r-surface);}
.configuration-score{display:flex;align-items:baseline;gap:8px;margin-top:24px;}.configuration-score strong{font-size:36px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.04em;}.configuration-score>span{font-size:12px;color:var(--r-muted);}.configuration-threshold-card>p{font-size:12px;color:var(--r-muted);margin:8px 0 24px;}.configuration-threshold-card footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--r-line);}.configuration-threshold-card small{color:var(--r-muted);font-size:11px;}
.facility-configuration button{min-height:36px;padding:7px 12px;border:1px solid var(--r-line);border-radius:8px;background:var(--r-surface);color:inherit;font:inherit;font-size:12px;font-weight:600;cursor:pointer;}.facility-configuration .configuration-primary{background:var(--r-accent);border-color:var(--r-accent);color:#fff;}
.configuration-camera-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}.configuration-camera-card header{display:flex;align-items:center;gap:12px;}.configuration-device-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;background:var(--r-selected);color:var(--r-accent);}.configuration-device-icon svg{width:25px;height:25px;}.configuration-camera-card h4{margin:0 0 4px;font-size:15px;}.configuration-camera-card header div>span{color:var(--r-muted);font-size:12px;}.configuration-camera-card dl{margin:22px 0;}.configuration-camera-card dl>div{display:grid;grid-template-columns:70px minmax(0,1fr);gap:12px;margin:12px 0;font-size:12px;}.configuration-camera-card dt{color:var(--r-muted);}.configuration-camera-card dd{margin:0;}.configuration-stream{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.configuration-camera-card footer{display:flex;gap:8px;flex-wrap:wrap;padding-top:16px;border-top:1px solid var(--r-line);}
.configuration-guide{display:flex;align-items:flex-start;gap:12px;padding:20px 22px;border:1px solid var(--r-line);border-radius:12px;background:var(--r-soft);}.configuration-guide>span{color:var(--r-accent);--ui-icon-size:20px;}.configuration-guide h3{font-size:13px;margin:0 0 6px;}.configuration-guide p{font-size:12px;color:var(--r-muted);line-height:1.9;margin:0;}
.configuration-empty{text-align:center;padding:48px 24px;border:1px dashed var(--r-line);border-radius:14px;background:var(--r-surface);}.configuration-empty-icon{display:grid;place-items:center;width:52px;height:52px;margin:0 auto 16px;border-radius:14px;background:var(--r-soft);color:var(--r-accent);}.configuration-empty h3{font-size:17px;margin:0 0 10px;}.configuration-empty p{max-width:440px;margin:0 auto 20px;color:var(--r-muted);font-size:13px;line-height:1.9;}
@container(max-width:650px){.configuration-summary{padding:20px;align-items:flex-start;}.configuration-summary h2{font-size:21px;}.configuration-summary-count>span:last-child{max-width:100px;text-align:right;line-height:1.6;}.configuration-camera-grid{grid-template-columns:1fr;}.configuration-section-heading{align-items:flex-start;flex-direction:column;gap:6px;}}
@container(max-width:400px){.configuration-summary{flex-direction:column;gap:16px;}.configuration-summary-count{align-items:flex-start;}.configuration-summary-count>span:last-child{max-width:none;text-align:left;}.configuration-threshold-grid{grid-template-columns:1fr;}}
</style>
