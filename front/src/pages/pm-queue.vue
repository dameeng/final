<script setup lang="ts">
import AdminSidebarLinks from '../components/AdminSidebarLinks.vue'
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { makeContext } from '../runtime/context'
import { enhance } from '../runtime/enhance'
import { initialize } from '../runtime/pm-queue.js'
import '../styles/pm-queue.css'
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
  enhance('pm-queue', runtime.ctx)
  handlers = initialize(runtime.ctx)
})
onBeforeUnmount(() => dispose?.())
</script>
<template>
  <div ref="root" class="wire-page page-pm-queue">
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
    <AccountName class="user" />
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
<a href="/pm-equipment" aria-current="page">
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
        <span>예지보전 &gt; <strong class="inl-7891572d91">점검 대상·알림</strong>
        </span>
        <span class="note"></span>
      </div>
<div class="page-head">
        <h1>예지보전</h1>
        <div class="row"></div>
      </div>
      <nav class="tabs" aria-label="예지보전 탭">
        <a href="/pm-equipment">설비</a>
        <a href="/pm-queue" aria-current="page">점검 대상·알림 <span class="count">3</span>
        </a>
        <a href="/pm-history">점검 이력</a>
      </nav>
<div class="filters">
        <div class="chips" id="qchips" role="group" aria-label="처리 상태">
          <button type="button" class="chip" data-st="" aria-pressed="true">전체 <span class="sub">6</span>
          </button>
          <button type="button" class="chip" data-st="new" aria-pressed="false">신규 <span class="sub">3</span>
          </button>
          <button type="button" class="chip" data-st="ack" aria-pressed="false">확인 <span class="sub">1</span>
          </button>
          <button type="button" class="chip" data-st="work" aria-pressed="false">점검 중 <span class="sub">1</span>
          </button>
          <button type="button" class="chip" data-st="done" aria-pressed="false">조치 완료 <span class="sub">1</span>
          </button>
        </div>
<select aria-label="발생 사유">
          <option>사유 전체</option>
          <option>위험 진입</option>
          <option>주의 진입</option>
          <option>급상승</option>
          <option>데이터 미수신</option>
        </select>
<select aria-label="설비 유형">
          <option>유형 전체</option>
          <option>배수펌프</option>
          <option>전광판</option>
          <option>CCTV</option>
          <option>수위센서</option>
        </select>
      </div>
<div class="tbl-wrap">
        <table class="tbl" id="qtbl">
          <thead>
            <tr>
              <th>상태</th>
              <th>발생</th>
              <th>설비</th>
              <th>발생 사유</th>
              <th>위험 점수</th>
              <th>처리</th>
            </tr>
          </thead>
          <tbody>
            <tr data-st="new" data-i="0">
              <td><span class="stat new" id="st-0">신규</span></td>
              <td class="sub">10:20</td>
              <td>
                <a class="link" href="/pm-equipment-detail">P-01</a>
                <div class="sub">배수펌프 · 초량1지하차도</div>
              </td>
              <td>위험 진입</td>
              <td>
                <span class="badge danger">위험</span> <strong>82</strong>
              </td>
              <td id="act-0">
                <button type="button" class="btn sm q-act" data-i="0">확인</button>
              </td>
            </tr>
<tr data-st="new" data-i="1">
              <td><span class="stat new" id="st-1">신규</span></td>
              <td class="sub">10:12</td>
              <td>
                <a class="link" href="/pm-equipment-detail">C-02</a>
                <div class="sub">CCTV · 초량2지하차도</div>
              </td>
              <td>24시간 급상승 (+12)</td>
              <td>
                <span class="badge warn">주의</span> <strong>61</strong>
              </td>
              <td id="act-1">
                <button type="button" class="btn sm q-act" data-i="1">확인</button>
              </td>
            </tr>
