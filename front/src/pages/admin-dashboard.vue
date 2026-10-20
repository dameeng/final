<script setup lang="ts">
import AdminSidebarLinks from '../components/AdminSidebarLinks.vue'
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import {computed,ref,onMounted,onBeforeUnmount} from 'vue'
import {useAdminProfile} from '../stores/adminProfile'
import {useApp} from '../stores/app'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {mountClusters} from '../runtime/mapClusters'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/admin-dashboard.js'
import '../styles/admin-dashboard.css'
import '../styles/dashboard-fixed.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined
const facilityExpanded=ref(true)
const admin=useAdminProfile(),app=useApp()
const mapRegion=computed(()=>app.account?.role==='REGIONAL_ADMIN'?app.account.regions?.map(region=>region.name).join(' · ')||'담당 지역 미지정':admin.region)
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);enhance('admin-dashboard',runtime.ctx);initialize(runtime.ctx);mountClusters(root.value,runtime.ctx,'admin-dashboard');dispose=runtime.dispose})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-admin-dashboard">

<header class="hdr">
  <div class="hdr-l">
    <button type="button" id="menu-btn" class="iconbtn" aria-label="메뉴 열기" aria-expanded="false" aria-controls="side"><MenuIcon/></button>
    <RouterLink to="/admin-dashboard" class="admin-home-logo" aria-label="종합 현황으로 이동">ROUTEL</RouterLink>
  </div>
  <div class="hdr-r">
    <div class="conn" role="status"><span class="dot" aria-hidden="true"></span><span>연결됨<small> · 마지막 수신 10:42</small></span><button type="button" class="btn sm">새로고침</button></div>
    <button type="button" id="bell-btn" class="iconbtn" aria-label="알림 3건 안 읽음" aria-expanded="false" aria-controls="bell-pop"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15L6 17z M10 21h4" fill="none" stroke="#1f2630" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg><span id="bell-count" class="count">3</span></button>
    <span class="user">부산 · ○○○님</span>
  </div>
  <section id="bell-pop" class="bell-pop" hidden aria-label="최근 알림">
    <div class="pop-top"><strong>알림</strong><button type="button" id="read-all" class="btn sm">모두 읽음</button></div>
    <ul class="pop-list">
<li class="unread"><span class="cat">위험</span><span>○○지하차도 위험 단계로 상승</span><span class="time">방금</span></li>
<li class="unread"><span class="cat">설비</span><span>P-01 배수펌프 위험 진입 (82점)</span><span class="time">5분 전</span></li>
<li class="unread"><span class="cat">업무</span><span>신규 문의 접수 · 알림이 오지 않아요</span><span class="time">12분 전</span></li>
<li><span class="cat">시스템</span><span>△△지하차도 데이터 미수신 10분</span><span class="time">1시간 전</span></li>
<li><span class="cat">설비</span><span>D-03 전광판 주의 진입 (55점)</span><span class="time">2시간 전</span></li>
    </ul>
    <a class="pop-foot" href="/notifications">전체 알림 보기</a>
  </section>
</header>
<div id="scrim" class="scrim" hidden></div>
<aside id="side" class="side" aria-label="관리자 메뉴">
  <div class="side-top"><strong>관리자 메뉴</strong><button type="button" id="menu-close" class="btn sm">닫기</button></div>
  <AdminIdentity/>
  <nav>
<a href="/admin-dashboard" aria-current="page"><span>종합 현황</span></a>
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
  <div class="crumb"><span>종합 현황</span><span class="note">샘플 데이터 · 구조 확인용 저충실도 와이어프레임</span></div>
