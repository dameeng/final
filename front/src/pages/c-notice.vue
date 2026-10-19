<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/c-notice.js'
import '../styles/c-notice.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('c-notice',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-c-notice">
<header class="top"><div class="in"><a class="logo" href="/c-map">ROUTEL</a><nav><a href="/c-app" class="">About us</a><a href="/c-map" class="">지하차도 현황</a><a href="/c-notice" class="on">알림마당</a><a href="#" class="">연계사이트</a></nav><a class="btn p" href="/c-app#install">⬇ 앱 다운로드</a><a class="btn" href="/c-auth">로그인</a><a class="btn" href="/c-auth">회원가입</a></div></header>
<div class="wrap"><h1 class="inl-b4e8f67f18">공지사항</h1>

<div class="notice-list-layout"><section class="panel"><div class="sub inl-c81ce4b250">분류</div><div class="cc"><span class="on">전체</span><span>긴급</span><span>점검</span><span>업데이트</span><span>안내</span></div>
<div class="inl-e9f43dc0c6">제목·내용 검색</div><table><tbody><tr><td>📌 <span class="lvb d">긴급</span></td><td><b>우장춘지하차도 호우 통제 안내</b></td><td class="sub">10.13</td><td class="sub">조회 1,204</td></tr><tr><td>📌 <span class="lvb w">점검</span></td><td><b>시스템 정기 점검 안내 (10/15 02:00~04:00)</b></td><td class="sub">10.12</td><td class="sub">조회 842</td></tr><tr><td><span class="lvb  inl-c6cbda82f0">업데이트</span></td><td><b>앱 v1.1 업데이트 · 길 안내 추가</b></td><td class="sub">10.10</td><td class="sub">조회 516</td></tr><tr><td><span class="lvb  inl-c6cbda82f0">안내</span></td><td><b>위험 단계 기준 안내 (안전·주의·위험)</b></td><td class="sub">10.05</td><td class="sub">조회 390</td></tr><tr><td><span class="lvb  inl-c6cbda82f0">안내</span></td><td><b>휴대폰 번호 인증 방식으로 바뀌어요</b></td><td class="sub">10.03</td><td class="sub">조회 221</td></tr></tbody></table></section>
</div>
</div>
<footer class="foot"><div class="in"><a href="#">회사소개</a><a href="#">연계사이트</a><a href="#">이용약관</a><a href="#">개인정보처리방침</a></div></footer>
</div></template>
