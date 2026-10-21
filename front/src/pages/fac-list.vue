<script setup lang="ts">
import AdminSidebarLinks from '../components/AdminSidebarLinks.vue'
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { makeContext } from '../runtime/context'
import { enhance } from '../runtime/enhance'
import { initialize } from '../runtime/fac-list.js'
import '../styles/fac-list.css'
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
  enhance('fac-list', runtime.ctx)
  handlers = initialize(runtime.ctx)
})
onBeforeUnmount(() => dispose?.())
</script>
<template>
  <div ref="root" class="wire-page page-fac-list">
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
        <span>지하차도 관리</span>
        <span class="note"></span>
      </div>
<div class="page-head">
        <h1>지하차도 관리</h1>
        <div class="row"><a class="btn primary" href="/fac-new">+ 지하차도 등록</a></div>
      </div>
<div class="filters" role="search">
        <div class="chips" id="lvchips" role="group" aria-label="위험 단계">
          <button type="button" class="chip" data-lv="" aria-pressed="true">전체</button>
          <button type="button" class="chip" data-lv="위험" aria-pressed="false">위험</button>
          <button type="button" class="chip" data-lv="주의" aria-pressed="false">주의</button>
          <button type="button" class="chip" data-lv="안전" aria-pressed="false">안전</button>
        </div>
<select id="f-ctl" aria-label="통제 상태">
          <option value="">통제 상태 전체</option>
          <option value="BLOCKED">통제 중</option>
          <option value="OPEN">정상 운영</option>
        </select>
<input type="search" id="f-q" placeholder="지하차도 이름 검색" aria-label="검색" />
<label class="inl-6146cae132">
          <input type="checkbox" id="f-del" /> 삭제된 시설 보기</label>
<span class="sub inl-6d00061700" id="f-count">총 8곳</span>
      </div>
<div class="tbl-wrap">
        <table class="tbl inl-65fcbf5650" id="tbl">
          <thead>
            <tr>
              <th>지하차도</th>
              <th>위험 단계 · 점수</th>
              <th>통제</th>
              <th>통과 중 차량</th>
              <th>설비</th>
              <th>마지막 수신</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr data-lv="위험" data-ctl="BLOCKED" data-text="초량1지하차도">
              <td><button type="button" class="link row-open" data-i="0">초량1지하차도</button></td>
              <td>
                <span class="badge danger">위험</span> <strong>76.4</strong>
              </td>
              <td><span class="stat ack">통제 중</span></td>
              <td>3대</td>
              <td>
                <strong>이상 1</strong> / 3</td>
              <td>10:42</td>
              <td>
                <a
                  class="btn sm"
                  href="/fac-detail"
                  target="_blank"
                  rel="noopener"
                  aria-label="초량1지하차도 새 탭에서 열기"
                >새 탭 ↗</a>
              </td>
            </tr>
<tr data-lv="주의" data-ctl="OPEN" data-text="초량2지하차도">
              <td><button type="button" class="link row-open" data-i="1">초량2지하차도</button></td>
              <td>
                <span class="badge warn">주의</span> <strong>54.8</strong>
              </td>
              <td><span class="sub">정상 운영</span></td>
              <td>7대</td>
              <td>
                <strong>이상 1</strong> / 3</td>
              <td>10:41</td>
              <td>
                <a
                  class="btn sm"
                  href="/fac-detail"
                  target="_blank"
                  rel="noopener"
                  aria-label="초량2지하차도 새 탭에서 열기"
                >새 탭 ↗</a>
              </td>
            </tr>
<tr data-lv="주의" data-ctl="OPEN" data-text="우장춘지하차도">
              <td>
                <button type="button" class="link row-open" data-i="2">우장춘지하차도</button>
              </td>
              <td>
                <span class="badge warn">주의</span> <strong>52.1</strong>
              </td>
              <td><span class="sub">정상 운영</span></td>
              <td>5대</td>
              <td>
                <strong>이상 1</strong> / 3</td>
              <td>10:42</td>
              <td>
                <a
                  class="btn sm"
                  href="/fac-detail"
                  target="_blank"
                  rel="noopener"
                  aria-label="우장춘지하차도 새 탭에서 열기"
                >새 탭 ↗</a>
              </td>
            </tr>
<tr data-lv="안전" data-ctl="OPEN" data-text="범천지하차도">
              <td><button type="button" class="link row-open" data-i="3">범천지하차도</button></td>
              <td>
                <span class="badge safe">안전</span> <strong>21.3</strong>
              </td>
              <td><span class="sub">정상 운영</span></td>
              <td>2대</td>
              <td>
                <strong>이상 1</strong> / 3</td>
              <td>10:40</td>
              <td>
                <a
                  class="btn sm"
                  href="/fac-detail"
                  target="_blank"
                  rel="noopener"
                  aria-label="범천지하차도 새 탭에서 열기"
                >새 탭 ↗</a>
              </td>
            </tr>
