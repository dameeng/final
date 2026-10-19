<script setup lang="ts">
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/cs-inquiry-detail.js'
import '../styles/cs-inquiry-detail.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('cs-inquiry-detail',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-cs-inquiry-detail">
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
  <div class="crumb"><span>고객 서비스 &gt; 문의 처리 &gt; <strong class="inl-7891572d91">#1042</strong></span><span class="note"></span></div>
<div class="page-head"><div><h1>알림이 오지 않아요</h1><div class="sub">#1042 · 김○○ · 2026-10-11 10:30</div></div><div class="row"><a class="btn" href="/cs-inquiries">← 목록으로</a><button type="button" class="btn">이전 문의</button><button type="button" class="btn">다음 문의</button></div></div><nav class="tabs" aria-label="고객 서비스 탭"><a href="/cs-customers">고객 조회</a><a href="/cs-inquiries" aria-current="page">문의 처리 <span class="count">2</span></a><a href="/cs-content">공지·FAQ</a></nav>
<div class="split inl-3f367c0031">
<section class="card inl-144354d7e8"><div class="row inl-d2d053eb22"><h2>문의 내용</h2><span class="cat">알림</span></div><div class="body-txt">위험 알림을 켜놨는데 어제부터 푸시가 안 와요. 앱을 다시 설치해도 마찬가지예요.</div>
<h3 class="inl-e47f8bb883">고객 정보</h3><div class="kv2"><div><small>고객</small><strong>김○○</strong></div><div><small>푸시 알림</small><strong>켜짐</strong></div></div><a href="/cs-customer-detail" class="inl-8c57d580c5">고객 상세 보기</a></section>
<section class="card inl-144354d7e8"><div class="row inl-d2d053eb22"><h2>답변</h2><span class="stat new" id="st">미답변</span></div>
<div class="field"><label for="ans">답변 내용</label><textarea id="ans" placeholder="고객에게 보낼 답변을 입력하세요." class="inl-b9666ec1f9"></textarea></div>
<label class="inl-0ec57706e6"><input type="checkbox" checked /> 답변 등록 시 고객에게 알림 보내기</label>
<div class="row inl-455f8cca6d"><button type="button" class="btn" id="tmpl">자주 쓰는 답변 불러오기</button><button type="button" class="btn primary" id="reply">답변 등록</button></div>
<p class="hint inl-c94d43e279">고객이 알림을 꺼둔 경우 알림은 가지 않고 마이페이지 ‘내 문의’에서만 확인돼요.</p></section>
</div>
<div id="toast" class="toast" hidden role="status"></div>

</main>


</div></template>
