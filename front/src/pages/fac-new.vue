<script setup lang="ts">
import AdminSidebarLinks from '../components/AdminSidebarLinks.vue'
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { makeContext } from '../runtime/context'
import { enhance } from '../runtime/enhance'
import { initialize } from '../runtime/fac-new.js'
import '../styles/fac-new.css'
const root = ref<HTMLElement>()
const router = useRouter()
let dispose: (() => void) | undefined
let handlers: Record<string, (event: Event) => void> = {}
function handle(id: string, event: Event) {
  handlers[id]?.call(event.currentTarget, event)
}
onMounted(() => {
  if (!root.value) return
  const runtime = makeContext(root.value, router)
  dispose = runtime.dispose
  enhance('fac-new', runtime.ctx)
  handlers = initialize(runtime.ctx)
})
onBeforeUnmount(() => dispose?.())
</script>
<template>
  <div ref="root" class="wire-page page-fac-new">
    <header class="hdr">
      <div class="hdr-l">
        <button
          type="button"
          id="menu-btn"
          class="iconbtn"
          aria-label="메뉴 열기"
          aria-expanded="false"
          aria-controls="side"
        >
          <MenuIcon />
        </button>
    <RouterLink
          class="inl-1444c6eaca admin-home-logo"
          to="/admin-dashboard"
          aria-label="종합 현황으로 이동"
        >ROUTEL</RouterLink>
      </div>
  <div class="hdr-r">
        <div class="conn" role="status">
          <span class="dot" aria-hidden="true"></span>
          <span>연결됨<small> · 마지막 수신 10:42</small>
          </span>
          <button type="button" class="btn sm">새로고침</button>
        </div>
    <button
          type="button"
          id="bell-btn"
          class="iconbtn"
          aria-label="알림 3건 안 읽음"
          aria-expanded="false"
          aria-controls="bell-pop"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path
              d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15L6 17z M10 21h4"
              fill="none"
              stroke="#1f2630"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
            ></path>
          </svg>
          <span id="bell-count" class="count">3</span>
        </button>
    <span class="user">부산 · ○○○님</span>
      </div>
  <section id="bell-pop" class="bell-pop" hidden aria-label="최근 알림">
        <div class="pop-top">
          <strong>알림</strong>
          <button type="button" id="read-all" class="btn sm">모두 읽음</button>
        </div>
    <ul class="pop-list">
          <li class="unread">
            <span class="cat">위험</span>
            <span>초량1지하차도 위험 단계로 상승</span>
            <span class="time">방금</span>
          </li>
<li class="unread">
            <span class="cat">설비</span>
            <span>P-01 배수펌프 위험 진입 (82점)</span>
            <span class="time">5분 전</span>
          </li>
<li class="unread">
            <span class="cat">고객</span>
            <span>신규 문의 접수 · 알림이 오지 않아요</span>
            <span class="time">12분 전</span>
          </li>
<li>
            <span class="cat">시스템</span>
            <span>초량2지하차도 데이터 미수신 10분</span>
            <span class="time">1시간 전</span>
          </li>
<li>
            <span class="cat">설비</span>
            <span>D-03 전광판 주의 진입 (55점)</span>
            <span class="time">2시간 전</span>
          </li>
        </ul>
    <a class="pop-foot" href="#">전체 알림 보기</a>
      </section>
    </header>

<div id="scrim" class="scrim" hidden></div>

<aside id="side" class="side" aria-label="관리자 메뉴">
      <div class="side-top">
        <strong>관리자 메뉴</strong>
        <button type="button" id="menu-close" class="btn sm">닫기</button>
      </div>
  <AdminIdentity />
  <nav>
        <a href="/admin-dashboard"><span>종합 현황</span></a>
<a href="/fac-list" aria-current="page"><span>지하차도 관리</span></a>
<a href="/pm-equipment">
          <span>예지보전</span>
          <span class="count" aria-label="처리 필요 3건">3</span>
        </a>
<a href="/verify">
          <span>수동 판별</span>
          <span class="count" aria-label="처리 필요 2건">2</span>
        </a>
<a href="/cs-customers">
          <span>고객 서비스</span>
          <span class="count" aria-label="처리 필요 2건">2</span>
        </a>
<a href="/bot-stats"><span>챗봇</span></a>
<a href="/logs"><span>로그</span></a>
      </nav>
  <AdminSidebarLinks />
    </aside>

<main class="page">
      <div class="crumb">
        <span>지하차도 관리 &gt; <strong class="inl-7891572d91">등록</strong>
        </span>
        <span class="note"></span>
      </div>
<div class="page-head">
        <h1>지하차도 등록</h1>
        <div class="row">
          <a class="btn" href="/fac-list">취소</a>
          <button type="button" class="btn primary" id="save">저장</button>
        </div>
      </div>
<div class="inl-e78cbf1db6">
        <section class="card">
          <h2 class="inl-da12f2858b">기본 정보</h2>
          <div class="form-grid">
            <div class="field">
              <label for="n">시설명 <span class="sub">(필수)</span>
              </label>
              <input id="n" placeholder="예) 초량1지하차도" />
            </div>
<div class="field">
              <label for="r">지역</label>
              <select id="r">
                <option>부산</option>
              </select>
            </div>
<div class="field inl-068a8ddc17">
              <label for="a">도로 주소 <span class="sub">(필수)</span>
              </label>
              <div class="row inl-2aca6dadb8">
                <input id="a" placeholder="주소를 검색하세요" class="inl-97445a8d93" />
                <button type="button" class="btn">주소 검색</button>
              </div>
            </div>
<div class="field">
              <label for="la">위도</label>
              <input id="la" placeholder="주소 검색 시 자동 입력" />
            </div>
            <div class="field">
              <label for="lo">경도</label>
              <input id="lo" placeholder="주소 검색 시 자동 입력" />
            </div>
          </div>
<div class="mapsel inl-56f4356299">지도에서 위치 확인 · 마커를 끌어 미세 조정 (지도 자리)</div>
        </section>

<section class="card">
          <h2 class="inl-da12f2858b">초기 설정</h2>
          <label class="inl-0ec57706e6">
            <input type="checkbox" checked /> 기본 침수 임계치 사용 (주의 50점 · 위험 70점)</label>
<label class="inl-0ec57706e6">
            <input type="checkbox" checked /> 기본 전광판 문구 템플릿 사용</label>
        </section>
      </div>
<div id="toast" class="toast" hidden role="status"></div>
    </main>
  </div>
</template>
