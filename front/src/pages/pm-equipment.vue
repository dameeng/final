<script setup lang="ts">
import AdminSidebarLinks from '../components/AdminSidebarLinks.vue'
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/pm-equipment.js'
import '../styles/pm-equipment.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('pm-equipment',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-pm-equipment">
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
<a href="/pm-equipment" aria-current="page"><span>예지보전</span><span class="count" aria-label="처리 필요 3건">3</span></a>
<a href="/verify"><span>수동 판별</span><span class="count" aria-label="처리 필요 2건">2</span></a>
<a href="/cs-customers"><span>고객 서비스</span><span class="count" aria-label="처리 필요 2건">2</span></a>
<a href="/bot-stats"><span>챗봇</span></a>
<a href="/logs"><span>로그</span></a>
  </nav>
  <AdminSidebarLinks/>
</aside>

<main class="page">
  <div class="crumb"><span>예지보전 &gt; <strong class="inl-7891572d91">설비</strong></span><span class="note"></span></div>
<div class="page-head"><h1>예지보전</h1><div class="row"></div></div><nav class="tabs" aria-label="예지보전 탭"><a href="/pm-equipment" aria-current="page">설비</a><a href="/pm-queue">점검 대상·알림 <span class="count">3</span></a><a href="/pm-history">점검 이력</a><a href="/pm-settings">기준 설정</a></nav>
<div class="filters" role="search">
<select id="f-type" aria-label="설비 유형"><option value="">유형 전체</option><option>배수펌프</option><option>전광판</option><option>CCTV</option><option>수위센서</option></select>
<div class="chips" role="group" aria-label="위험 단계"><button type="button" class="chip" data-lv="" aria-pressed="true">전체</button><button type="button" class="chip" data-lv="위험" aria-pressed="false">위험</button><button type="button" class="chip" data-lv="주의" aria-pressed="false">주의</button><button type="button" class="chip" data-lv="안전" aria-pressed="false">안전</button></div>
<input type="search" id="f-q" placeholder="설비 ID, 지하차도 검색" aria-label="검색" />
<span class="sub inl-6d00061700" id="f-count">총 11개</span>
</div>
<div class="tbl-wrap"><table class="tbl" id="tbl">
<thead><tr><th>설비</th><th>유형</th><th>지하차도</th><th>위험 점수</th><th>7일 변화</th><th>마지막 수신</th><th>점검 상태</th></tr></thead>
<tbody>
<tr data-type="배수펌프" data-lv="위험" data-text="P-01 초량1지하차도"><td><button type="button" class="link row-open" data-i="0">P-01</button></td><td>배수펌프</td><td>초량1지하차도</td><td><span class="badge danger">위험</span> <strong>82</strong></td><td>▲ 34</td><td>10:42</td><td><span class="stat new">점검 대기</span></td></tr>
<tr data-type="CCTV" data-lv="주의" data-text="C-02 초량2지하차도"><td><button type="button" class="link row-open" data-i="1">C-02</button></td><td>CCTV</td><td>초량2지하차도</td><td><span class="badge warn">주의</span> <strong>61</strong></td><td>▲ 12</td><td>10:41</td><td><span class="stat new">점검 대기</span></td></tr>
<tr data-type="전광판" data-lv="주의" data-text="D-03 우장춘지하차도"><td><button type="button" class="link row-open" data-i="2">D-03</button></td><td>전광판</td><td>우장춘지하차도</td><td><span class="badge warn">주의</span> <strong>55</strong></td><td>▲ 9</td><td>10:42</td><td><span class="stat new">점검 대기</span></td></tr>
<tr data-type="배수펌프" data-lv="주의" data-text="P-04 범천지하차도"><td><button type="button" class="link row-open" data-i="3">P-04</button></td><td>배수펌프</td><td>범천지하차도</td><td><span class="badge warn">주의</span> <strong>48</strong></td><td>▲ 15</td><td>10:40</td><td><span class="sub">-</span></td></tr>
<tr data-type="CCTV" data-lv="안전" data-text="C-05 문현지하차도"><td><button type="button" class="link row-open" data-i="4">C-05</button></td><td>CCTV</td><td>문현지하차도</td><td><span class="badge safe">안전</span> <strong>31</strong></td><td>▲ 1</td><td>09:12</td><td><span class="sub">-</span></td></tr>
<tr data-type="배수펌프" data-lv="안전" data-text="P-06 부산진시장지하차도"><td><button type="button" class="link row-open" data-i="5">P-06</button></td><td>배수펌프</td><td>부산진시장지하차도</td><td><span class="badge safe">안전</span> <strong>28</strong></td><td>▲ 2</td><td>10:42</td><td><span class="sub">-</span></td></tr>
<tr data-type="전광판" data-lv="안전" data-text="D-07 센텀1지하차도"><td><button type="button" class="link row-open" data-i="6">D-07</button></td><td>전광판</td><td>센텀1지하차도</td><td><span class="badge safe">안전</span> <strong>24</strong></td><td>▲ 2</td><td>10:42</td><td><span class="sub">-</span></td></tr>
<tr data-type="CCTV" data-lv="안전" data-text="C-08 좌동지하차도"><td><button type="button" class="link row-open" data-i="7">C-08</button></td><td>CCTV</td><td>좌동지하차도</td><td><span class="badge safe">안전</span> <strong>19</strong></td><td>–</td><td>10:41</td><td><span class="sub">-</span></td></tr>
<tr data-type="배수펌프" data-lv="안전" data-text="P-09 수영강변지하차도"><td><button type="button" class="link row-open" data-i="8">P-09</button></td><td>배수펌프</td><td>수영강변지하차도</td><td><span class="badge safe">안전</span> <strong>17</strong></td><td>▼ 1</td><td>10:42</td><td><span class="sub">-</span></td></tr>
<tr data-type="전광판" data-lv="안전" data-text="D-10 ★★지하차도"><td><button type="button" class="link row-open" data-i="9">D-10</button></td><td>전광판</td><td>★★지하차도</td><td><span class="badge safe">안전</span> <strong>12</strong></td><td>▼ 2</td><td>10:42</td><td><span class="sub">-</span></td></tr>
<tr data-type="수위센서" data-lv="주의" data-text="W-11 초량1지하차도"><td><button type="button" class="link row-open" data-i="10">W-11</button></td><td>수위센서</td><td>초량1지하차도</td><td><span class="badge warn">주의</span> <strong>58</strong></td><td>▲ 28</td><td>10:42</td><td>-</td></tr>
</tbody></table></div>
<p class="sub">점수 구간: 0~39 안전 · 40~69 주의 · 70 이상 위험 (기준 설정에서 변경)</p>

