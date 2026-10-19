<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {useApp} from '../stores/app'
import '../styles/admin-app-10.css'
const router=useRouter(),store=useApp();const weather=ref(false)
const clock=ref(Date.now());let timer:number|undefined
onMounted(()=>{timer=window.setInterval(()=>clock.value=Date.now(),1000)})
onBeforeUnmount(()=>clearInterval(timer))
</script>
<template><div class="wire-page mobile-page page-admin-app-10"><div class="ph adm"><div class="ah"><span>← 설비 상세</span><span class="inl-683edd9226"></span><a class="app-bell" href="/admin-app/screen-13">알림</a><button class="theme-toggle" type="button" aria-label="라이트·다크 전환" @click="store.themeToggle()">◐</button></div><div v-if="store.bannerAt > 0 &amp;&amp; clock-store.bannerAt&lt;300000" class="urgent-app-banner" role="alert">초량1지하차도 위험 · 통제 상태를 확인하세요.</div><div class="bd"><div class="card inl-13313b1a3a"><div><b class="inl-5e0faad207">P-01 배수펌프</b><div class="sub">초량1지하차도</div></div><div class="inl-54c2afb7ba"><b class="inl-81351bd1ac">82</b><span class="sub"> /100</span><br /><span class="lv d">위험</span></div></div><div class="card"><h4>헬스 인디케이터</h4><div class="health-indicator"><strong>점검 필요</strong><p>모터 전류 상승 · 기동 오류 증가</p></div></div><div class="card"><h4>판단 근거</h4><div class="row"><div class="g">모터 전류 +34%</div><b>+30</b></div><div class="row"><div class="g">기동 오류 7회</div><b>+25</b></div><div class="row"><div class="g">배수 응답 24초</div><b>+15</b></div></div><button class="btn p inl-26d3d1951d" type="button" @click="router.push('/admin-app/screen-12')">점검 등록</button></div><div class="tb"><a class="" href="/admin-app/screen-3"><b>▦</b>현황</a><a class="" href="/admin-app/screen-4"><b>◼</b>통제</a><a class="on" href="/admin-app/screen-9"><b>⚙</b>예지보전</a><a class="" href="/admin-app/screen-13"><b>◔</b>알림</a><a class="" href="/admin-app/screen-14"><b>☰</b>더보기</a></div></div></div></template>