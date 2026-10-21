<script setup lang="ts">
import AdminSidebarLinks from '../components/AdminSidebarLinks.vue'
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { makeContext } from '../runtime/context'
import { enhance } from '../runtime/enhance'
import { initialize } from '../runtime/cs-content.js'
import '../styles/cs-content.css'
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
  enhance('cs-content', runtime.ctx)
  handlers = initialize(runtime.ctx)
})
onBeforeUnmount(() => dispose?.())
</script>
<template>
  <div ref="root" class="wire-page page-cs-content">
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
        <span>고객 서비스 &gt; 공지·FAQ</span>
        <span class="note"></span>
      </div>
<div class="page-head">
        <h1>고객 서비스</h1>
        <div class="row">
          <a class="btn primary" id="add-n" href="/cs-notice-edit">+ 공지 등록</a>
          <button type="button" class="btn primary" id="add-f" hidden>+ FAQ 등록</button>
        </div>
      </div>
      <nav class="tabs" aria-label="고객 서비스 탭">
        <a href="/cs-customers">고객 조회</a>
        <a href="/cs-inquiries">문의 처리 <span class="count">2</span>
        </a>
        <a href="/cs-content" aria-current="page">공지·FAQ</a>
      </nav>
<div class="filters">
        <div class="seg" role="group" aria-label="공지 FAQ 전환">
          <button type="button" id="sg-n" aria-pressed="true">공지</button>
          <button type="button" id="sg-f" aria-pressed="false">FAQ</button>
        </div>
<select id="cat-n" aria-label="공지 분류">
          <option value="">분류 전체</option>
          <option>안내</option>
          <option>점검</option>
          <option>업데이트</option>
          <option>긴급</option>
        </select>
<select id="cat-f" aria-label="FAQ 분류" hidden>
          <option value="">분류 전체</option>
          <option>이용 방법</option>
          <option>알림·푸시</option>
          <option>차량·번호판</option>
          <option>계정</option>
          <option>기타</option>
        </select>
<input type="search" id="q" placeholder="제목 검색" aria-label="검색" />
      </div>

<div id="pn">
        <div class="tbl-wrap">
          <table class="tbl inl-70ca2987b3" id="tbl-n">
            <thead>
              <tr>
                <th>고정</th>
                <th>분류</th>
                <th>제목</th>
                <th>게시 기간</th>
                <th>앱푸시</th>
                <th>조회</th>
                <th>등록일</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              <tr data-text="초량1지하차도 침수 위험 · 우회 안내" data-cat="긴급">
                <td><span class="pin">고정</span></td>
                <td><span class="cat urgent">긴급</span></td>
                <td>
                  <button type="button" class="link row-open inl-daddc535e8" data-i="0" data-k="n">초량1지하차도 침수 위험 · 우회 안내</button>
                </td>
                <td>상시</td>
                <td>발송됨</td>
                <td>3,120</td>
                <td>2026-10-11</td>
                <td><span class="stat new">게시 중</span></td>
              </tr>
<tr data-text="시스템 점검 안내 (10/15 02:00~04:00)" data-cat="점검">
                <td><span class="pin">고정</span></td>
                <td><span class="cat">점검</span></td>
                <td>
                  <button type="button" class="link row-open inl-daddc535e8" data-i="1" data-k="n">시스템 점검 안내 (10/15 02:00~04:00)</button>
                </td>
                <td>10-12 ~ 10-15</td>
                <td>발송됨</td>
                <td>1,870</td>
                <td>2026-10-11</td>
                <td><span class="stat new">게시 중</span></td>
              </tr>
<tr data-text="앱 v1.2 업데이트 안내" data-cat="업데이트">
                <td></td>
                <td><span class="cat">업데이트</span></td>
                <td>
                  <button type="button" class="link row-open inl-daddc535e8" data-i="2" data-k="n">앱 v1.2 업데이트 안내</button>
                </td>
                <td>상시</td>
                <td>-</td>
                <td>540</td>
                <td>2026-10-08</td>
                <td><span class="stat new">게시 중</span></td>
              </tr>
<tr data-text="우회로 안내 기능 오픈 예정" data-cat="안내">
                <td></td>
                <td><span class="cat">안내</span></td>
                <td>
                  <button type="button" class="link row-open inl-daddc535e8" data-i="3" data-k="n">우회로 안내 기능 오픈 예정</button>
                </td>
                <td>10-20 ~ 상시</td>
                <td>-</td>
                <td>0</td>
                <td>2026-10-10</td>
                <td><span class="stat work">예약</span></td>
              </tr>
<tr data-text="서비스 이용 안내" data-cat="안내">
                <td></td>
                <td><span class="cat">안내</span></td>
                <td>
                  <button type="button" class="link row-open inl-daddc535e8" data-i="4" data-k="n">서비스 이용 안내</button>
                </td>
                <td>상시</td>
                <td>-</td>
                <td>2,210</td>
                <td>2026-09-02</td>
                <td><span class="stat new">게시 중</span></td>
              </tr>
<tr data-text="정기 점검 안내 (9월)" data-cat="점검">
                <td></td>
                <td><span class="cat">점검</span></td>
                <td>
                  <button type="button" class="link row-open inl-daddc535e8" data-i="5" data-k="n">정기 점검 안내 (9월)</button>
                </td>
                <td>09-20 ~ 09-21</td>
                <td>발송됨</td>
                <td>980</td>
                <td>2026-09-18</td>
                <td><span class="stat done">종료</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