<tr data-st="new" data-i="2">
              <td><span class="stat new" id="st-2">신규</span></td>
              <td class="sub">09:58</td>
              <td>
                <a class="link" href="/pm-equipment-detail">D-03</a>
                <div class="sub">전광판 · 우장춘지하차도</div>
              </td>
              <td>주의 진입</td>
              <td>
                <span class="badge warn">주의</span> <strong>55</strong>
              </td>
              <td id="act-2">
                <button type="button" class="btn sm q-act" data-i="2">확인</button>
              </td>
            </tr>
<tr data-st="ack" data-i="3">
              <td><span class="stat ack" id="st-3">확인</span></td>
              <td class="sub">09:30</td>
              <td>
                <a class="link" href="/pm-equipment-detail">C-05</a>
                <div class="sub">CCTV · 문현지하차도</div>
              </td>
              <td>데이터 미수신 (1시간 30분)</td>
              <td>
                <span class="badge safe">안전</span> <strong>31</strong>
              </td>
              <td id="act-3">
                <button type="button" class="btn sm q-act" data-i="3">점검 시작</button>
              </td>
            </tr>
<tr data-st="work" data-i="4">
              <td><span class="stat work" id="st-4">점검 중</span></td>
              <td class="sub">어제 17:40</td>
              <td>
                <a class="link" href="/pm-equipment-detail">P-04</a>
                <div class="sub">배수펌프 · 범천지하차도</div>
              </td>
              <td>주의 진입</td>
              <td>
                <span class="badge warn">주의</span> <strong>48</strong>
              </td>
              <td id="act-4">
                <button type="button" class="btn sm q-act" data-i="4">조치 등록</button>
              </td>
            </tr>
<tr data-st="done" data-i="5">
              <td><span class="stat done" id="st-5">조치 완료</span></td>
              <td class="sub">어제 09:10</td>
              <td>
                <a class="link" href="/pm-equipment-detail">P-06</a>
                <div class="sub">배수펌프 · 부산진시장지하차도</div>
              </td>
              <td>위험 진입</td>
              <td>
                <span class="badge danger">위험</span> <strong>72</strong>
              </td>
              <td id="act-5"><span class="sub">-</span></td>
            </tr>
          </tbody>
        </table>
      </div>
<p class="sub">새 항목이 생기면 상단 벨로 알림이 가고, 이 목록에는 <strong>신규</strong>로 쌓여요. 처리 흐름: 신규 → 확인 → 점검 중 → 조치 완료 (조치 등록 시 점검 이력에 기록)</p>
<dialog id="reg" aria-labelledby="reg-t">
        <form method="dialog" id="reg-form">
          <div class="dlg-h">
            <h2 id="reg-t">점검 등록</h2>
            <button type="button" class="btn sm" data-close="reg">닫기</button>
          </div>
<div class="dlg-b">
            <div class="field">
              <label>설비</label>
              <div class="ro" id="reg-eq">P-01 · 배수펌프 · 초량1지하차도</div>
            </div>
<div class="field">
              <label for="reg-at">점검 일시</label>
              <input id="reg-at" type="datetime-local" value="2026-10-11T10:50" />
            </div>
<div class="field">
              <label for="reg-type">조치 유형</label>
              <select id="reg-type">
                <option>현장 점검</option>
                <option>부품 교체</option>
                <option>설정 조정</option>
                <option>원격 확인</option>
                <option>이상 없음</option>
              </select>
            </div>
<div class="field">
              <label for="reg-memo">조치 내용</label>
              <textarea
                id="reg-memo"
                placeholder="어떤 점검과 조치를 했는지 적어 주세요."
              ></textarea>
            </div>
<div class="field">
              <label for="reg-res">점검 결과</label>
              <select id="reg-res">
                <option>정상 복구</option>
                <option>추가 점검 필요</option>
                <option>교체 필요</option>
              </select>
            </div>
<div class="field">
              <label>등록자</label>
              <div class="ro">○○○ (로그인 계정 자동 기록)</div>
            </div>
          </div>
<div class="dlg-f">
            <button type="button" class="btn" data-close="reg">취소</button>
            <button type="button" class="btn primary" id="reg-ok">등록</button>
          </div>
        </form>
      </dialog>
<div id="toast" class="toast" hidden role="status"></div>
    </main>
  </div>
</template>