<div class="page-head">
<h1>종합 현황</h1>
<div></div>
</div>
<div id="grid" class="dashboard-fixed-layout">
<div class="dashboard-fixed-item fixed-map"><div class="dashboard-fixed-content"><div class="map-widget-layout"><section class="card map-w widget-original-content" data-id="map" data-size="l" aria-label="지도">
<div class="map-top">
<h2>{{mapRegion}} 지하차도 지도</h2>
<div class="legend"><span><i style="background:#1f2630"></i>위험</span><span><i style="background:#fff;border:3px solid #1f2630;width:12px;height:12px"></i>주의</span><span><i style="background:#c9ced6;border:1px solid #8a93a0"></i>안전</span></div>
</div>
<div class="map-body">
<svg viewBox="0 0 800 460" preserveAspectRatio="xMidYMid slice" role="img" aria-label="부산 지역 지하차도 마커 지도 (샘플)">
<rect width="800" height="460" fill="#eef0f3"/>
<g stroke="#d9dde3" stroke-width="1"><path d="M0 100H800 M0 200H800 M0 300H800 M0 400H800 M100 0V460 M200 0V460 M300 0V460 M400 0V460 M500 0V460 M600 0V460 M700 0V460"/></g>
<path d="M0 420 C150 380 250 440 400 410 S650 380 800 420 V460 H0Z" fill="#dfe3e8"/>
<text x="20" y="445" font-size="12" fill="#5b6572">지도 영역 (카카오맵 자리)</text>
<g class="mk" data-f="0" tabindex="0" role="button" aria-label="○○지하차도 위험"><circle cx="470" cy="150" r="13" fill="#1f2630" stroke="#fff" stroke-width="3"/><text x="470" y="154" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">!</text></g>
<g class="mk" data-f="1" tabindex="0" role="button" aria-label="△△지하차도 주의"><circle cx="330" cy="200" r="10" fill="#fff" stroke="#1f2630" stroke-width="3"/></g>
<g class="mk" data-f="2" tabindex="0" role="button" aria-label="□□지하차도 주의"><circle cx="540" cy="230" r="10" fill="#fff" stroke="#1f2630" stroke-width="3"/></g>
<g class="mk" data-f="3" tabindex="0" role="button" aria-label="◇◇지하차도 안전"><circle cx="300" cy="280" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/></g>
<g class="mk" data-f="4" tabindex="0" role="button" aria-label="☆☆지하차도 안전"><circle cx="590" cy="300" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/></g>
<circle cx="120" cy="300" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/>
<circle cx="190" cy="250" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/>
<circle cx="240" cy="330" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/>
<circle cx="380" cy="340" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/>
<circle cx="430" cy="260" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/>
<circle cx="500" cy="320" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/>
<circle cx="640" cy="180" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/>
<circle cx="680" cy="350" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/>
<circle cx="720" cy="250" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/>
<circle cx="150" cy="370" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/>
<circle cx="560" cy="380" r="8" fill="#c9ced6" stroke="#8a93a0" stroke-width="1.5"/>
<circle id="ring" cx="470" cy="150" r="22" fill="none" stroke="#2b5c8a" stroke-width="3" stroke-dasharray="4 3" pointer-events="none"/>
</svg>
<section class="card selp" aria-label="선택 시설" aria-live="polite">
<div class="wg-head"><h2>선택 시설</h2><button type="button" class="btn sm" id="facility-detail-toggle" :aria-expanded="facilityExpanded" aria-controls="facility-detail-body" @click="facilityExpanded=!facilityExpanded">{{facilityExpanded?'상세 접기 ▴':'상세 펼치기 ▾'}}</button></div>
<div><p class="name"><span id="s-name"></span></p><p class="addr" id="s-addr"></p>
<div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap"><span class="badge" id="s-badge"></span><span class="badge safe" id="s-ctl"></span></div></div>
<div id="facility-detail-body" v-show="facilityExpanded" class="facility-detail-body">
<div class="facility-observation-action"><button type="button" class="btn sm" id="obs-open">관측 기록</button></div>
<div><div style="display:flex;align-items:baseline;justify-content:space-between"><strong style="font-size:22px" id="s-score"></strong><small style="color:var(--ink-sub)">위험 점수</small></div>
<div class="gauge" aria-hidden="true"><b id="g-fill"></b><i style="left:50%"></i><i style="left:70%"></i></div>
<small style="color:var(--ink-sub)">주의 50점 이상 · 위험 70점 이상 (서버 임계치)</small></div>
<div class="kv"><div><small>강우량</small><strong id="s-rain"></strong></div><div><small>위험도 관측</small><strong id="s-obs"></strong></div></div>
<div><strong>시설 위치 날씨</strong><div id="s-wx" style="color:var(--ink-sub)"></div></div>
<div><strong>설비</strong> <span id="s-eq"></span> <a href="/pm-equipment" style="color:inherit;text-decoration:underline">예지보전에서 보기</a></div>
<div style="margin-top:auto;display:flex;flex-direction:column;gap:8px">
<div class="row2"><button type="button" class="btn primary" id="b-block">통제</button><button type="button" class="btn" id="b-release">통제 해제</button></div>
<a class="btn" href="/fac-detail">시설 상세 →</a>
</div>
</div>
</section>
<div class="flist" id="flist">
<div class="flist-h"><strong>시설 통제 현황 (16)</strong><button type="button" class="btn sm" id="flist-toggle" aria-expanded="true" aria-controls="flist-body">접기</button></div>
<div id="flist-body"><input type="search" id="fq" placeholder="시설명 검색" aria-label="시설 검색"><ul id="fl">
<li><button type="button" data-f="0" aria-pressed="true"><span class="sdot danger" aria-hidden="true"></span><span>○○지하차도<small>위험 · 통제 중</small></span></button></li>
<li><button type="button" data-f="1" aria-pressed="false"><span class="sdot warn" aria-hidden="true"></span><span>△△지하차도<small>주의 · 정상 운영</small></span></button></li>
<li><button type="button" data-f="2" aria-pressed="false"><span class="sdot warn" aria-hidden="true"></span><span>□□지하차도<small>주의 · 정상 운영</small></span></button></li>
<li><button type="button" data-f="3" aria-pressed="false"><span class="sdot safe" aria-hidden="true"></span><span>◇◇지하차도<small>안전 · 정상 운영</small></span></button></li>
<li><button type="button" data-f="4" aria-pressed="false"><span class="sdot safe" aria-hidden="true"></span><span>☆☆지하차도<small>안전 · 정상 운영</small></span></button></li>
</ul></div>
</div>
</div>
</section></div></div></div><div class="dashboard-fixed-item fixed-summary"><div class="dashboard-fixed-content"><section class="card wg widget-original-content" data-id="summary" data-size="l" aria-label="지하차도 현황">
<div class="wg-head"><h2>지하차도 현황</h2><a href="/fac-list">지하차도 관리</a></div>

