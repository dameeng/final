<script setup lang="ts">
import AdminSidebarLinks from '../components/AdminSidebarLinks.vue'
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/notifications.js'
import '../styles/notifications.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('notifications',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-notifications">
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
<a href="/bot-stats"><span>챗봇</span></a>
<a href="/logs"><span>로그</span></a>
  </nav>
  <AdminSidebarLinks/>
</aside>

<main class="page">
  <div class="crumb"><span>알림 센터</span><span class="note"></span></div>
<div class="page-head"><h1>알림 센터</h1><div class="row"><label class="inl-6146cae132"><input type="checkbox" id="only" /> 안 읽은 알림만</label><button type="button" class="btn" id="readall">모두 읽음</button></div></div>
<nav class="tabs" role="tablist" aria-label="알림 분류"><button type="button" role="tab" class="nt" data-c="" aria-selected="true">전체 <span class="count" data-k="전체"></span></button><button type="button" role="tab" class="nt" data-c="위험" aria-selected="false">위험 <span class="count" data-k="위험"></span></button><button type="button" role="tab" class="nt" data-c="설비" aria-selected="false">설비 <span class="count" data-k="설비"></span></button><button type="button" role="tab" class="nt" data-c="업무" aria-selected="false">고객 <span class="count" data-k="업무"></span></button><button type="button" role="tab" class="nt" data-c="시스템" aria-selected="false">시스템 <span class="count" data-k="시스템"></span></button></nav>
<ul class="nlist" id="nl">
<li class="unread" data-cat="위험"><button type="button" class="n" data-href="fac-detail.html#overview"><span class="ud" aria-hidden="true"></span><span class="cat">위험</span><span class="t">초량1지하차도 위험 단계로 상승</span><span class="sub">방금</span></button><a class="go" href="/fac-detail#overview">이동</a></li>
<li class="unread" data-cat="설비"><button type="button" class="n" data-href="pm-queue.html"><span class="ud" aria-hidden="true"></span><span class="cat">설비</span><span class="t">P-01 배수펌프 위험 진입 (82점)</span><span class="sub">5분 전</span></button><a class="go" href="/pm-queue">이동</a></li>
<li class="unread" data-cat="업무"><button type="button" class="n" data-href="#"><span class="ud" aria-hidden="true"></span><span class="cat">고객</span><span class="t">신규 문의 접수 · 알림이 오지 않아요</span><span class="sub">12분 전</span></button><a class="go" href="#">이동</a></li>
<li data-cat="시스템"><button type="button" class="n" data-href="fac-detail.html#overview"><span class="ud" aria-hidden="true"></span><span class="cat">시스템</span><span class="t">초량2지하차도 데이터 미수신 10분</span><span class="sub">1시간 전</span></button><a class="go" href="/fac-detail#overview">이동</a></li>
<li data-cat="설비"><button type="button" class="n" data-href="pm-queue.html"><span class="ud" aria-hidden="true"></span><span class="cat">설비</span><span class="t">D-03 전광판 주의 진입 (55점)</span><span class="sub">2시간 전</span></button><a class="go" href="/pm-queue">이동</a></li>
<li data-cat="위험"><button type="button" class="n" data-href="fac-detail.html#overview"><span class="ud" aria-hidden="true"></span><span class="cat">위험</span><span class="t">부산진시장지하차도 주의 → 위험</span><span class="sub">어제 13:55</span></button><a class="go" href="/fac-detail#overview">이동</a></li>
<li data-cat="업무"><button type="button" class="n" data-href="#"><span class="ud" aria-hidden="true"></span><span class="cat">고객</span><span class="t">신규 문의 접수 · 번호판 등록 오류</span><span class="sub">어제 11:20</span></button><a class="go" href="#">이동</a></li>
<li data-cat="설비"><button type="button" class="n" data-href="pm-queue.html"><span class="ud" aria-hidden="true"></span><span class="cat">설비</span><span class="t">C-05 CCTV 데이터 미수신 (1시간 30분)</span><span class="sub">어제 09:30</span></button><a class="go" href="/pm-queue">이동</a></li>
<li data-cat="시스템"><button type="button" class="n" data-href="#"><span class="ud" aria-hidden="true"></span><span class="cat">시스템</span><span class="t">데이터 연결 복구</span><span class="sub">어제 08:02</span></button><a class="go" href="#">이동</a></li>
</ul>
<div id="empty" class="empty inl-56f4356299" hidden>표시할 알림이 없어요.</div>
<p class="sub">항목을 누르면 읽음 처리되고 해당 화면으로 이동해요. 알림은 설정에서 끌 수 없어요. 모든 이벤트의 기록은 로그에서 볼 수 있어요.</p>
<div id="toast" class="toast" hidden role="status"></div>

</main>


</div></template>