<tr data-lv="안전" data-ctl="OPEN" data-text="문현지하차도">
              <td><button type="button" class="link row-open" data-i="4">문현지하차도</button></td>
              <td>
                <span class="badge safe">안전</span> <strong>18.0</strong>
              </td>
              <td><span class="sub">정상 운영</span></td>
              <td>1대</td>
              <td>이상 없음</td>
              <td>09:12</td>
              <td>
                <a
                  class="btn sm"
                  href="/fac-detail"
                  target="_blank"
                  rel="noopener"
                  aria-label="문현지하차도 새 탭에서 열기"
                >새 탭 ↗</a>
              </td>
            </tr>
<tr data-lv="안전" data-ctl="OPEN" data-text="부산진시장지하차도">
              <td>
                <button type="button" class="link row-open" data-i="5">부산진시장지하차도</button>
              </td>
              <td>
                <span class="badge safe">안전</span> <strong>15.2</strong>
              </td>
              <td><span class="sub">정상 운영</span></td>
              <td>0대</td>
              <td>이상 없음</td>
              <td>10:42</td>
              <td>
                <a
                  class="btn sm"
                  href="/fac-detail"
                  target="_blank"
                  rel="noopener"
                  aria-label="부산진시장지하차도 새 탭에서 열기"
                >새 탭 ↗</a>
              </td>
            </tr>
<tr data-lv="안전" data-ctl="OPEN" data-text="센텀1지하차도">
              <td><button type="button" class="link row-open" data-i="6">센텀1지하차도</button></td>
              <td>
                <span class="badge safe">안전</span> <strong>12.7</strong>
              </td>
              <td><span class="sub">정상 운영</span></td>
              <td>4대</td>
              <td>이상 없음</td>
              <td>10:42</td>
              <td>
                <a
                  class="btn sm"
                  href="/fac-detail"
                  target="_blank"
                  rel="noopener"
                  aria-label="센텀1지하차도 새 탭에서 열기"
                >새 탭 ↗</a>
              </td>
            </tr>
<tr data-lv="안전" data-ctl="OPEN" data-text="좌동지하차도">
              <td><button type="button" class="link row-open" data-i="7">좌동지하차도</button></td>
              <td>
                <span class="badge safe">안전</span> <strong>9.9</strong>
              </td>
              <td><span class="sub">정상 운영</span></td>
              <td>0대</td>
              <td>이상 없음</td>
              <td>10:41</td>
              <td>
                <a
                  class="btn sm"
                  href="/fac-detail"
                  target="_blank"
                  rel="noopener"
                  aria-label="좌동지하차도 새 탭에서 열기"
                >새 탭 ↗</a>
              </td>
            </tr>
<tr
              class="deleted"
              data-lv="삭제"
              data-ctl="OPEN"
              data-text="삭제된지하차도"
              data-deleted="1"
              hidden
            >
              <td><span>□□(구)지하차도</span></td>
              <td><span class="stat done">삭제됨</span></td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>2026-09-28</td>
              <td><button type="button" class="btn sm" id="restore">복원</button></td>
            </tr>
          </tbody>
        </table>
      </div>
<p class="sub">이름을 누르면 요약 서랍이 열려요. 여러 지하차도를 나란히 보고 싶으면 ‘새 탭 ↗’로 각각 열어 보세요. 지하차도마다 주소가 고정이에요.</p>

<aside id="peek" class="drawer" hidden aria-label="지하차도 요약">
        <div class="dh">
          <div>
            <div class="sub" id="p-addr"></div>
            <h2 id="p-name" class="inl-85d138b8f7"></h2>
<div class="row inl-8a77e5a311">
              <span class="badge" id="p-badge"></span>
              <span class="stat" id="p-ctl"></span>
            </div>
          </div>
          <button type="button" class="btn sm" id="peek-close">닫기</button>
        </div>
<div class="db">
          <div>
            <div class="inl-537397225e">
              <strong id="p-score" class="inl-881f70f973"></strong>
              <small class="sub">위험 점수</small>
            </div>
<div class="gauge" aria-hidden="true">
              <b id="p-g"></b>
              <i class="inl-635b13e777"></i>
              <i class="inl-3aa0e379db"></i>
            </div>
          </div>
<div class="kv2">
            <div>
              <small>통과 중 차량</small>
              <strong id="p-cars"></strong>
            </div>
            <div>
              <small>마지막 수신</small>
              <strong id="p-rx"></strong>
            </div>
          </div>
<div id="p-warn" class="banner" hidden>
            <span class="badge danger">경고</span>
            <strong>입구 차단 중인데 차량이 통과 중이에요</strong>
          </div>
<div>
            <h3 class="inl-15066bbcff">설비</h3>
            <ul class="list" id="p-devs"></ul>
          </div>
<div class="row">
            <a class="btn primary inl-061383821c" href="/fac-detail">상세 보기 →</a>
            <a class="btn inl-061383821c" href="/fac-detail" target="_blank" rel="noopener">새 탭에서 열기 ↗</a>
          </div>
        </div>
      </aside>
<div id="toast" class="toast" hidden role="status"></div>
    </main>
  </div>
</template>
