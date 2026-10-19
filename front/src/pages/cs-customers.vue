<script setup lang="ts">
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/cs-customers.js'
import '../styles/cs-customers.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('cs-customers',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-cs-customers">
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
  <div class="crumb"><span>고객 서비스 &gt; 고객 조회</span><span class="note"></span></div>
<div class="page-head"><h1>고객 서비스</h1></div><nav class="tabs" aria-label="고객 서비스 탭"><a href="/cs-customers" aria-current="page">고객 조회</a><a href="/cs-inquiries">문의 처리 <span class="count">2</span></a><a href="/cs-content">공지·FAQ</a></nav>
<div class="filters" role="search"><input type="search" id="q" placeholder="이름, 이메일 검색" aria-label="검색" /><select aria-label="알림 수신"><option>알림 수신 전체</option><option>켜짐</option><option>꺼짐</option></select><span class="sub inl-6d00061700" id="cnt">총 8명</span></div>
<div class="tbl-wrap"><table class="tbl" id="tbl"><thead><tr><th>이름</th><th>이메일</th><th>가입일</th><th>등록 차량</th><th>문의</th><th>푸시 알림</th></tr></thead><tbody>
<tr data-text="김○○ kim***@example.com"><td><button type="button" class="link row-open" data-i="0">김○○</button></td><td>kim***@example.com</td><td>2026-09-02</td><td>2대</td><td>1건</td><td>켜짐</td></tr>
<tr data-text="이○○ lee***@example.com"><td><button type="button" class="link row-open" data-i="1">이○○</button></td><td>lee***@example.com</td><td>2026-09-05</td><td>1대</td><td>0건</td><td>켜짐</td></tr>
<tr data-text="박○○ park**@example.com"><td><button type="button" class="link row-open" data-i="2">박○○</button></td><td>park**@example.com</td><td>2026-09-11</td><td>1대</td><td>2건</td><td><span class="sub">꺼짐</span></td></tr>
<tr data-text="최○○ choi**@example.com"><td><button type="button" class="link row-open" data-i="3">최○○</button></td><td>choi**@example.com</td><td>2026-09-14</td><td>3대</td><td>0건</td><td>켜짐</td></tr>
<tr data-text="정○○ jung**@example.com"><td><button type="button" class="link row-open" data-i="4">정○○</button></td><td>jung**@example.com</td><td>2026-09-18</td><td>1대</td><td>1건</td><td>켜짐</td></tr>
<tr data-text="강○○ kang**@example.com"><td><button type="button" class="link row-open" data-i="5">강○○</button></td><td>kang**@example.com</td><td>2026-09-22</td><td>0대</td><td>0건</td><td>켜짐</td></tr>
<tr data-text="조○○ jo***@example.com"><td><button type="button" class="link row-open" data-i="6">조○○</button></td><td>jo***@example.com</td><td>2026-09-25</td><td>1대</td><td>0건</td><td><span class="sub">꺼짐</span></td></tr>
<tr data-text="윤○○ yoon**@example.com"><td><button type="button" class="link row-open" data-i="7">윤○○</button></td><td>yoon**@example.com</td><td>2026-10-01</td><td>2대</td><td>0건</td><td>켜짐</td></tr>
</tbody></table></div>
<p class="sub">고객 정보는 <strong>조회만</strong> 가능해요. 정지·탈퇴 같은 계정 조치는 관리자 화면에서 하지 않아요.</p>
<aside id="peek" class="drawer" hidden aria-label="고객 요약">
<div class="dh"><div><div class="sub" id="p-mail"></div><h2 id="p-name" class="inl-85d138b8f7"></h2></div><button type="button" class="btn sm" id="peek-close">닫기</button></div>
<div class="db"><div class="kv2"><div><small>가입일</small><strong id="p-join"></strong></div><div><small>푸시 알림</small><strong id="p-push"></strong></div></div>
<div><h3 class="inl-15066bbcff">등록 차량</h3><ul class="list" id="p-cars"></ul></div>
<div><h3 class="inl-15066bbcff">최근 문의</h3><ul class="list" id="p-inq"></ul></div>
<div class="row"><a class="btn primary inl-97445a8d93" href="/cs-customer-detail">상세 보기 →</a></div></div></aside>
<div id="toast" class="toast" hidden role="status"></div>

</main>


</div></template>
