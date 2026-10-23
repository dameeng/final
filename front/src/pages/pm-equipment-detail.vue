<script setup lang="ts">
import AdminSidebarLinks from '../components/AdminSidebarLinks.vue'
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { makeContext } from '../runtime/context'
import { enhance } from '../runtime/enhance'
import { initialize } from '../runtime/pm-equipment-detail.js'
import '../styles/pm-equipment-detail.css'
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
  enhance('pm-equipment-detail', runtime.ctx)
  handlers = initialize(runtime.ctx)
})
onBeforeUnmount(() => dispose?.())
</script>
<template>
  <div ref="root" class="wire-page page-pm-equipment-detail">
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
        <span>예지보전 &gt; <a href="/pm-equipment" class="inl-36ec741785">설비</a> &gt; <strong class="inl-7891572d91">P-01</strong>
        </span>
        <span class="note"></span>
      </div>
<div class="page-head">
        <h1>설비 상세</h1>
        <div class="row">
          <a class="btn" href="/pm-equipment">← 목록으로</a>
          <button type="button" class="btn">이전 설비</button>
          <button type="button" class="btn">다음 설비</button>
        </div>
      </div>
<nav class="tabs" aria-label="예지보전 탭">
        <a href="/pm-equipment" aria-current="page">설비</a>
        <a href="/pm-queue">점검 대상·알림 <span class="count">3</span>
        </a>
        <a href="/pm-history">점검 이력</a>
      </nav>
<main class="inl-2b1e4d1ddb">
        <section class="card inl-2ef6307469" aria-label="설비 요약">
          <div>
            <div class="sub">배수펌프</div>
            <h2 class="inl-dd55ef68ea">P-01 · 초량1지하차도</h2>
<div class="row inl-8a77e5a311">
              <span class="badge danger">위험</span>
              <strong class="inl-881f70f973">82</strong>
              <span class="sub">/ 100</span>
              <span class="sub">· 7일 전 48 → ▲ 34</span>
            </div>
          </div>
<div class="kv2 inl-fe26a223c2">
            <div>
              <small>마지막 수신</small>
              <strong>10:42</strong>
            </div>
            <div>
              <small>최근 점검일</small>
              <strong>0000-00-00</strong>
            </div>
            <div>
              <small>7일 오류 횟수</small>
              <strong>7회</strong>
            </div>
            <div>
              <small>점검 상태</small>
              <strong>점검 대기</strong>
            </div>
          </div>
<div class="row">
            <a class="btn" href="#">지하차도로 이동</a>
            <button type="button" class="btn primary" id="d-reg">점검 등록</button>
          </div>
        </section>
<section class="card" aria-label="추이">
          <div class="row inl-a562f4fd76">
            <h2>추이 · 최근 7일</h2>
<div class="chips" id="mtabs" role="group" aria-label="지표 선택">
              <button type="button" class="chip" data-m="score" aria-pressed="true">위험 점수</button>
              <button type="button" class="chip" data-m="cur" aria-pressed="false">모터 전류 상승률</button>
              <button type="button" class="chip" data-m="vib" aria-pressed="false">진동</button>
              <button type="button" class="chip" data-m="err" aria-pressed="false">기동 오류</button>
            </div>
          </div>
<svg
            class="chart inl-8a77e5a311"
            id="trend"
            viewBox="0 0 1100 240"
            role="img"
            aria-label="최근 7일 추이"
          ></svg>
        </section>
<div class="split">
          <section class="card inl-11009c2d21" aria-label="판단 근거">
            <h2 class="inl-fdf33f2304">판단 근거</h2>
<div class="tbl-wrap inl-bb0c09db77">
              <table class="tbl inl-512bf91e30">
                <thead>
                  <tr>
                    <th>항목</th>
                    <th>현재 값</th>
                    <th>기준</th>
                    <th>기여 점수</th>
                    <th>판정</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>모터 전류 상승</td>
                    <td>34%</td>
                    <td>20% 초과</td>
                    <td>+30</td>
                    <td><strong>기준 초과</strong></td>
                  </tr>
<tr>
                    <td>기동 오류 횟수</td>
                    <td>7회 / 24시간</td>
                    <td>5회 이상</td>
                    <td>+25</td>
                    <td><strong>기준 초과</strong></td>
                  </tr>
<tr>
                    <td>배수 응답 지연</td>
                    <td>24초</td>
                    <td>30초 이상</td>
                    <td>+15</td>
                    <td>주의</td>
                  </tr>
<tr>
                    <td>진동 증가</td>
                    <td>5.8</td>
                    <td>7 이상</td>
                    <td>+12</td>
                    <td>주의</td>
                  </tr>
<tr class="inl-99dc03c66e">
                    <td colspan="3"><strong>합계</strong></td>
                    <td><strong>82</strong></td>
                    <td><strong>위험</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
<p class="ro inl-d870e82bc1">
              <strong>권장 조치</strong> · 펌프 모터와 배수 경로 점검을 권장합니다. </p>
          </section>
<section class="card inl-ade4ba0c4a" aria-label="점검 이력">
            <div class="row inl-a562f4fd76">
              <h2>최근 점검 이력</h2>
              <a href="/pm-history" class="inl-dea29d3fa0">전체 보기</a>
            </div>
<ul class="list inl-56f4356299">
              <li class="inl-06c8b5ed41">
                <span class="sub">0000-00-00 · ○○○</span>
                <span>조치 내용</span>
              </li>
              <li class="inl-06c8b5ed41">
                <span class="sub">0000-00-00 · ○○○</span>
                <span>조치 내용</span>
              </li>
            </ul>
          </section>
        </div>
      </main>
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