<aside id="peek" class="drawer" hidden aria-label="설비 요약">
<div class="dh"><div><div class="sub" id="p-type"></div><h2 id="p-title" class="inl-85d138b8f7"></h2>
<div class="row inl-8a77e5a311"><span class="badge" id="p-badge"></span><strong id="p-score" class="inl-b9199e22b2"></strong><span class="sub">/ 100</span></div></div>
<button type="button" class="btn sm" id="peek-close">닫기</button></div>
<div class="db">
<div><h3 class="inl-15066bbcff">주요 사유</h3><ul class="list" id="p-reasons"></ul></div>
<div><h3 class="inl-15066bbcff">위험 점수 · 최근 7일</h3><svg class="chart" viewBox="0 0 400 140" id="p-chart" role="img" aria-label="최근 7일 위험 점수 추이"></svg></div>
<div class="kv2"><div><small>마지막 수신</small><strong id="p-rx"></strong></div><div><small>점검 상태</small><strong id="p-insp"></strong></div></div>
<div class="row"><button type="button" class="btn primary inl-061383821c" id="p-reg">점검 등록</button><a class="btn inl-061383821c" href="/pm-equipment-detail">상세 보기 →</a></div>
</div></aside>
<dialog id="reg" aria-labelledby="reg-t">
<form method="dialog" id="reg-form">
<div class="dlg-h"><h2 id="reg-t">점검 등록</h2><button type="button" class="btn sm" data-close="reg">닫기</button></div>
<div class="dlg-b">
<div class="field"><label>설비</label><div class="ro" id="reg-eq">P-01 · 배수펌프 · 초량1지하차도</div></div>
<div class="field"><label for="reg-at">점검 일시</label><input id="reg-at" type="datetime-local" value="2026-10-11T10:50" /></div>
<div class="field"><label for="reg-type">조치 유형</label><select id="reg-type"><option>현장 점검</option><option>부품 교체</option><option>설정 조정</option><option>원격 확인</option><option>이상 없음</option></select></div>
<div class="field"><label for="reg-memo">조치 내용</label><textarea id="reg-memo" placeholder="어떤 점검과 조치를 했는지 적어 주세요."></textarea></div>
<div class="field"><label for="reg-res">점검 결과</label><select id="reg-res"><option>정상 복구</option><option>추가 점검 필요</option><option>교체 필요</option></select></div>
<div class="field"><label>등록자</label><div class="ro">○○○ (로그인 계정 자동 기록)</div></div>
</div>
<div class="dlg-f"><button type="button" class="btn" data-close="reg">취소</button><button type="button" class="btn primary" id="reg-ok">등록</button></div>
</form>
</dialog>
<div id="toast" class="toast" hidden role="status"></div>

</main>


</div></template>
