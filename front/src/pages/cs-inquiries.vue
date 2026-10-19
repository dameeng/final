<script setup lang="ts">
import AdminIdentity from '../components/AdminIdentity.vue'
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/cs-inquiries.js'
import '../styles/cs-inquiries.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('cs-inquiries',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-cs-inquiries">
<header class="hdr">
  <div class="hdr-l">
    <button type="button" id="menu-btn" class="iconbtn" aria-label="메뉴 열기" aria-expanded="false" aria-controls="side"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M3 6H21 M3 12H21 M3 18H21" fill="none" stroke="#1f2630" stroke-width="2" stroke-linecap="round"></path></svg></button>
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
  <div class="crumb"><span>고객 서비스 &gt; 문의 처리</span><span class="note"></span></div>
<div class="page-head"><h1>고객 서비스</h1></div><nav class="tabs" aria-label="고객 서비스 탭"><a href="/cs-customers">고객 조회</a><a href="/cs-inquiries" aria-current="page">문의 처리 <span class="count">2</span></a><a href="/cs-content">공지·FAQ</a></nav>
<div class="filters" role="search"><div class="chips" id="stc" role="group" aria-label="처리 상태"><button type="button" class="chip" data-s="" aria-pressed="true">전체 <span class="sub">6</span></button><button type="button" class="chip" data-s="미답변" aria-pressed="false">미답변 <span class="sub">2</span></button><button type="button" class="chip" data-s="답변 완료" aria-pressed="false">답변 완료 <span class="sub">4</span></button></div>
<select aria-label="분류"><option>분류 전체</option><option>알림</option><option>번호판</option><option>앱 오류</option><option>기타</option></select><input type="search" id="q" placeholder="제목, 고객 검색" aria-label="검색" /></div>
<div class="tbl-wrap"><table class="tbl" id="tbl"><thead><tr><th>번호</th><th>분류</th><th>제목</th><th>고객</th><th>접수</th><th>상태</th></tr></thead><tbody>
<tr data-st="미답변" data-text="알림이 오지 않아요 김○○"><td>1042</td><td><span class="cat">알림</span></td><td><button type="button" class="link row-open inl-daddc535e8" data-i="0">알림이 오지 않아요</button></td><td>김○○</td><td>10:30</td><td><span class="stat new">미답변</span></td></tr>
<tr data-st="미답변" data-text="번호판 등록 오류 박○○"><td>1041</td><td><span class="cat">번호판</span></td><td><button type="button" class="link row-open inl-daddc535e8" data-i="1">번호판 등록 오류</button></td><td>박○○</td><td>10:05</td><td><span class="stat new">미답변</span></td></tr>
<tr data-st="답변 완료" data-text="앱 로그인 문제 박○○"><td>1040</td><td><span class="cat">앱 오류</span></td><td><button type="button" class="link row-open inl-daddc535e8" data-i="2">앱 로그인 문제</button></td><td>박○○</td><td>어제 17:20</td><td><span class="stat done">답변 완료</span></td></tr>
<tr data-st="답변 완료" data-text="위험 알림 시간대 문의 정○○"><td>1039</td><td><span class="cat">알림</span></td><td><button type="button" class="link row-open inl-daddc535e8" data-i="3">위험 알림 시간대 문의</button></td><td>정○○</td><td>어제 14:02</td><td><span class="stat done">답변 완료</span></td></tr>
<tr data-st="답변 완료" data-text="우회 경로 기능 문의 이○○"><td>1038</td><td><span class="cat">기타</span></td><td><button type="button" class="link row-open inl-daddc535e8" data-i="4">우회 경로 기능 문의</button></td><td>이○○</td><td>어제 11:40</td><td><span class="stat done">답변 완료</span></td></tr>
<tr data-st="답변 완료" data-text="차량 삭제는 어떻게 하나요 최○○"><td>1037</td><td><span class="cat">번호판</span></td><td><button type="button" class="link row-open inl-daddc535e8" data-i="5">차량 삭제는 어떻게 하나요</button></td><td>최○○</td><td>10-09</td><td><span class="stat done">답변 완료</span></td></tr>
</tbody></table></div>
<aside id="peek" class="drawer" hidden aria-label="문의 요약">
<div class="dh"><div><div class="sub" id="p-meta"></div><h2 id="p-title" class="inl-5351578d8b"></h2><div class="row inl-8a77e5a311"><span class="cat" id="p-cat"></span><span class="stat" id="p-st"></span></div></div><button type="button" class="btn sm" id="peek-close">닫기</button></div>
<div class="db"><div><h3 class="inl-15066bbcff">문의 내용</h3><div class="body-txt" id="p-body"></div></div>
<div class="row"><a class="btn primary inl-97445a8d93" id="p-go" href="/cs-inquiry-detail">답변하기 →</a></div></div></aside>
<div id="toast" class="toast" hidden role="status"></div>

</main>


</div></template>
