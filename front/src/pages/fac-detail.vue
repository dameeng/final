<script setup lang="ts">
import AdminSidebarLinks from '../components/AdminSidebarLinks.vue'
import MenuIcon from '../components/MenuIcon.vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { makeContext } from '../runtime/context'
import { enhance } from '../runtime/enhance'
import { initialize } from '../runtime/fac-detail.js'
import '../styles/fac-detail.css'
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
  enhance('fac-detail', runtime.ctx)
  handlers = initialize(runtime.ctx)
})
onBeforeUnmount(() => dispose?.())
</script>
<template>
  <div ref="root" class="wire-page page-fac-detail">
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
        <span>지하차도 관리 &gt; <strong class="inl-7891572d91">초량1지하차도</strong>
        </span>
        <span class="note"></span>
      </div>
<div class="page-head">
        <div>
          <h1 class="inl-3b9f772359">초량1지하차도 <span class="badge danger" id="h-badge">위험</span> <span class="stat ack" id="h-ctl">통제 중</span> <span class="stat work" id="h-manual" hidden>수동 표출 중</span>
          </h1>
          <div class="sub">부산 · 상세 주소 확인 필요</div>
        </div>
        <div class="row"><a class="btn" href="/fac-list">← 목록으로</a></div>
      </div>
<nav class="tabs big" id="tabs" aria-label="지하차도 상세 탭">
        <a href="#overview" data-t="overview">개요</a>
        <a href="#equip" data-t="equip">설비</a>
        <a href="#sign" data-t="sign">전광판</a>
        <a href="#cctv" data-t="cctv">CCTV</a>
        <a href="#settings" data-t="settings">설정</a>
      </nav>

<section class="sec" id="s-overview" aria-label="개요">
        <div id="warn" class="banner inl-87c136dfd0">
          <span class="badge danger">경고</span>
          <strong>입구 차단 중인데 차량이 3대 통과 중이에요.</strong>
          <span class="sub">현장 확인이 필요해요.</span>
          <button type="button" id="warn-close" aria-label="경고 배너 닫기">닫기 ×</button>
        </div>
<div class="grid2">
          <div class="card inl-e12feb99b2">
            <h2>위험 단계</h2>
<div class="inl-537397225e">
              <strong class="inl-a2600b0e71">76.4점</strong>
              <span class="badge danger">위험</span>
            </div>
<div class="gauge" aria-hidden="true">
              <b class="inl-5f8670ec1e"></b>
              <i class="inl-635b13e777"></i>
              <i class="inl-3aa0e379db"></i>
            </div>
            <small class="sub">주의 50점 이상 · 위험 70점 이상</small>
<div class="kv2">
              <div>
                <small>강우량</small>
                <strong>18.0 mm</strong>
              </div>
              <div>
                <small>위험도 관측</small>
                <strong>10:40</strong>
              </div>
            </div>
          </div>
<div class="card inl-e12feb99b2">
            <h2>통제</h2>
<div id="o-ctl" class="inl-86ecc8df25">입구 차단 중</div>
<div class="kv2">
              <div>
                <small>통과 중 차량</small>
                <strong id="o-cars">3대</strong>
              </div>
              <div>
                <small>차량 과다 기준</small>
                <strong>10대 이상</strong>
              </div>
            </div>
<div class="row inl-26d3d1951d">
              <button type="button" class="btn primary" id="b-block">통제</button>
              <button type="button" class="btn" id="b-release">통제 해제</button>
            </div>
          </div>
<div class="card inl-e12feb99b2">
            <div class="row inl-a562f4fd76">
              <h2>전광판 표출 문구</h2>
              <a href="#sign" class="inl-dea29d3fa0">전광판 탭 →</a>
            </div>
            <div class="sign" id="o-sign">입구 통제 중 · 우회 바랍니다</div>
            <div class="sub" id="o-mode">자동 표출 · 10:37 변경</div>
          </div>
