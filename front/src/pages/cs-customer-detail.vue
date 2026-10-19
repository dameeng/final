<script setup lang="ts">
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/cs-customer-detail.js'
import '../styles/cs-customer-detail.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('cs-customer-detail',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-cs-customer-detail">
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
<a href="/cs-customers" aria-current="page"><span>고객 서비스</span><span class="count" aria-label="처리 필요 2건">2</span></a>
<a href="/bot-stats"><span>챗봇</span></a>
<a href="/logs"><span>로그</span></a>
  </nav>
  <div class="side-bot"><a href="/index">전체 관리자 화면</a><RouterLink to="/admin-app/screen-3">관리자 앱</RouterLink><RouterLink to="/">고객페이지</RouterLink><RouterLink to="/customer-app/screen-5">고객 앱</RouterLink></div>
</aside>

<main class="page">
  <div class="crumb"><span>고객 서비스 &gt; 고객 조회 &gt; <strong class="inl-7891572d91">김○○</strong></span><span class="note"></span></div>
<div class="page-head"><div><h1>김○○</h1><div class="sub">kim***@example.com</div></div><div class="row"><a class="btn" href="/cs-customers">← 목록으로</a><button type="button" class="btn">이전 고객</button><button type="button" class="btn">다음 고객</button></div></div><nav class="tabs" aria-label="고객 서비스 탭"><a href="/cs-customers" aria-current="page">고객 조회</a><a href="/cs-inquiries">문의 처리 <span class="count">2</span></a><a href="/cs-content">공지·FAQ</a></nav>
<div class="grid2 inl-cf6708c951">
<section class="card"><h2 class="inl-da12f2858b">가입 정보</h2><div class="kv2"><div><small>이름</small><strong>김○○</strong></div><div><small>가입일</small><strong>2026-09-02</strong></div><div><small>연락처</small><strong>010-****-1234</strong></div><div><small>최근 로그인</small><strong>2026-10-11 09:12</strong></div></div></section>
<section class="card"><h2 class="inl-da12f2858b">알림 수신 설정</h2><ul class="list"><li><span>푸시 알림 전체</span><strong>켜짐</strong></li><li><span>지하차도 위험 알림</span><strong>켜짐</strong></li><li><span>공지 알림</span><strong>켜짐</strong></li><li><span>문의 답변 알림</span><strong>켜짐</strong></li></ul><p class="hint inl-c94d43e279">고객이 직접 설정한 값이에요. 관리자는 바꿀 수 없어요.</p></section>
</div>
<section class="card inl-1b0f4999d2"><h2 class="inl-fdf33f2304">등록 차량</h2><div class="tbl-wrap inl-bb0c09db77"><table class="tbl inl-e154f60266"><thead><tr><th>차량 번호</th><th>등록일</th><th>최근 알림</th></tr></thead><tbody><tr><td><strong>12가 3456</strong></td><td>2026-09-02</td><td>2026-10-11 10:02 · 위험 알림</td></tr><tr><td><strong>34나 7788</strong></td><td>2026-09-20</td><td>-</td></tr></tbody></table></div></section>
<section class="card inl-1b0f4999d2"><div class="row inl-a562f4fd76"><h2>문의 내역</h2><a href="/cs-inquiries" class="inl-dea29d3fa0">문의 처리로 이동</a></div><ul class="list inl-8a77e5a311"><li><a class="link inl-c41fc90003" href="/cs-inquiry-detail">알림이 오지 않아요</a><span class="stat new">미답변</span></li></ul></section>

</main>


</div></template>
