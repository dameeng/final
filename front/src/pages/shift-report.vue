<script setup lang="ts">
import {useApp} from '../stores/app'
const app=useApp();function print(){window.print()}
</script>
<template><main class="shift-report"><header><h1>ROUTEL 근무 인수인계</h1><button @click="print">내보내기 · PDF로 저장</button><RouterLink to="/shift-login">닫기</RouterLink></header><section><h2>직전 근무조</h2><p>박○○ · 06:00~14:00</p><dl><dt>통제</dt><dd>1건</dd><dt>위험 상승</dt><dd>3건</dd><dt>점검</dt><dd>2건</dd></dl></section><section><h2>미처리 점검 대상</h2><RouterLink to="/pm-queue">점검 대상 확인</RouterLink></section><section><h2>업무 기록</h2><p v-for="(e,i) in app.events" :key="i">{{e.time}} · {{e.category}} · {{e.content}}</p></section></main></template>