<div class="tiles5">
<div class="tile"><small>담당 시설</small><strong>16</strong></div>
<div class="tile"><small>정상</small><strong>12</strong></div>
<div class="tile warn"><small>주의</small><strong>3</strong></div>
<div class="tile danger"><small>위험</small><strong>1</strong></div>
<div class="tile block"><small>통제 중</small><strong>1</strong></div>
</div>
</section></div></div>
<div class="dashboard-bottom">
<div class="dashboard-fixed-item fixed-todo"><div class="dashboard-fixed-content"><section class="card wg widget-original-content" data-id="todo" data-size="s" aria-label="점검 필요">
<div class="wg-head"><h2>점검 필요</h2></div>

<div class="fill"><div><span class="big">3</span> <span style="color:var(--ink-sub)">건 · 신규 점검 대상</span></div>
<div style="display:flex;flex-wrap:wrap;gap:8px"><a class="btn sm primary" href="/pm-queue">점검 대상 보기 →</a><a class="btn sm" href="/pm-settings">기준 설정 →</a></div></div>
</section></div></div>
<div class="dashboard-fixed-item fixed-verify"><div class="dashboard-fixed-content"><section class="card wg widget-original-content" data-id="verify" data-size="s" aria-label="수동 판별 대기">
<div class="wg-head"><h2>수동 판별 대기</h2><a href="/verify">판별하러 가기</a></div>

<div class="fill"><div><span class="big">2</span> <span style="color:var(--ink-sub)">건 대기 중</span></div>
<div style="color:var(--ink-sub)">가장 급한 건: 남은 시간 0:23 · 1분 지나면 자동 넘김</div></div>
</section></div></div>
<div class="dashboard-fixed-item fixed-health"><div class="dashboard-fixed-content"><section class="card wg widget-original-content" data-id="health" data-size="s" aria-label="데이터 수신 상태">
<div class="wg-head"><h2>데이터 수신 상태</h2><a href="/logs">로그 보기</a></div>

<div class="fill"><div><span class="big" style="font-size:22px">정상 14 · 지연 1</span></div>
<div style="color:var(--ink-sub)">△△지하차도 번호판 수신 11분 지연 · 날씨·위험도·CCTV 수신 시각 점검</div></div>
</section></div></div>
<div class="dashboard-fixed-item fixed-top5"><div class="dashboard-fixed-content"><section class="card wg widget-original-content" data-id="top5" data-size="m" aria-label="예지보전 Top5">
<div class="wg-head"><h2>예지보전 Top5</h2><a href="/pm-equipment">전체 보기</a></div>

<ol class="rank">
<li><span class="n">1</span><RouterLink class="t equipment-detail-link" to="/pm-equipment-detail?equipment=P-01">배수펌프 · ○○지하차도<small>모터 전류 상승 외 2건</small></RouterLink><span class="badge danger">위험</span><span class="sc">82</span></li>
<li><span class="n">2</span><RouterLink class="t equipment-detail-link" to="/pm-equipment-detail?equipment=C-02">CCTV · △△지하차도<small>영상 끊김 반복</small></RouterLink><span class="badge warn">주의</span><span class="sc">61</span></li>
<li><span class="n">3</span><RouterLink class="t equipment-detail-link" to="/pm-equipment-detail?equipment=D-03">전광판 · □□지하차도<small>통신 지연 증가</small></RouterLink><span class="badge warn">주의</span><span class="sc">55</span></li>
<li><span class="n">4</span><RouterLink class="t equipment-detail-link" to="/pm-equipment-detail?equipment=P-04">배수펌프 · ◇◇지하차도<small>기동 오류 증가</small></RouterLink><span class="badge warn">주의</span><span class="sc">48</span></li>
<li><span class="n">5</span><RouterLink class="t equipment-detail-link" to="/pm-equipment-detail?equipment=C-05">CCTV · ☆☆지하차도<small>데이터 미수신</small></RouterLink><span class="badge safe">안전</span><span class="sc">31</span></li>
</ol>
</section></div></div>
</div>
<div class="dashboard-fixed-item fixed-events"><div class="dashboard-fixed-content"><section class="card wg widget-original-content" data-id="events" data-size="m" aria-label="최근 이벤트">
<div class="wg-head"><h2>최근 이벤트</h2><a href="/logs">로그 전체 보기</a></div>

