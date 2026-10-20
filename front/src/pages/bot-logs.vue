<script setup lang="ts">
import AdminSidebarLinks from '../components/AdminSidebarLinks.vue'
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/bot-logs.js'
import '../styles/bot-logs.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('bot-logs',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-bot-logs">
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
<a href="/bot-stats" aria-current="page"><span>챗봇</span></a>
<a href="/logs"><span>로그</span></a>
  </nav>
  <AdminSidebarLinks/>
</aside>

<main class="page">
  <div class="crumb"><span>챗봇 &gt; 대화 로그</span><span class="note"></span></div>
<div class="page-head"><h1>챗봇</h1></div><nav class="tabs" aria-label="챗봇 탭"><a href="/bot-logs" aria-current="page">대화 로그</a><a href="/bot-stats">통계</a></nav>
<div class="filters" role="search"><button type="button" class="chip" aria-pressed="true" data-r="">전체 7</button><button type="button" class="chip" aria-pressed="false" data-r="답변함">답변함 4</button><button type="button" class="chip" aria-pressed="false" data-r="답변 못 함">답변 못 함 3</button><input type="search" id="q" placeholder="고객, 질문 검색" aria-label="검색" /></div>
<div class="tbl-wrap"><table class="tbl" id="tbl"><thead><tr><th>시각</th><th>고객</th><th>첫 질문</th><th>결과</th></tr></thead><tbody><tr data-text="김민수 (kim@example.com) 우회로 어떻게 봐요?" data-r="답변함"><td>10-12 09:41</td><td>김민수 (kim@example.com)</td><td><button type="button" class="link row-open" data-i="0">우회로 어떻게 봐요?</button></td><td><span class="stat done">답변함</span></td></tr><tr data-text="비회원 번호판 등록은 어디서 해요?" data-r="답변함"><td>10-12 09:18</td><td>비회원</td><td><button type="button" class="link row-open" data-i="1">번호판 등록은 어디서 해요?</button></td><td><span class="stat done">답변함</span></td></tr><tr data-text="박서연 (park@example.com) 알림이 안 와요" data-r="답변함"><td>10-12 08:52</td><td>박서연 (park@example.com)</td><td><button type="button" class="link row-open" data-i="2">알림이 안 와요</button></td><td><span class="stat done">답변함</span></td></tr><tr data-text="이정호 (lee@example.com) 해운대 지하차도 침수 예상 시간 알려줘" data-r="답변 못 함"><td>10-11 22:07</td><td>이정호 (lee@example.com)</td><td><button type="button" class="link row-open" data-i="3">해운대 지하차도 침수 예상 시간 알려줘</button></td><td><span class="stat new">답변 못 함</span></td></tr><tr data-text="비회원 요금 있나요?" data-r="답변함"><td>10-11 19:30</td><td>비회원</td><td><button type="button" class="link row-open" data-i="4">요금 있나요?</button></td><td><span class="stat done">답변함</span></td></tr><tr data-text="최유진 (choi@example.com) 차량 3대 이상 등록 되나요?" data-r="답변 못 함"><td>10-11 14:12</td><td>최유진 (choi@example.com)</td><td><button type="button" class="link row-open" data-i="5">차량 3대 이상 등록 되나요?</button></td><td><span class="stat new">답변 못 함</span></td></tr><tr data-text="정하늘 (jung@example.com) 앱은 어디서 받아요?" data-r="답변 못 함"><td>10-10 11:05</td><td>정하늘 (jung@example.com)</td><td><button type="button" class="link row-open" data-i="6">앱은 어디서 받아요?</button></td><td><span class="stat new">답변 못 함</span></td></tr></tbody></table></div>
<p class="hint">관리자는 고객 정보를 가리지 않고 볼 수 있어요. 대화 로그는 읽기 전용이에요.</p>
<aside id="peek" class="drawer" hidden aria-label="대화 요약"><div class="dh"><div><div class="sub" id="p-t"></div><h2 id="p-c" class="inl-85d138b8f7"></h2></div><button type="button" class="btn sm" id="peek-close">닫기</button></div>
<div class="db"><div class="chat" id="p-chat"></div><div class="row" id="p-act"></div></div></aside><div id="toast" class="toast" hidden role="status"></div>
</main>


</div></template>