<div class="card inl-be26537941">
            <h2>데이터 수신 상태</h2>
            <table class="tbl inl-3922d32600">
              <tbody>
                <tr>
                  <td>날씨(기상청)</td>
                  <td>10:40</td>
                  <td><span class="badge safe">정상</span></td>
                </tr>
                <tr>
                  <td>위험도(AI 서버)</td>
                  <td>10:40</td>
                  <td><span class="badge safe">정상</span></td>
                </tr>
                <tr>
                  <td>CCTV C-12</td>
                  <td>10:41</td>
                  <td><span class="badge safe">정상</span></td>
                </tr>
                <tr>
                  <td>번호판 수신</td>
                  <td>10:31</td>
                  <td><span class="badge warn">지연 11분</span></td>
                </tr>
              </tbody>
            </table>
            <span class="sub">서버 연결·수신 시각을 점검해요. 지연되면 종 알림과 로그에 남아요.</span>
          </div>
        </div>
<div class="split inl-1b0f4999d2">
          <section class="card inl-a9a0079586">
            <h2 class="inl-fdf33f2304">위험 점수 추이 · 최근 6시간 + 예측 6시간</h2>
            <svg
              class="chart"
              viewBox="0 0 640 170"
              role="img"
              aria-label="위험 점수 추이: 지금까지 실선, 이후 예측은 점선"
            >
              <rect x="330" y="20" width="290" height="110" fill="#eef0f3"></rect>
              <line x1="40" y1="130" x2="620" y2="130" stroke="#8a93a0"></line>
              <line x1="40" y1="45" x2="620" y2="45" stroke="#1f2630" stroke-dasharray="6 5"></line>
              <line x1="40" y1="75" x2="620" y2="75" stroke="#8a93a0" stroke-dasharray="6 5"></line>
              <text x="4" y="49" font-size="11">70</text>
              <text x="4" y="79" font-size="11">50</text>
              <line x1="330" y1="20" x2="330" y2="130" stroke="#1f2630"></line>
              <polyline
                points="60,118 110,114 160,108 210,100 260,88 310,74 330,64"
                fill="none"
                stroke="#2b5c8a"
                stroke-width="3"
              ></polyline>
              <polyline
                points="330,64 380,54 430,48 480,52 530,64 580,78 615,90"
                fill="none"
                stroke="#2b5c8a"
                stroke-width="3"
                stroke-dasharray="7 6"
              ></polyline>
              <text x="334" y="34" font-size="11">지금 10:40</text>
              <text x="540" y="34" font-size="11">예측</text>
              <text x="40" y="148" font-size="11">-6시간</text>
              <text x="600" y="148" font-size="11">+6시간</text>
            </svg>
            <div class="sub inl-96ad6099e2">실선 = 지금까지 · 점선 = 예측 · 예측 범위(6시간)는 확인 필요</div>
          </section>
<section class="card inl-f7fa60b1ba">
            <div class="row inl-a562f4fd76">
              <h2>최근 이벤트 <small class="sub inl-7e3a94476f">(차량 통과 제외)</small>
              </h2>
              <a
                href="/logs?facility=%EC%B4%88%EB%9F%891%EC%A7%80%ED%95%98%EC%B0%A8%EB%8F%84"
                class="inl-dea29d3fa0"
              >통합 로그에서 보기 →</a>
            </div>
            <ol class="tl inl-8a77e5a311">
              <li class="lv-danger">
                <time>10:42</time>
                <div>
                  <span class="cat">위험</span>
                  <strong>위험 단계로 상승</strong>
                </div>
              </li>
              <li>
                <time>10:37</time>
                <div>
                  <span class="cat">통제</span>
                  <strong>입구 차단</strong>
                  <small>수동 · 지역관리자</small>
                </div>
              </li>
              <li>
                <time>10:31</time>
                <div>
                  <span class="cat">전광판</span>
                  <strong>표출 문구 변경</strong>
                </div>
              </li>
            </ol>
          </section>
        </div>
      </section>

