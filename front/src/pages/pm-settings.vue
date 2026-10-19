<script setup lang="ts">
import AdminIdentity from '../components/AdminIdentity.vue'
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/pm-settings.js'
import '../styles/pm-settings.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('pm-settings',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-pm-settings">
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
<a href="/pm-equipment" aria-current="page"><span>예지보전</span><span class="count" aria-label="처리 필요 3건">3</span></a>
<a href="/verify"><span>수동 판별</span><span class="count" aria-label="처리 필요 2건">2</span></a>
<a href="/cs-customers"><span>고객 서비스</span><span class="count" aria-label="처리 필요 2건">2</span></a>
<a href="/bot-stats"><span>챗봇</span></a>
<a href="/logs"><span>로그</span></a>
  </nav>
  <div class="side-bot"><a href="/index">전체 관리자 화면</a><RouterLink to="/admin-app/screen-3">관리자 앱</RouterLink><RouterLink to="/">고객페이지</RouterLink><RouterLink to="/customer-app/screen-5">고객 앱</RouterLink></div>
</aside>

<main class="page">
  <div class="crumb"><span>예지보전 &gt; <strong class="inl-7891572d91">기준 설정</strong></span><span class="note"></span></div>
<div class="page-head"><h1>예지보전</h1><div class="row"><button type="button" class="btn" id="s-reset">변경 취소</button><button type="button" class="btn primary" id="s-save">저장</button></div></div><nav class="tabs" aria-label="예지보전 탭"><a href="/pm-equipment">설비</a><a href="/pm-queue">점검 대상·알림 <span class="count">3</span></a><a href="/pm-history">점검 이력</a><a href="/pm-settings" aria-current="page">기준 설정</a></nav>
<p class="ro inl-7d0b01be6f">설비 위험도 기준은 <strong>침수 임계치와 별개</strong>예요. 침수 임계치는 지하차도 상세 &gt; 설정 탭에서 변경합니다.</p>
<div class="split">
<section class="card inl-fa5f50369a" aria-label="지표 규칙">
<div class="chips inl-da12f2858b" id="ttabs" role="group" aria-label="설비 유형"><button type="button" class="chip" data-t="배수펌프" aria-pressed="true">배수펌프</button><button type="button" class="chip" data-t="전광판" aria-pressed="false">전광판</button><button type="button" class="chip" data-t="CCTV" aria-pressed="false">CCTV</button></div>
<div class="tbl-wrap inl-bb0c09db77"><table class="tbl inl-512bf91e30"><thead><tr><th>지표</th><th>기준값 (이상이면 점수 부여)</th><th>가중치 (점)</th></tr></thead><tbody id="mrows"></tbody>
<tfoot><tr><td colspan="2"><strong>가중치 합계</strong></td><td><strong id="wsum"></strong> <span id="wmsg" class="sub"></span></td></tr></tfoot></table></div>
<p class="sub">설비당 3~5개 지표를 규칙으로 판정하고, 기준을 넘으면 가중치만큼 점수를 더해 0~100점으로 계산해요.</p>
</section>
<section class="card inl-ade4ba0c4a" aria-label="경계 점수">
<h2 class="inl-da12f2858b">단계 경계 점수</h2>
<div class="field"><label for="b-warn">주의 시작</label><input id="b-warn" type="number" value="40" min="1" max="99" /></div>
<div class="field inl-d2c171b18b"><label for="b-dan">위험 시작</label><input id="b-dan" type="number" value="70" min="2" max="100" /></div>
<div id="b-err" class="err inl-8a77e5a311" role="alert"></div>
<h3 class="inl-e47f8bb883">저장 전 미리보기</h3>
<ul class="list" id="prev"></ul>
<p class="sub inl-8a77e5a311">현재 설비 10개의 점수에 새 경계를 적용했을 때 단계별 개수예요.</p>
</section>
</div>
<section class="card inl-1b0f4999d2" aria-label="변경 이력"><h2 class="inl-fdf33f2304">변경 이력</h2>
<div class="tbl-wrap inl-bb0c09db77"><table class="tbl inl-2e2cd21005"><thead><tr><th>일시</th><th>변경자</th><th>대상</th><th>변경 내용</th></tr></thead><tbody id="hist">
<tr><td>2026-10-05 10:12</td><td>○○○</td><td>배수펌프</td><td>기동 오류 횟수 기준 4 → 5회</td></tr>
<tr><td>2026-10-01 09:30</td><td>○○○</td><td>경계 점수</td><td>위험 시작 75 → 70</td></tr>
</tbody></table></div></section>
<dialog id="cf" aria-labelledby="cf-t"><div class="dlg-h"><h2 id="cf-t">기준 변경 확인</h2></div><div class="dlg-b"><p id="cf-m" class="inl-1169661891"></p><p class="sub inl-1169661891">저장하면 모든 설비의 위험 점수가 새 기준으로 다시 계산되고, 변경 이력에 기록됩니다.</p></div><div class="dlg-f"><button type="button" class="btn" data-close="cf">취소</button><button type="button" class="btn primary" id="cf-ok">변경</button></div></dialog>
<div id="toast" class="toast" hidden role="status"></div>

</main>


</div></template>
