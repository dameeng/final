<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref} from 'vue'
import '../styles/map-weather.css'
type Weather={temperature?:number|null;condition?:string;humidity?:number|null;rainfall?:number|null;observedAt?:string;hourly?:{time:string;temperature?:number;rainfall?:number}[]}
type Location={lat:number;lng:number;name:string;weather?:string;rainfall?:string}
const root=ref<HTMLElement>(),opened=ref(false),loading=ref(false),error=ref(''),location=ref<Location>({lat:35.1796,lng:129.0756,name:'부산'})
const example=import.meta.env.VITE_DATA_MODE!=='server'
const weather=ref<Weather|null>(example?{temperature:18.2,condition:'비',humidity:92,rainfall:18}:null)
const show=(value:number|null|undefined,unit:string)=>value==null?'—':`${value}${unit}`
const observation=computed(()=>{const value=weather.value?.observedAt;if(!value)return example?'예시 기상 정보':'관측 시각 미제공';const date=new Date(value);return Number.isNaN(date.getTime())?'관측 시각 미제공':date.toLocaleString('ko-KR')})
let parent:HTMLElement|null=null,request:AbortController|undefined
async function refresh(){
 request?.abort();error.value=''
 if(example){const value=location.value.weather||'비 · 18.2°C · 습도 92%';weather.value={condition:value.split('·')[0]?.trim(),temperature:Number(value.match(/(-?\d+(?:\.\d+)?)°/)?.[1]??18.2),humidity:Number(value.match(/습도\s*(\d+)/)?.[1]??92),rainfall:parseFloat(location.value.rainfall||'18')};return}
 const controller=new AbortController();request=controller;loading.value=true;weather.value=null
 try{const response=await fetch(`/api/weather?lat=${location.value.lat}&lng=${location.value.lng}`,{signal:controller.signal,cache:'no-store'});const body=await response.json();if(!response.ok||body?.success===false||!body?.data)throw Error('날씨를 불러오지 못했습니다.');if(!controller.signal.aborted)weather.value=body.data}catch(cause){if(!controller.signal.aborted)error.value=cause instanceof Error?cause.message:'날씨 연결을 확인해 주세요.'}finally{if(!controller.signal.aborted)loading.value=false}
}
function changed(event:Event){location.value=(event as CustomEvent<Location>).detail;void refresh()}
function outside(event:PointerEvent){if(!root.value?.contains(event.target as Node))opened.value=false}
onMounted(()=>{parent=root.value?.closest('.page-c-map')||null;parent?.addEventListener('map-weather-location',changed);document.addEventListener('pointerdown',outside);if(!example)void refresh()})
onBeforeUnmount(()=>{request?.abort();parent?.removeEventListener('map-weather-location',changed);document.removeEventListener('pointerdown',outside)})
</script>
<template><div ref="root" class="map-weather-widget" @keydown.esc="opened=false" @pointerdown.stop @wheel.stop>
 <section v-if="opened" id="map-weather-detail" class="map-weather-detail" aria-label="인근 날씨 상세"><header><strong>{{location.name}}</strong><button type="button" aria-label="날씨 상세 닫기" @click="opened=false">×</button></header><p v-if="loading" role="status">날씨를 확인하고 있습니다.</p><p v-else-if="error" role="status">{{error}}</p><template v-else-if="weather"><div class="map-weather-overview"><svg viewBox="0 0 48 40" width="55" height="48" aria-hidden="true"><path d="M13 30a10 10 0 1 1 1-20 13 13 0 0 1 25 5 8 8 0 0 1-1 16H13Z" fill="#bbcbd8"/><path v-if="/비|소나기/.test(weather.condition||'')" d="m16 34-2 4m12-4-2 4m12-4-2 4" stroke="#4d8ed3" stroke-width="3" stroke-linecap="round"/></svg><div><b>{{show(weather.temperature,'°')}}</b><span>{{weather.condition||'기상 상태 미제공'}}</span></div></div><dl><div><dt>습도</dt><dd>{{show(weather.humidity,'%')}}</dd></div><div><dt>강우량</dt><dd>{{show(weather.rainfall,' mm')}}</dd></div></dl><div class="map-weather-hourly" v-if="weather.hourly?.length"><h3>시간별 예보</h3><ul><li v-for="hour in weather.hourly.slice(0,6)" :key="hour.time"><span>{{new Date(hour.time).getHours()}}시</span><b>{{show(hour.temperature,'°')}}</b><small>{{show(hour.rainfall,' mm')}}</small></li></ul></div><footer>{{observation}}</footer></template></section>
 <button type="button" class="map-weather-marker" :aria-expanded="opened" aria-controls="map-weather-detail" @click="opened=!opened"><svg viewBox="0 0 40 32" width="32" height="28" aria-hidden="true"><path d="M11 26a8 8 0 1 1 0-16 11 11 0 0 1 21 4 6 6 0 0 1-1 12H11Z" fill="#afc3d3"/></svg><span><strong>{{show(weather?.temperature,'°')}}</strong><small>{{loading?'조회 중':weather?.condition||'날씨'}}{{example?' · 예시':''}}</small></span><span aria-hidden="true">{{opened?'⌄':'⌃'}}</span></button>
</div></template>
