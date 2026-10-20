<script setup lang="ts">
import AdminSidebarLinks from '../components/AdminSidebarLinks.vue'
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/bot-stats.js'
import '../styles/bot-stats.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('bot-stats',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-bot-stats">
<header class="hdr">
  <div class="hdr-l">
    <button type="button" id="menu-btn" class="iconbtn" aria-label="메뉴 열기" aria-expanded="false" aria-controls="side"><MenuIcon/></button>
    <RouterLink class="inl-1444c6eaca admin-home-logo" to="/admin-dashboard" aria-label="종합 현황으로 이동">ROUTEL</RouterLink>
  </div>
  <div class="hdr-r">
    <div class="conn" role="status"><span class="dot" aria-hidden="true"></span><span>연결됨<small> · 마지막 수신 10:42</small></span><button type="button" class="btn sm">새로고침</button></div>
    <button type="button" id="bell-btn" class="iconbtn" aria-label="알림 3건 안 읽음" aria-expanded="false" aria-controls="bell-pop"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15L6 17z M10 21h4" fill="none" stroke="#1f2630" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path></svg><span id="bell-count" class="count">3</span></button>
    <span class="user">부산 · ○○○님</span>
  </div>
  <section id="bell-pop" class="bell-pop" hidden aria-label="최근 알림">
    <div class="pop-top"><strong>알림</strong><button type="button" id="read-all" class="btn sm">모두 읽음</button></div>
    <ul class="pop-list">
<li class="unread"><span class="cat">위험</span><span>초량1지하차도 위험 단계로 상승</span><span class="time">방금</span></li>
<li class="unread"><span class="cat">설비</span><span>P-01 배수펌프 위험 진입 (82점)</span><span class="time">5분 전</span></li>
<li class="unread"><span class="cat">고객</span><span>신규 문의 접수 · 알림이 오지 않아요</span><span class="time">12분 전</span></li>
<li><span class="cat">시스템</span><span>초량2지하차도 데이터 미수신 10분</span><span class="time">1시간 전</span></li>
<li><span class="cat">설비</span><span>D-03 전광판 주의 진입 (55점)</span><span class="time">2시간 전</span></li>
    </ul>
    <a class="pop-foot" href="#">전체 알림 보기</a>
  </section>
</header>

<div id="scrim" class="scrim" hidden></div>

<aside id="side" class="side" aria-label="관리자 메뉴">
  <div class="side-top"><strong>관리자 메뉴</strong><button type="button" id="menu-close" class="btn sm">닫기</button></div>
  <AdminIdentity/>
  <nav>
<a href="/admin-dashboard"><span>종합 현황</span></a>
<a href="/fac-list"><span>지하차도 관리</span></a>
<a href="/pm-equipment"><span>예지보전</span><span class="count" aria-label="처리 필요 3건">3</span></a>
<a href="/verify"><span>수동 판별</span><span class="count" aria-label="처리 필요 2건">2</span></a>
<a href="/cs-customers"><span>고객 서비스</span><span class="count" aria-label="처리 필요 2건">2</span></a>
<a href="/bot-stats" aria-current="page"><span>챗봇</span></a>
<a href="/logs"><span>로그</span></a>
  </nav>
  <AdminSidebarLinks/>
</aside>

<main class="page">
  <div class="crumb"><span>챗봇 &gt; 통계</span><span class="note"></span></div>
<div class="page-head"><h1>챗봇</h1></div><nav class="tabs" aria-label="챗봇 탭"><a href="/bot-logs">대화 로그</a><a href="/bot-stats" aria-current="page">통계</a></nav>
<div class="filters"><div class="seg" role="group" aria-label="기간"><button type="button" aria-pressed="false">오늘</button><button type="button" aria-pressed="true">최근 7일</button><button type="button" aria-pressed="false">최근 30일</button></div></div>
<div class="kpis"><div class="card"><small>대화 수</small><strong>302</strong></div><div class="card"><small>답변 성공률</small><strong>91%</strong></div><div class="card"><small>답변 못 한 질문</small><strong>27</strong></div><div class="card"><small>FAQ로 등록한 질문</small><strong>6</strong></div></div>
<div class="split"><section class="card inl-4ab3028043"><h2 class="inl-35cb4f5973">일별 대화 수</h2><div class="days"><div><small>38</small><i class="inl-14444b78a7"></i><small>06</small></div><div><small>42</small><i class="inl-e0c3139f94"></i><small>07</small></div><div><small>35</small><i class="inl-2131180ec8"></i><small>08</small></div><div><small>51</small><i class="inl-c178123b91"></i><small>09</small></div><div><small>47</small><i class="inl-117569e561"></i><small>10</small></div><div><small>60</small><i class="inl-6226406815"></i><small>11</small></div><div><small>29</small><i class="inl-c8c8771d5b"></i><small>12</small></div></div></section>
<section class="card inl-4ab3028043"><h2 class="inl-35cb4f5973">많이 물어본 질문 Top 5</h2><div class="bars"><div class="r"><span>우회로 보는 방법</span><span class="t"><i class="inl-0466783d98"></i></span><span>46회</span></div><div class="r"><span>번호판 등록</span><span class="t"><i class="inl-b576fac1de"></i></span><span>38회</span></div><div class="r"><span>알림 설정</span><span class="t"><i class="inl-7116cdf905"></i></span><span>31회</span></div><div class="r"><span>앱 설치</span><span class="t"><i class="inl-f144581099"></i></span><span>19회</span></div><div class="r"><span>위험 단계 의미</span><span class="t"><i class="inl-c66ff2c048"></i></span><span>14회</span></div></div></section></div><div id="toast" class="toast" hidden role="status"></div>
</main>


</div></template>