<div id="pf" hidden>
        <div class="tbl-wrap">
          <table class="tbl inl-af5b40819b" id="tbl-f">
            <thead>
              <tr>
                <th class="inl-7c07cdf8bd">순서</th>
                <th>분류</th>
                <th>질문</th>
                <th>조회</th>
                <th>공개</th>
              </tr>
            </thead>
            <tbody>
              <tr data-text="위험 알림은 언제 오나요?" data-cat="이용 방법">
                <td class="inl-86abdab991">1 <button type="button" class="btn sm mini" aria-label="위로">↑</button> <button type="button" class="btn sm mini" aria-label="아래로">↓</button>
                </td>
                <td><span class="cat">이용 방법</span></td>
                <td>
                  <button type="button" class="link row-open inl-daddc535e8" data-i="0" data-k="f">위험 알림은 언제 오나요?</button>
                </td>
                <td>640</td>
                <td>공개</td>
              </tr>
<tr data-text="알림이 오지 않아요" data-cat="알림·푸시">
                <td class="inl-86abdab991">2 <button type="button" class="btn sm mini" aria-label="위로">↑</button> <button type="button" class="btn sm mini" aria-label="아래로">↓</button>
                </td>
                <td><span class="cat">알림·푸시</span></td>
                <td>
                  <button type="button" class="link row-open inl-daddc535e8" data-i="1" data-k="f">알림이 오지 않아요</button>
                </td>
                <td>520</td>
                <td>공개</td>
              </tr>
<tr data-text="차량 번호는 몇 대까지 등록되나요?" data-cat="차량·번호판">
                <td class="inl-86abdab991">3 <button type="button" class="btn sm mini" aria-label="위로">↑</button> <button type="button" class="btn sm mini" aria-label="아래로">↓</button>
                </td>
                <td><span class="cat">차량·번호판</span></td>
                <td>
                  <button type="button" class="link row-open inl-daddc535e8" data-i="2" data-k="f">차량 번호는 몇 대까지 등록되나요?</button>
                </td>
                <td>410</td>
                <td>공개</td>
              </tr>
<tr data-text="비밀번호를 바꾸고 싶어요" data-cat="계정">
                <td class="inl-86abdab991">4 <button type="button" class="btn sm mini" aria-label="위로">↑</button> <button type="button" class="btn sm mini" aria-label="아래로">↓</button>
                </td>
                <td><span class="cat">계정</span></td>
                <td>
                  <button type="button" class="link row-open inl-daddc535e8" data-i="3" data-k="f">비밀번호를 바꾸고 싶어요</button>
                </td>
                <td>180</td>
                <td>공개</td>
              </tr>
<tr data-text="우회로 안내는 어떻게 쓰나요?" data-cat="기타">
                <td class="inl-86abdab991">5 <button type="button" class="btn sm mini" aria-label="위로">↑</button> <button type="button" class="btn sm mini" aria-label="아래로">↓</button>
                </td>
                <td><span class="cat">기타</span></td>
                <td>
                  <button type="button" class="link row-open inl-daddc535e8" data-i="4" data-k="f">우회로 안내는 어떻게 쓰나요?</button>
                </td>
                <td>95</td>
                <td>비공개</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="hint">조회수가 높은 질문 3~5개가 고객 화면 ‘자주 보는 질문’에 자동으로 올라가요.</p>
      </div>

<aside id="peek" class="drawer" hidden aria-label="미리보기">
        <div class="dh">
          <div>
            <div class="sub" id="p-meta"></div>
            <h2 id="p-title" class="inl-5351578d8b"></h2>
            <div class="row inl-8a77e5a311">
              <span class="cat" id="p-cat"></span>
              <span class="stat" id="p-st"></span>
            </div>
          </div>
          <button type="button" class="btn sm" id="peek-close">닫기</button>
        </div>
<div class="db">
          <div class="body-txt" id="p-body"></div>
          <div class="row">
            <button type="button" class="btn primary inl-97445a8d93" id="p-edit">수정</button>
            <button type="button" class="btn inl-97445a8d93">삭제</button>
          </div>
        </div>
      </aside>

<dialog id="fq" aria-labelledby="fq-t">
        <div class="dlg-h">
          <h2 id="fq-t">FAQ 등록</h2>
          <button type="button" class="btn sm" data-close="fq">닫기</button>
        </div>
<div class="dlg-b">
          <div class="field">
            <label for="fq-c">분류</label>
            <select id="fq-c">
              <option>이용 방법</option>
              <option>알림·푸시</option>
              <option>차량·번호판</option>
              <option>계정</option>
              <option>기타</option>
            </select>
          </div>
<div class="field">
            <label for="fq-q">질문</label>
            <input id="fq-q" placeholder="고객이 자주 묻는 질문" />
          </div>
          <div class="field">
            <label for="fq-a">답변</label>
            <textarea id="fq-a" class="inl-2faa5e340c"></textarea>
          </div>
<label class="inl-0ec57706e6">
            <input type="checkbox" checked /> 고객 화면에 공개</label>
        </div>
<div class="dlg-f">
          <button type="button" class="btn" data-close="fq">취소</button>
          <button type="button" class="btn primary" id="fq-ok">저장</button>
        </div>
      </dialog>
<div id="toast" class="toast" hidden role="status"></div>
    </main>
  </div>
</template>