<section class="sec" id="s-equip" aria-label="설비">
        <div class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>설비</th>
                <th>유형</th>
                <th>위험 점수</th>
                <th>마지막 수신</th>
                <th>점검 상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>P-01</strong></td>
                <td>배수펌프</td>
                <td>
                  <span class="badge danger">위험</span> <strong>82</strong>
                </td>
                <td>10:42</td>
                <td><span class="stat new">점검 대기</span></td>
                <td><a class="btn sm" href="/pm-equipment-detail">예지보전 상세 →</a></td>
              </tr>
<tr>
                <td><strong>D-11</strong></td>
                <td>전광판</td>
                <td>
                  <span class="badge safe">안전</span> <strong>22</strong>
                </td>
                <td>10:42</td>
                <td><span class="sub">-</span></td>
                <td><a class="btn sm" href="/pm-equipment-detail">예지보전 상세 →</a></td>
              </tr>
<tr>
                <td><strong>C-12</strong></td>
                <td>CCTV</td>
                <td>
                  <span class="badge safe">안전</span> <strong>18</strong>
                </td>
                <td>10:41</td>
                <td><span class="sub">-</span></td>
                <td><a class="btn sm" href="/pm-equipment-detail">예지보전 상세 →</a></td>
              </tr>
            </tbody>
          </table>
        </div>
<p class="sub">설비의 점검 등록은 예지보전 메뉴에서 해요. 설비 정보는 읽기 전용이에요.</p>
      </section>

<section class="sec" id="s-sign" aria-label="전광판">
        <div class="grid2">
          <div class="card inl-e12feb99b2">
            <h2>현재 표출</h2>
            <div class="sign" id="t-sign">입구 통제 중 · 우회 바랍니다</div>
<div class="row">
              <span class="stat" id="t-mode">자동 표출</span>
              <span class="sub" id="t-sub">위험 단계와 통제 상태에 따라 자동으로 바뀌어요.</span>
            </div>
<button type="button" class="btn" id="t-auto" hidden>수동 해제 · 자동으로 복귀</button>
          </div>
<div class="card inl-e12feb99b2">
            <h2>수동 표출</h2>
<div class="field">
              <label for="m-pick">문구 선택</label>
              <select id="m-pick">
                <option value="">직접 입력</option>
                <option>입구 통제 중 · 우회 바랍니다</option>
                <option>침수 위험 · 진입 금지</option>
                <option>호우 주의 · 서행</option>
                <option>정상 통행</option>
              </select>
            </div>
<div class="field">
              <label for="m-text">문구 (최대 2줄)</label>
              <textarea
                id="m-text"
                maxlength="40"
                placeholder="전광판에 표출할 문구를 입력하세요."
              ></textarea>
            </div>
<button type="button" class="btn primary" id="m-go">수동 표출</button>
            <p class="sub inl-1169661891">실제 도로 전광판에 바로 표출돼요. 확인창 후 적용돼요.</p>
          </div>
        </div>
<section class="card inl-1b0f4999d2">
          <h2 class="inl-fdf33f2304">문구 템플릿 (단계별 자동 표출)</h2>
<div class="tbl-wrap inl-bb0c09db77">
            <table class="tbl inl-85c8a158b4">
              <thead>
                <tr>
                  <th class="inl-465bfea3ed">상황</th>
                  <th>표출 문구</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>안전</td>
                  <td><input value="정상 통행" class="inl-f9fca8ba1d" /></td>
                </tr>
<tr>
                  <td>주의</td>
                  <td><input value="호우 주의 · 서행" class="inl-f9fca8ba1d" /></td>
                </tr>
<tr>
                  <td>위험</td>
                  <td><input value="침수 위험 · 진입 금지" class="inl-f9fca8ba1d" /></td>
                </tr>
<tr>
                  <td>통제 중</td>
                  <td><input value="입구 통제 중 · 우회 바랍니다" class="inl-f9fca8ba1d" /></td>
                </tr>
              </tbody>
            </table>
          </div>
