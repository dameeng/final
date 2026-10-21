<script setup lang="ts">
// 종합 현황 '예지보전 Top5': 점수 높은 설비 5개 (스프링 /api/pm/equipments/top) + 사유
import {onBeforeUnmount,onMounted,ref} from 'vue'
import {pmApi,LEVEL_CLASS,score} from '../runtime/pm-api.js'
const levelClass:Record<string,string>=LEVEL_CLASS
const items=ref<any[]>([]),reasons=ref<Record<number,string>>({}),error=ref(''),openCount=ref(0)
let timer:ReturnType<typeof setInterval>|undefined
async function load(){
 try{
  const [top,events]=await Promise.all([pmApi.top(5),pmApi.events(true)])
  items.value=top||[];openCount.value=(events||[]).length;error.value=''
  const details=await Promise.all(items.value.map((e:any)=>pmApi.detail(e.equipId).catch(()=>null)))
  reasons.value=Object.fromEntries(details.map((d:any,i)=>[items.value[i].equipId,d?.reason||'']))
 }catch(e:any){error.value=e.message}
}
onMounted(()=>{load();timer=setInterval(load,60000)})
onBeforeUnmount(()=>clearInterval(timer))
</script>
<template><section class="card wg widget-original-content" aria-label="예지보전 Top5">
<div class="wg-head"><h2>예지보전 Top5</h2><RouterLink to="/pm-queue">점검 대상 {{openCount}}건 →</RouterLink></div>
<p v-if="error">{{error}}</p><p v-else-if="!items.length">아직 계산된 설비 점수가 없습니다.</p>
<ol class="rank"><li v-for="(e,index) in items" :key="e.equipId"><span class="n">{{index+1}}</span><RouterLink class="t equipment-detail-link" :to="'/pm-equipment-detail?equipment='+encodeURIComponent(e.code)">{{e.typeLabel}} · {{e.underpassName}}<small>{{e.level==='SAFE'?'정상 범위':reasons[e.equipId]||'특이 사유 없음'}}</small></RouterLink><span class="badge" :class="levelClass[e.level]||'safe'">{{e.levelLabel}}</span><span class="sc">{{score(e.score)}}</span></li></ol>
</section></template>