<ol class="tl">
<li class="lv-danger"><time>10:42</time><div><span class="cat">위험</span><strong>○○지하차도 위험 단계로 상승</strong><small>주의 → 위험 · 76.4점</small></div></li>
<li><time>10:37</time><div><span class="cat">통제</span><strong>○○지하차도 입구 차단</strong><small>자동 · 시스템</small></div></li>
<li><time>10:31</time><div><span class="cat">전광판</span><strong>표출 문구 변경</strong><small>○○지하차도 · 자동</small></div></li>
<li class="lv-warn"><time>10:20</time><div><span class="cat">설비</span><strong>P-01 배수펌프 위험 진입</strong><small>모터 전류 상승 외 2건 · 82점</small></div></li>
<li><time>10:02</time><div><span class="cat">알림</span><strong>앱푸시 발송</strong><small>위험 알림 · 1,203명</small></div></li>
<li><time>09:48</time><div><span class="cat">판별</span><strong>번호판 수동 판별 처리</strong><small>○○○ · 처리자</small></div></li>
</ol>
</section></div></div>
</div>
<dialog id="confirm" aria-labelledby="c-title">
<div class="dlg-h"><h2 id="c-title">통제 확인</h2></div>
<div class="dlg-b"><p id="c-msg" style="margin:0"></p><p style="margin:0;color:var(--ink-sub)">실제 도로 통제 상태가 바뀌고, 처리 내용이 로그에 기록됩니다.</p></div>
<div class="dlg-f"><button type="button" class="btn" id="c-cancel">취소</button><button type="button" class="btn primary" id="c-ok">확인</button></div>
</dialog>
<dialog id="obs" aria-labelledby="o-title">
<div class="dlg-h"><h2 id="o-title">관측 기록 · <span id="o-name"></span></h2><button type="button" class="btn sm" id="o-close">닫기</button></div>
<div class="dlg-b">
<div><strong>위험 점수 추이</strong> <small style="color:var(--ink-sub)">최근 6시간 + 예측 6시간 (점선)</small>
<svg viewBox="0 0 640 170" role="img" aria-label="위험 점수 추이 (샘플): 점차 상승" style="display:block;width:100%;height:auto;margin-top:6px;background:#fafbfc;border:1px solid var(--line-soft);border-radius:6px">
<line x1="40" y1="130" x2="620" y2="130" stroke="#8a93a0"/><line x1="40" y1="60" x2="620" y2="60" stroke="#1f2630" stroke-dasharray="6 5"/><line x1="40" y1="80" x2="620" y2="80" stroke="#8a93a0" stroke-dasharray="6 5"/>
<text x="4" y="64" font-size="11">70</text><text x="4" y="84" font-size="11">50</text><text x="4" y="134" font-size="11">0</text>
<rect x="330" y="20" width="290" height="110" fill="#eef0f3"/><line x1="330" y1="20" x2="330" y2="130" stroke="#1f2630"/><polyline points="60,118 110,113 160,108 210,100 260,88 310,74 330,64" fill="none" stroke="#2b5c8a" stroke-width="3"/><polyline points="330,64 380,54 430,48 480,52 530,64 580,78 615,90" fill="none" stroke="#2b5c8a" stroke-width="3" stroke-dasharray="7 6"/><text x="334" y="34" font-size="11">지금 · 예측 →</text>
<text x="40" y="155" font-size="11" fill="#5b6572">09:40</text><text x="580" y="155" font-size="11" fill="#5b6572">10:40</text></svg></div>
<div><strong>강수량 기록</strong><div class="rain"><div><small>10분</small><strong>3.0mm</strong></div><div><small>1시간</small><strong>18.0mm</strong></div><div><small>3시간</small><strong>32.5mm</strong></div><div><small>24시간</small><strong>41.0mm</strong></div></div></div>
</div>
</dialog>
<div id="toast" class="toast" hidden role="status"></div>

</main>


</div></template>