<div class="row inl-ded8e2eb21">
            <button type="button" class="btn primary" id="tp-save">템플릿 저장</button>
          </div>
        </section>
<section class="card inl-1b0f4999d2">
          <h2 class="inl-fdf33f2304">표출 이력</h2>
          <div class="tbl-wrap inl-bb0c09db77">
            <table class="tbl inl-85c8a158b4" id="shist">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>문구</th>
                  <th>방식</th>
                  <th>등록자</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>10:37</td>
                  <td>입구 통제 중 · 우회 바랍니다</td>
                  <td>자동</td>
                  <td>시스템</td>
                </tr>
                <tr>
                  <td>10:31</td>
                  <td>침수 위험 · 진입 금지</td>
                  <td>자동</td>
                  <td>시스템</td>
                </tr>
                <tr>
                  <td>09:20</td>
                  <td>호우 주의 · 서행</td>
                  <td>수동</td>
                  <td>○○○</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

<section class="sec" id="s-cctv" aria-label="CCTV">
        <div class="chips inl-da12f2858b" id="cams" role="group" aria-label="카메라 선택">
          <button type="button" class="chip" aria-pressed="true">입구(접근) 카메라</button>
          <button type="button" class="chip" aria-pressed="false">출구(최종) 카메라</button>
          <button type="button" class="chip" aria-pressed="false">일반 CCTV</button>
        </div>
<div class="split">
          <div class="inl-578e513210">
            <div class="video">
              <span class="live">LIVE</span>CCTV</div>
            <div class="row inl-8a77e5a311">
              <button type="button" class="btn" id="snap">스냅샷 저장</button>
              <span class="sub">CCTV C-12 · 마지막 수신 10:41</span>
            </div>
          </div>
<div class="card inl-2a443592bd">
            <h2 class="inl-fdf33f2304">최근 스냅샷 · 번호판 부분만</h2>
            <div class="thumbs inl-33e95ec3b4">
              <div class="inl-cdca58afb9">12가 3456</div>
              <div class="inl-cdca58afb9">34나 7890</div>
              <div class="inl-cdca58afb9">56다 1234</div>
              <div class="inl-cdca58afb9">미인식</div>
            </div>
            <p class="sub inl-c94d43e279">전체 화면이 아니라 번호판 영역만 잘라서 저장해요. 인식 실패 건은 수동 판별로 넘어가요.</p>
          </div>
        </div>
      </section>

<section class="sec" id="s-settings" aria-label="설정">
        <div class="split">
          <div class="inl-618de1801a">
            <section class="card">
              <h2 class="inl-da12f2858b">시설 정보</h2>
              <div class="form-grid">
                <div class="field">
                  <label for="a-n">시설명</label>
                  <input id="a-n" value="초량1지하차도" />
                </div>
<div class="field">
                  <label for="a-r">지역</label>
                  <select id="a-r">
                    <option>부산</option>
                  </select>
                </div>
<div class="field inl-068a8ddc17">
                  <label for="a-a">도로 주소</label>
                  <input id="a-a" value="부산 · 상세 주소 확인 필요" />
                </div>
<div class="field">
                  <label for="a-la">위도</label>
                  <input id="a-la" value="35.0000" />
                </div>
                <div class="field">
                  <label for="a-lo">경도</label>
                  <input id="a-lo" value="129.0000" />
                </div>
              </div>
<div class="row inl-7f0bff4a74">
                <button type="button" class="btn primary" id="a-save">시설 정보 저장</button>
              </div>
            </section>
<section class="card">
              <h2 class="inl-da12f2858b">침수 임계치</h2>
              <div class="form-grid">
                <div class="field">
                  <label for="t-w">주의 시작 (점)</label>
                  <input id="t-w" type="number" value="50" />
                </div>
                <div class="field">
                  <label for="t-d">위험 시작 (점)</label>
                  <input id="t-d" type="number" value="70" />
                </div>
              </div>
