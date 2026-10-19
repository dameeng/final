<script setup lang="ts">
import AdminIdentity from '../components/AdminIdentity.vue'
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/verify.js'
import '../styles/verify.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('verify',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-verify">
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
<a href="/verify" aria-current="page"><span>수동 판별</span><span class="count" aria-label="처리 필요 2건">2</span></a>
<a href="/cs-customers"><span>고객 서비스</span><span class="count" aria-label="처리 필요 2건">2</span></a>
<a href="/bot-stats"><span>챗봇</span></a>
<a href="/logs"><span>로그</span></a>
  </nav>
  <div class="side-bot"><a href="/index">전체 관리자 화면</a><RouterLink to="/admin-app/screen-3">관리자 앱</RouterLink><RouterLink to="/">고객페이지</RouterLink><RouterLink to="/customer-app/screen-5">고객 앱</RouterLink></div>
</aside>

<main class="page">
  <div class="crumb"><span>수동 판별</span><span class="note"></span></div>
<div class="page-head"><h1>수동 판별</h1><div class="row"><button type="button" class="btn sm" id="sim" title="와이어프레임 확인용" hidden="hidden">: 새 건 도착</button></div></div>
<nav class="tabs" role="tablist" aria-label="판별 구분"><button type="button" role="tab" id="tab-q" aria-selected="true">대기 <span class="count" id="cnt">4</span></button><button type="button" role="tab" id="tab-h" aria-selected="false">처리 이력</button><button type="button" role="tab" id="tab-m" aria-selected="false" hidden="hidden">미인식·미수신 <span class="count" id="cnt-m">3</span></button></nav>

<section id="sec-q" aria-labelledby="tab-q">
<div class="filters" role="search">
<select id="f-site" aria-label="지하차도"><option value="">지하차도 전체</option><option>초량1지하차도</option><option>초량2지하차도</option><option>우장춘지하차도</option><option>범천지하차도</option><option>문현지하차도</option></select>
<span class="sub inl-6d00061700">위험 단계가 높은 지하차도 건이 먼저 보여요 · 1분 안에 처리하지 않으면 자동으로 넘어가요 · 숫자 칸에서 Enter = 확정 · 새 건은 자동으로 나타나요</span>
</div>
<div class="pgrid" id="grid">
<article class="pcard" data-sec="52" data-site="초량1지하차도" data-orig="12가 3456">
<div class="pmeta"><strong>초량1지하차도</strong></div>
<div class="pimg">번호판 부분만 확대 (잘라서 전송)</div>
<div class="timer" role="timer" aria-label="남은 시간"><div class="bar"><b></b></div><span class="tl-txt"></span></div>
<input class="plate" value="12가 3456" aria-label="인식된 번호판 (수정 가능)" />
<div class="pbtns"><button type="button" class="btn sm b-ok">맞음</button><button type="button" class="btn sm primary b-fix" disabled>수정 후 확정</button><button type="button" class="btn sm b-no">판별 불가</button></div>
</article>
<article class="pcard" data-sec="41" data-site="초량2지하차도" data-orig="34나 7788">
<div class="pmeta"><strong>초량2지하차도</strong><span class="low">인식 신뢰도 낮음</span></div>
<div class="pimg">번호판 부분만 확대 (잘라서 전송)</div>
<div class="timer" role="timer" aria-label="남은 시간"><div class="bar"><b></b></div><span class="tl-txt"></span></div>
<input class="plate" value="34나 7788" aria-label="인식된 번호판 (수정 가능)" />
<div class="pbtns"><button type="button" class="btn sm b-ok">맞음</button><button type="button" class="btn sm primary b-fix" disabled>수정 후 확정</button><button type="button" class="btn sm b-no">판별 불가</button></div>
</article>
<article class="pcard" data-sec="28" data-site="초량1지하차도" data-orig="56다 1029">
<div class="pmeta"><strong>초량1지하차도</strong></div>
<div class="pimg">번호판 부분만 확대 (잘라서 전송)</div>
<div class="timer" role="timer" aria-label="남은 시간"><div class="bar"><b></b></div><span class="tl-txt"></span></div>
<input class="plate" value="56다 1029" aria-label="인식된 번호판 (수정 가능)" />
<div class="pbtns"><button type="button" class="btn sm b-ok">맞음</button><button type="button" class="btn sm primary b-fix" disabled>수정 후 확정</button><button type="button" class="btn sm b-no">판별 불가</button></div>
</article>
<article class="pcard" data-sec="9" data-site="우장춘지하차도" data-orig="78라 4411">
<div class="pmeta"><strong>우장춘지하차도</strong><span class="low">인식 신뢰도 낮음</span></div>
<div class="pimg">번호판 부분만 확대 (잘라서 전송)</div>
<div class="timer" role="timer" aria-label="남은 시간"><div class="bar"><b></b></div><span class="tl-txt"></span></div>
<input class="plate" value="78라 4411" aria-label="인식된 번호판 (수정 가능)" />
<div class="pbtns"><button type="button" class="btn sm b-ok">맞음</button><button type="button" class="btn sm primary b-fix" disabled>수정 후 확정</button><button type="button" class="btn sm b-no">판별 불가</button></div>
</article>
</div>
<div id="empty" class="empty" hidden><strong>대기 중인 판별이 없어요.</strong><br />새 건이 들어오면 여기에 자동으로 나타나요.</div>
</section>

<section id="sec-h" hidden aria-labelledby="tab-h">
<div class="tbl-wrap"><table class="tbl inl-af5b40819b" id="htbl"><thead><tr><th>처리 시각</th><th>지하차도</th><th>인식 번호</th><th>확정 번호</th><th>결과</th><th>처리자</th></tr></thead><tbody>
<tr><td>10:12</td><td>초량1지하차도</td><td>11가 2200</td><td>11가 2200</td><td><span class="stat done">맞음</span></td><td>○○○</td></tr>
<tr><td>10:05</td><td>초량2지하차도</td><td>66바 9013</td><td>68바 9013</td><td><span class="stat work">수정</span></td><td>○○○</td></tr>
<tr><td>09:48</td><td>우장춘지하차도</td><td>23사 4410</td><td>-</td><td><span class="stat">시간 초과 · 자동 넘김</span></td><td>시스템</td></tr></tbody></table></div>
<p class="sub">처리 이력은 로그의 ‘판별 처리’에서도 볼 수 있어요. 시간 초과로 넘어간 건도 이력에 남아요. 이미지는 번호판만 잘라서 보관돼요.</p>
</section>

<div id="toast" class="toast" hidden role="status"></div>

</main>


<div id="sec-m" hidden></div>
</div></template>
