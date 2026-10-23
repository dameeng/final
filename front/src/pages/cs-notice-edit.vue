<script setup lang="ts">
import AdminSidebarLinks from '../components/AdminSidebarLinks.vue'
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { makeContext } from '../runtime/context'
import { enhance } from '../runtime/enhance'
import { initialize } from '../runtime/cs-notice-edit.js'
import '../styles/cs-notice-edit.css'
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
  enhance('cs-notice-edit', runtime.ctx)
  handlers = initialize(runtime.ctx)
})
onBeforeUnmount(() => dispose?.())
</script>
<template>
  <div ref="root" class="wire-page page-cs-notice-edit">
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
<a href="/fac-list"><span>지하차도 관리</span></a>
<a href="/pm-equipment">
          <span>예지보전</span>
          <span class="count" aria-label="처리 필요 3건">3</span>
        </a>
<a href="/verify">
          <span>수동 판별</span>
          <span class="count" aria-label="처리 필요 2건">2</span>
        </a>
<a href="/cs-customers" aria-current="page">
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
        <span>고객 서비스 &gt; 공지·FAQ &gt; <strong class="inl-7891572d91">공지 등록</strong>
        </span>
        <span class="note"></span>
      </div>
<div class="page-head">
        <h1>공지 등록</h1>
        <div class="row">
          <a class="btn" href="/cs-content">취소</a>
          <button type="button" class="btn primary" id="save">저장</button>
        </div>
      </div>
<div class="formcol">
        <section class="card">
          <h2 class="inl-da12f2858b">공지 내용</h2>
          <div class="inl-c7da9158e3">
            <div class="form-grid">
              <div class="field">
                <label for="cat">분류</label>
                <select id="cat">
                  <option>안내</option>
                  <option>점검</option>
                  <option>업데이트</option>
                  <option>긴급</option>
                </select>
              </div>
            </div>
<div class="field">
              <label for="t">제목 <span class="hint">(필수)</span>
              </label>
              <input id="t" placeholder="공지 제목" />
            </div>
<div class="field">
              <label for="b">본문 <span class="hint">(필수)</span>
              </label>
              <textarea
                id="b"
                placeholder="공지 내용을 입력하세요."
                class="inl-3a36915df7"
              ></textarea>
            </div>
          </div>
        </section>
<section class="card">
          <h2 class="inl-da12f2858b">게시 설정</h2>
          <div class="inl-14b4b58a73">
            <label class="inl-0ec57706e6">
              <input type="checkbox" id="pin" /> 상단 고정 <span class="hint">· 목록 맨 위에 강조되어 표시돼요</span>
            </label>
<label class="inl-0ec57706e6">
              <input type="checkbox" id="always" checked /> 상시 게시</label>
<div class="form-grid" id="period" hidden>
              <div class="field">
                <label for="s">게시 시작</label>
                <input id="s" type="date" />
              </div>
              <div class="field">
                <label for="e">게시 종료</label>
                <input id="e" type="date" />
              </div>
            </div>
          </div>
        </section>
<section class="card">
          <h2 class="inl-da12f2858b">앱푸시</h2>
<label class="inl-0ec57706e6">
            <input type="checkbox" id="push" /> 앱푸시로 함께 발송</label>
          <p class="hint inl-63e775fec0" id="pushmsg">공지 알림을 켠 고객에게 발송돼요. 저장 후에는 발송을 취소할 수 없어요.</p>
        </section>
      </div>
<dialog id="cf" aria-labelledby="cf-t">
        <div class="dlg-h"><h2 id="cf-t">앱푸시 발송 확인</h2></div>
        <div class="dlg-b">
          <p class="inl-1169661891">이 공지를 저장하면 <strong>공지 알림을 켠 고객 1,180명</strong>에게 앱푸시가 바로 발송돼요.</p>
          <p class="hint inl-1169661891">발송 내역은 로그의 ‘알림 발송’에 기록돼요.</p>
        </div>
        <div class="dlg-f">
          <button type="button" class="btn" data-close="cf">취소</button>
          <button type="button" class="btn primary" id="cf-ok">저장하고 발송</button>
        </div>
      </dialog>
<div id="toast" class="toast" hidden role="status"></div>
    </main>
  </div>
</template>
