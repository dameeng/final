<script setup lang="ts">
import AdminIdentity from '../components/AdminIdentity.vue'
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/logs.js'
import '../styles/logs.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('logs',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-logs">
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
<a href="/cs-customers"><span>고객 서비스</span><span class="count" aria-label="처리 필요 2건">2</span></a>
<a href="/bot-stats"><span>챗봇</span></a>
<a href="/logs" aria-current="page"><span>로그</span></a>
  </nav>
  <div class="side-bot"><RouterLink to="/admin-app/screen-3">관리자 앱</RouterLink><RouterLink to="/">고객페이지</RouterLink><RouterLink to="/customer-app/screen-5">고객 앱</RouterLink></div>
</aside>

<main class="page">
  <div class="crumb"><span>로그</span><span class="note"></span></div>
<div class="page-head"><h1>로그</h1><div class="row"><button type="button" class="btn inl-70da9b2a07" disabled title="이번 범위에서는 보류">엑셀 내보내기</button></div></div>
<nav class="tabs scroll" role="tablist" aria-label="로그 분류"><button type="button" role="tab" class="ct" data-c="" aria-selected="true">전체</button><button type="button" role="tab" class="ct" data-c="통제" aria-selected="false">통제</button><button type="button" role="tab" class="ct" data-c="위험 단계 변화" aria-selected="false">위험 단계 변화</button><button type="button" role="tab" class="ct" data-c="알림 발송" aria-selected="false">알림 발송</button><button type="button" role="tab" class="ct" data-c="전광판 표출" aria-selected="false">전광판 표출</button><button type="button" role="tab" class="ct" data-c="판별 처리" aria-selected="false">판별 처리</button><button type="button" role="tab" class="ct" data-c="설비·점검" aria-selected="false">설비·점검</button><button type="button" role="tab" class="ct" data-c="설정 변경" aria-selected="false">설정 변경</button></nav>
<div class="filters" role="search">
<select id="facility-filter" aria-label="지하차도"><option value="">지하차도 전체</option><option>초량1지하차도</option><option>초량2지하차도</option><option>우장춘지하차도</option><option>범천지하차도</option><option>문현지하차도</option></select>
<input type="date" aria-label="시작일" class="inl-99fb937df8" /> <span>~</span> <input type="date" aria-label="종료일" class="inl-99fb937df8" />
<input type="search" id="q" placeholder="내용 검색" aria-label="내용 검색" />
<span class="sub inl-6d00061700" id="cnt"></span>
</div>
<div class="tbl-wrap"><table class="tbl inl-7f783bd135" id="tbl"><thead><tr><th class="inl-60746827b0">일시</th><th class="inl-c6fffdfe96">분류</th><th>지하차도</th><th>내용</th><th>처리자</th></tr></thead><tbody>
<tr data-cat="위험 단계 변화" data-text="초량1지하차도 주의 → 위험 (76.4점)"><td>10:42</td><td><span class="cat">위험 단계 변화</span></td><td>초량1지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="0">주의 → 위험 (76.4점)</button></td><td>시스템</td></tr>
<tr data-cat="통제" data-text="초량1지하차도 입구 차단"><td>10:37</td><td><span class="cat">통제</span></td><td>초량1지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="1">입구 차단</button></td><td>시스템</td></tr>
<tr data-cat="전광판 표출" data-text="초량1지하차도 “침수 위험 · 진입 금지” 표출"><td>10:31</td><td><span class="cat">전광판 표출</span></td><td>초량1지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="2">“침수 위험 · 진입 금지” 표출</button></td><td>시스템</td></tr>
<tr data-cat="설비·점검" data-text="초량1지하차도 P-01 배수펌프 위험 진입 (82점)"><td>10:20</td><td><span class="cat">설비·점검</span></td><td>초량1지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="3">P-01 배수펌프 위험 진입 (82점)</button></td><td>시스템</td></tr>
<tr data-cat="알림 발송" data-text="부산 전체 앱푸시 · 위험 단계 알림 1,203명"><td>10:02</td><td><span class="cat">알림 발송</span></td><td>부산 전체</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="4">앱푸시 · 위험 단계 알림 1,203명</button></td><td>시스템</td></tr>
<tr data-cat="판별 처리" data-text="초량2지하차도 66바 9013 → 68바 9013 수정"><td>09:48</td><td><span class="cat">판별 처리</span></td><td>초량2지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="5">66바 9013 → 68바 9013 수정</button></td><td>○○○</td></tr>
<tr data-cat="통제" data-text="초량2지하차도 통제 해제"><td>09:40</td><td><span class="cat">통제</span></td><td>초량2지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="6">통제 해제</button></td><td>○○○</td></tr>
<tr data-cat="전광판 표출" data-text="초량1지하차도 “호우 주의 · 서행” 수동 표출"><td>09:20</td><td><span class="cat">전광판 표출</span></td><td>초량1지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="7">“호우 주의 · 서행” 수동 표출</button></td><td>○○○</td></tr>
<tr data-cat="설정 변경" data-text="초량1지하차도 침수 임계치 변경"><td>09:05</td><td><span class="cat">설정 변경</span></td><td>초량1지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="8">침수 임계치 변경</button></td><td>○○○</td></tr>
<tr data-cat="설비·점검" data-text="범천지하차도 P-04 점검 등록 · 벨트 장력 확인"><td>08:50</td><td><span class="cat">설비·점검</span></td><td>범천지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="9">P-04 점검 등록 · 벨트 장력 확인</button></td><td>○○○</td></tr>
<tr data-cat="위험 단계 변화" data-text="우장춘지하차도 안전 → 주의 (52.1점)"><td>08:30</td><td><span class="cat">위험 단계 변화</span></td><td>우장춘지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="10">안전 → 주의 (52.1점)</button></td><td>시스템</td></tr>
<tr data-cat="알림 발송" data-text="부산 전체 앱푸시 · 공지 “시스템 점검 안내” 1,180명"><td>08:12</td><td><span class="cat">알림 발송</span></td><td>부산 전체</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="11">앱푸시 · 공지 “시스템 점검 안내” 1,180명</button></td><td>○○○</td></tr>
<tr data-cat="설비·점검" data-text="범천지하차도 P-04 점검 시작"><td>어제 17:40</td><td><span class="cat">설비·점검</span></td><td>범천지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="12">P-04 점검 시작</button></td><td>○○○</td></tr>
<tr data-cat="설정 변경" data-text="설비 기준 배수펌프 기동 오류 기준 변경"><td>어제 16:20</td><td><span class="cat">설정 변경</span></td><td>설비 기준</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="13">배수펌프 기동 오류 기준 변경</button></td><td>○○○</td></tr>
<tr data-cat="판별 처리" data-text="초량1지하차도 11가 2200 맞음"><td>어제 15:02</td><td><span class="cat">판별 처리</span></td><td>초량1지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="14">11가 2200 맞음</button></td><td>○○○</td></tr>
<tr data-cat="통제" data-text="부산진시장지하차도 입구 차단"><td>어제 14:10</td><td><span class="cat">통제</span></td><td>부산진시장지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="15">입구 차단</button></td><td>○○○</td></tr>
<tr data-cat="위험 단계 변화" data-text="부산진시장지하차도 주의 → 위험 (72.0점)"><td>어제 13:55</td><td><span class="cat">위험 단계 변화</span></td><td>부산진시장지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="16">주의 → 위험 (72.0점)</button></td><td>시스템</td></tr>
<tr data-cat="전광판 표출" data-text="초량2지하차도 자동 표출 복귀"><td>어제 11:30</td><td><span class="cat">전광판 표출</span></td><td>초량2지하차도</td><td><button type="button" class="link row-open inl-7acbdc00e7" data-i="17">자동 표출 복귀</button></td><td>○○○</td></tr>
</tbody></table></div>
<div class="pager" aria-label="페이지"><button type="button" class="btn sm">←</button><button type="button" class="btn sm" aria-current="page">1</button><button type="button" class="btn sm">2</button><button type="button" class="btn sm">3</button><button type="button" class="btn sm">→</button></div>
<p class="sub inl-91a87015f4">로그는 읽기 전용이에요. 행을 누르면 요약 서랍이 열리고, 해당 화면으로 이동할 수 있어요.</p>

<aside id="peek" class="drawer" hidden aria-label="로그 요약">
<div class="dh"><div><div class="sub" id="p-when"></div><h2 id="p-text" class="inl-5351578d8b"></h2><div class="row inl-8a77e5a311"><span class="cat" id="p-cat"></span></div></div><button type="button" class="btn sm" id="peek-close">닫기</button></div>
<div class="db"><div class="kv2"><div><small>대상</small><strong id="p-site"></strong></div><div><small>처리자</small><strong id="p-who"></strong></div></div>
<div id="p-diffw" hidden><h3 class="inl-15066bbcff">변경 내용</h3><div class="diff"><div><small class="sub">변경 전</small><br /><strong id="p-b"></strong></div><div><small class="sub">변경 후</small><br /><strong id="p-a"></strong></div></div></div>
<div class="row"><a class="btn inl-f5ab06f38b" id="p-go" href="#"></a></div></div></aside>

</main>


</div></template>
