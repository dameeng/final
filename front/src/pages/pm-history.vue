<script setup lang="ts">
import AdminIdentity from '../components/AdminIdentity.vue'
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/pm-history.js'
import '../styles/pm-history.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('pm-history',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-pm-history">
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
  <div class="crumb"><span>예지보전 &gt; <strong class="inl-7891572d91">점검 이력</strong></span><span class="note"></span></div>
<div class="page-head"><h1>예지보전</h1><div class="row"><button type="button" class="btn" id="h-reg">점검 직접 등록</button></div></div><nav class="tabs" aria-label="예지보전 탭"><a href="/pm-equipment">설비</a><a href="/pm-queue">점검 대상·알림 <span class="count">3</span></a><a href="/pm-history" aria-current="page">점검 이력</a><a href="/pm-settings">기준 설정</a></nav>
<div class="filters" role="search">
<select id="h-type" aria-label="설비 유형"><option value="">유형 전체</option><option>배수펌프</option><option>전광판</option><option>CCTV</option></select>
<select aria-label="조치 유형"><option>조치 유형 전체</option><option>현장 점검</option><option>부품 교체</option><option>설정 조정</option><option>원격 확인</option><option>이상 없음</option></select>
<input type="date" aria-label="시작일" class="inl-99fb937df8" /> <span>~</span> <input type="date" aria-label="종료일" class="inl-99fb937df8" />
<input type="search" id="h-q" placeholder="설비 ID, 지하차도 검색" aria-label="검색" />
</div>
<div class="tbl-wrap"><table class="tbl inl-cefd76a396" id="htbl"><thead><tr><th>일시</th><th>설비</th><th>지하차도</th><th>조치 유형</th><th>조치 내용</th><th>등록자</th><th>결과</th><th>점검 전 → 후</th></tr></thead><tbody>
<tr data-text="P-06 부산진시장지하차도" data-type="배수펌프"><td><button type="button" class="link row-open" data-i="0">2026-10-11 09:40</button></td><td><a class="link" href="/pm-equipment-detail">P-06</a><div class="sub">배수펌프</div></td><td>부산진시장지하차도</td><td>부품 교체</td><td>흡입 필터 교체 후 시운전</td><td>○○○</td><td>정상 복구</td><td class="inl-86abdab991">72 → <strong>24</strong></td></tr>
<tr data-text="P-04 범천지하차도" data-type="배수펌프"><td><button type="button" class="link row-open" data-i="1">2026-10-10 16:20</button></td><td><a class="link" href="/pm-equipment-detail">P-04</a><div class="sub">배수펌프</div></td><td>범천지하차도</td><td>현장 점검</td><td>벨트 장력 확인, 윤활</td><td>○○○</td><td>추가 점검 필요</td><td class="inl-86abdab991">58 → <strong>49</strong></td></tr>
<tr data-text="D-07 센텀1지하차도" data-type="전광판"><td><button type="button" class="link row-open" data-i="2">2026-10-09 11:05</button></td><td><a class="link" href="/pm-equipment-detail">D-07</a><div class="sub">전광판</div></td><td>센텀1지하차도</td><td>설정 조정</td><td>통신 재접속 간격 조정</td><td>○○○</td><td>정상 복구</td><td class="inl-86abdab991">51 → <strong>23</strong></td></tr>
<tr data-text="C-05 문현지하차도" data-type="CCTV"><td><button type="button" class="link row-open" data-i="3">2026-10-08 14:30</button></td><td><a class="link" href="/pm-equipment-detail">C-05</a><div class="sub">CCTV</div></td><td>문현지하차도</td><td>원격 확인</td><td>네트워크 재부팅</td><td>○○○</td><td>정상 복구</td><td class="inl-86abdab991">47 → <strong>30</strong></td></tr>
<tr data-text="P-01 초량1지하차도" data-type="배수펌프"><td><button type="button" class="link row-open" data-i="4">2026-10-06 10:00</button></td><td><a class="link" href="/pm-equipment-detail">P-01</a><div class="sub">배수펌프</div></td><td>초량1지하차도</td><td>이상 없음</td><td>정기 점검, 이상 없음</td><td>○○○</td><td>정상 복구</td><td class="inl-86abdab991">33 → <strong>33</strong></td></tr>
<tr data-text="C-08 좌동지하차도" data-type="CCTV"><td><button type="button" class="link row-open" data-i="5">2026-10-04 15:45</button></td><td><a class="link" href="/pm-equipment-detail">C-08</a><div class="sub">CCTV</div></td><td>좌동지하차도</td><td>현장 점검</td><td>렌즈 청소</td><td>○○○</td><td>정상 복구</td><td class="inl-86abdab991">44 → <strong>19</strong></td></tr>
</tbody></table></div>
<p class="sub">점검 이력은 예지보전에서만 등록합니다. 로그 탭의 ‘설비·점검’에서도 읽기 전용으로 볼 수 있어요. 점검 전 → 후 점수로 조치 효과를 확인합니다.</p>
<aside id="peek" class="drawer" hidden aria-label="점검 이력 요약">
<div class="dh"><div><div class="sub" id="p-when"></div><h2 id="p-title" class="inl-85d138b8f7"></h2><div class="row inl-8a77e5a311"><span class="stat" id="p-act"></span><span class="stat done" id="p-res"></span></div></div>
<button type="button" class="btn sm" id="peek-close">닫기</button></div>
<div class="db">
<div><h3 class="inl-15066bbcff">조치 내용</h3><p class="ro inl-1169661891" id="p-memo"></p></div>
<div><h3 class="inl-15066bbcff">점검 전후 위험 점수</h3>
<div class="row inl-f6ce4d1e15"><div class="kv2 inl-97445a8d93"><div><small>점검 전</small><strong id="p-b"></strong></div><div><small>점검 후</small><strong id="p-a"></strong></div></div></div></div>
<div class="kv2"><div><small>등록자</small><strong id="p-who"></strong></div><div><small>설비 유형</small><strong id="p-kind"></strong></div></div>
<div class="row"><a class="btn inl-061383821c" href="/pm-equipment-detail">설비 상세 →</a></div>
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