<div class="row inl-7f0bff4a74">
                <button type="button" class="btn primary" id="t-save">임계치 저장</button>
              </div>
<h3 class="inl-e47f8bb883">변경 이력</h3>
              <div class="tbl-wrap inl-bb0c09db77">
                <table class="tbl inl-e154f60266">
                  <thead>
                    <tr>
                      <th>일시</th>
                      <th>변경자</th>
                      <th>내용</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>2026-10-02 09:10</td>
                      <td>○○○</td>
                      <td>위험 시작 75 → 70</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
<section class="card">
              <h2 class="inl-da12f2858b">차량 과다 기준</h2>
              <div class="field inl-55585d51f2">
                <label for="c-n">통과 중 차량 (대 이상이면 경고)</label>
                <input id="c-n" type="number" value="10" />
              </div>
              <div class="row inl-7f0bff4a74">
                <button type="button" class="btn primary" id="c-save">기준 저장</button>
              </div>
            </section>
          </div>
<section class="card danger-zone inl-2a443592bd">
            <h2 class="inl-fdf33f2304">위험 구역</h2>
            <p class="inl-249d010502">삭제하면 지도와 목록, 고객 화면에서 사라져요. 이력과 로그는 그대로 보존되고, 목록의 ‘삭제된 시설 보기’에서 복원할 수 있어요. (소프트 삭제)</p>
            <button type="button" class="btn inl-a12222540b" id="del-open">이 지하차도 삭제</button>
          </section>
        </div>
      </section>

<dialog id="cf" aria-labelledby="cf-t">
        <div class="dlg-h"><h2 id="cf-t"></h2></div>
        <div class="dlg-b">
          <p id="cf-m" class="inl-1169661891"></p>
          <p class="sub inl-1169661891" id="cf-s">시설과 사유를 확인해 주세요.</p>
<div id="cf-rw" hidden class="inl-a56c85e3df">
            <div class="field">
              <label for="cf-r">사유 (필수)</label>
              <select id="cf-r">
                <option value="">사유 선택</option>
                <option>침수 위험</option>
                <option>수위 정상 복귀</option>
                <option>현장 확인 완료</option>
                <option>오경보</option>
                <option>기타</option>
              </select>
            </div>
            <div class="field">
              <label for="cf-rt">상세 사유 (선택)</label>
              <textarea id="cf-rt" placeholder="필요하면 현장 상황을 적어 주세요."></textarea>
            </div>
<div id="cf-rel" hidden class="sub inl-fe9c4cbfda">
              <b>해제 전 확인</b> · 통과 중 차량 0대 · 미처리 이상 1건 (P-01 점검 대기)</div>
<label class="inl-78d834e7c2">
              <input type="checkbox" id="cf-pdf" checked class="inl-3f4677db1a" />
              <span>
                <b>경찰·소방 전달 문서(PDF) 저장</b>
                <br />
              </span>
            </label>
          </div>
        </div>
        <div class="dlg-f">
          <button type="button" class="btn" data-close="cf">취소</button>
          <button type="button" class="btn primary" id="cf-ok">확인</button>
        </div>
      </dialog>
<dialog id="dl" aria-labelledby="dl-t">
        <div class="dlg-h"><h2 id="dl-t">지하차도 삭제</h2></div>
        <div class="dlg-b">
          <p class="inl-1169661891">삭제하려면 시설 이름 <strong>초량1지하차도</strong>를 입력하세요.</p>
          <div class="field">
            <input id="dl-in" aria-label="시설 이름 확인" placeholder="시설 이름 입력" />
          </div>
        </div>
        <div class="dlg-f">
          <button type="button" class="btn" data-close="dl">취소</button>
          <button type="button" class="btn primary inl-70da9b2a07" id="dl-ok" disabled>삭제</button>
        </div>
      </dialog>
<div id="toast" class="toast" hidden role="status"></div>
    </main>
  </div>
</template>
