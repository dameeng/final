<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { makeContext } from '../runtime/context'
import { mountClusters } from '../runtime/mapClusters'
import { enhance } from '../runtime/enhance'
import { initialize } from '../runtime/c-map.js'
import MapWeatherWidget from '../components/MapWeatherWidget.vue'
import BusanCctvViewer from '../components/BusanCctvViewer.vue'
const cctvOpen = ref(false),
  cctvName = ref('')
import '../styles/c-map.css'
const root = ref<HTMLElement>()
const router = useRouter()
let dispose: (() => void) | undefined
let handlers: Record<string, (event: Event) => void> = {}
function closeCctv() {
  ;(root.value?.querySelector('#pop') as HTMLDialogElement | null)?.close()
}
function handle(id: string, event: Event) {
  handlers[id]?.call(event.currentTarget, event)
}
onMounted(() => {
  if (!root.value) return
  const runtime = makeContext(root.value, router)
  dispose = runtime.dispose
  runtime.ctx.onCctvOpen = (name: string) => {
    cctvName.value = name
    cctvOpen.value = true
  }
  runtime.ctx.onCctvClose = () => (cctvOpen.value = false)
  enhance('c-map', runtime.ctx)
  handlers = initialize(runtime.ctx)
  mountClusters(root.value, runtime.ctx, 'c-map')
})
onBeforeUnmount(() => dispose?.())
</script>
<template>
  <div ref="root" class="wire-page page-c-map">
    <header class="top">
      <div class="in">
        <a class="logo" href="/c-map">ROUTEL</a>
        <nav aria-label="주 메뉴">
          <a href="/c-app">About us</a>
          <a href="#" aria-current="page">지하차도 현황</a>
          <a href="/c-notice">알림마당</a>
          <a href="#">연계사이트</a>
        </nav>
        <a class="btn dl" href="/c-app#install">⬇ 앱 다운로드</a>
        <a class="btn" href="/c-auth">로그인</a>
        <a class="btn" href="/c-auth">회원가입</a>
      </div>
    </header>

<div class="app">
      <aside class="panel" aria-label="지하차도 목록">
        <div class="ph">
          <h2>지하차도 <span class="sub">부산 · 8곳</span>
          </h2>
          <input type="search" id="q" placeholder="지하차도 이름 검색" aria-label="검색" />
          <div class="seg" id="seg">
            <button type="button" class="chip" aria-pressed="true" data-l="">전체</button>
            <button type="button" class="chip" aria-pressed="false" data-l="위험">위험</button>
            <button type="button" class="chip" aria-pressed="false" data-l="주의">주의</button>
            <button type="button" class="chip" aria-pressed="false" data-l="안전">안전</button>
          </div>
        </div>
        <ul class="lst" id="lst">
          <li>
            <button type="button" class="it" data-i="0">
              <span class="lvb danger">위험</span>
              <span>
                <strong>초량1지하차도</strong>
                <small>통제 중 · 부산 · 상세 주소 확인 필요</small>
              </span>
            </button>
          </li>
          <li>
            <button type="button" class="it" data-i="1">
              <span class="lvb warn">주의</span>
              <span>
                <strong>초량2지하차도</strong>
                <small>정상 운영 · 부산 · 상세 주소 확인 필요</small>
              </span>
            </button>
          </li>
          <li>
            <button type="button" class="it" data-i="2">
              <span class="lvb warn">주의</span>
              <span>
                <strong>우장춘지하차도</strong>
                <small>정상 운영 · 부산 · 상세 주소 확인 필요</small>
              </span>
            </button>
          </li>
          <li>
            <button type="button" class="it" data-i="3">
              <span class="lvb safe">안전</span>
              <span>
                <strong>범천지하차도</strong>
                <small>정상 운영 · 부산 · 상세 주소 확인 필요</small>
              </span>
            </button>
          </li>
          <li>
            <button type="button" class="it" data-i="4">
              <span class="lvb safe">안전</span>
              <span>
                <strong>문현지하차도</strong>
                <small>정상 운영 · 부산 · 상세 주소 확인 필요</small>
              </span>
            </button>
          </li>
          <li>
            <button type="button" class="it" data-i="5">
              <span class="lvb safe">안전</span>
              <span>
                <strong>부산진시장지하차도</strong>
                <small>정상 운영 · 부산 · 상세 주소 확인 필요</small>
              </span>
            </button>
          </li>
          <li>
            <button type="button" class="it" data-i="6">
              <span class="lvb safe">안전</span>
              <span>
                <strong>좌동지하차도</strong>
                <small>정상 운영 · 부산 · 상세 주소 확인 필요</small>
              </span>
            </button>
          </li>
          <li>
            <button type="button" class="it" data-i="7">
              <span class="lvb safe">안전</span>
              <span>
                <strong>수영강변지하차도</strong>
                <small>정상 운영 · 부산 · 상세 주소 확인 필요</small>
              </span>
            </button>
          </li>
        </ul>
      </aside>
<main class="mapw" aria-label="지도">
        <svg
          viewBox="0 0 560 640"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="부산 지하차도 지도 "
        >
          <rect width="560" height="640" fill="#e4eef7"></rect>
          <path d="M0 0H560V120C450 150 420 90 300 130S100 100 0 150Z" fill="#dce8f3"></path>
          <g stroke="#d3dfeb" stroke-width="1">
            <path d="M0 160H560 M0 320H560 M0 480H560 M140 0V640 M280 0V640 M420 0V640"></path>
          </g>
          <path d="M0 560C100 520 180 590 290 555S470 520 560 560V640H0Z" fill="#d6e0ea"></path>
          <circle
            id="me"
            cx="400"
            cy="540"
            r="9"
            fill="#0b6bcb"
            stroke="#fff"
            stroke-width="3"
          ></circle>
          <text x="16" y="626" font-size="12" fill="#5a6b82">시설 위치</text>
          <circle
            id="ring"
            cx="257"
            cy="255"
            r="24"
            fill="none"
            stroke="#0b6bcb"
            stroke-width="3"
            stroke-dasharray="4 3"
            pointer-events="none"
          ></circle>
          <g class="mk" data-i="0" tabindex="0" role="button" aria-label="초량1지하차도 위험">
            <circle cx="257" cy="255" r="21" fill="transparent"></circle>
            <circle cx="257" cy="255" r="13" fill="#c62828" stroke="#fff" stroke-width="3"></circle>
            <text x="257" y="259" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">!</text>
          </g>
          <g class="mk" data-i="1" tabindex="0" role="button" aria-label="초량2지하차도 주의">
            <circle cx="156" cy="323" r="18" fill="transparent"></circle>
            <circle
              cx="156"
              cy="323"
              r="10"
              fill="#fff1d6"
              stroke="#f0a020"
              stroke-width="4"
            ></circle>
          </g>
          <g class="mk" data-i="2" tabindex="0" role="button" aria-label="우장춘지하차도 주의">
            <circle cx="343" cy="366" r="18" fill="transparent"></circle>
            <circle
              cx="343"
              cy="366"
              r="10"
              fill="#fff1d6"
              stroke="#f0a020"
              stroke-width="4"
            ></circle>
          </g>
          <g class="mk" data-i="3" tabindex="0" role="button" aria-label="범천지하차도 안전">
            <circle cx="195" cy="510" r="16" fill="transparent"></circle>
            <circle cx="195" cy="510" r="8" fill="#1b7f5c" stroke="#fff" stroke-width="3"></circle>
          </g>
          <g class="mk" data-i="4" tabindex="0" role="button" aria-label="문현지하차도 안전">
            <circle cx="421" cy="493" r="16" fill="transparent"></circle>
            <circle cx="421" cy="493" r="8" fill="#1b7f5c" stroke="#fff" stroke-width="3"></circle>
          </g>
          <g class="mk" data-i="5" tabindex="0" role="button" aria-label="부산진시장지하차도 안전">
            <circle cx="484" cy="289" r="16" fill="transparent"></circle>
            <circle cx="484" cy="289" r="8" fill="#1b7f5c" stroke="#fff" stroke-width="3"></circle>
          </g>
          <g class="mk" data-i="6" tabindex="0" role="button" aria-label="좌동지하차도 안전">
            <circle cx="296" cy="578" r="16" fill="transparent"></circle>
            <circle cx="296" cy="578" r="8" fill="#1b7f5c" stroke="#fff" stroke-width="3"></circle>
          </g>
          <g class="mk" data-i="7" tabindex="0" role="button" aria-label="수영강변지하차도 안전">
            <circle cx="94" cy="527" r="16" fill="transparent"></circle>
            <circle cx="94" cy="527" r="8" fill="#1b7f5c" stroke="#fff" stroke-width="3"></circle>
          </g>
        </svg>
<MapWeatherWidget />
        <div class="mtop">
          <div class="pill">
            <span>
              <i class="inl-f2f8641be2"></i>위험</span>
            <span>
              <i class="inl-b551fc4d37"></i>주의</span>
            <span>
              <i class="inl-8822313736"></i>안전</span>
            <span>
              <i class="inl-6f9f75262f"></i>내 위치</span>
          </div>
        </div>
<div class="alertbar" role="alert">
          <strong>■ 위험</strong>
          <span>초량1지하차도 침수 위험으로 통제 중이에요.</span>
        </div>
      </main>
<aside class="panel" aria-label="선택한 지하차도">
        <div class="det" id="det" aria-live="polite">
          <div class="sub" id="ts">2026.10.13 10:40 기준</div>
<div>
            <h2 class="nm" id="n"></h2>
            <div class="sub" id="a"></div>
          </div>
          <div class="inl-3de8f987ba">
            <span class="lvb" id="lv"></span>
            <span class="lvb inl-0eca59142d" id="ct"></span>
          </div>
<div class="kv">
            <div>
              <small>위험 점수</small>
              <strong id="sc"></strong>
            </div>
            <div>
              <small>통제 상태</small>
              <strong id="ct2"></strong>
            </div>
          </div>
<button type="button" class="btn" id="more" aria-expanded="true">상세 접기 ▴</button>
<div id="ext" class="inl-c7da9158e3">
            <div class="kv">
              <div>
                <small>현재 강수량</small>
                <strong id="r"></strong>
              </div>
              <div>
                <small>인근 날씨</small>
                <strong id="w" class="inl-5e0faad207"></strong>
              </div>
            </div>
<div class="route inl-f0abc1db33">
              <h2 class="inl-de00808e96">위험도 추이 · 예측</h2>
              <div id="tr"></div>
              <div class="sub">
                <span class="inl-d9fbc26031">━</span> 현재까지  <span class="inl-d9fbc26031">┅</span> 예측</div>
            </div>
<button type="button" class="btn" id="cctvb">▶ 현재 CCTV 보기 (이 지하차도만)</button>
<div class="sub inl-8b566c1e11">시간대별 예보·3일 예보와 우회 길 안내는 <b>앱</b>에서 확인해요. <a href="#" class="inl-c8504836ee">앱 다운로드 →</a>
            </div>
          </div>
        </div>
      </aside>
    </div>

<button type="button" class="bot-fab">챗봇 문의</button>

<dialog
      id="pop"
      class="cctv-dialog"
      aria-labelledby="cctv-title"
      aria-describedby="cctv-description"
    >
      <header class="cctv-dialog-header">
        <h2 id="cctv-title">
          <span id="pn"></span> · CCTV</h2>
        <button type="button" class="cctv-dialog-close" id="px" aria-label="CCTV 닫기" autofocus>닫기 <span aria-hidden="true">×</span>
        </button>
      </header>
 <BusanCctvViewer v-if="cctvOpen" :facility-name="cctvName" />
 <p id="cctv-description" class="cctv-dialog-caption">부산시에서 제공하는 인근 도로 CCTV를 표시합니다.</p>
 <footer class="cctv-confirm-footer">
        <button type="button" @click="closeCctv">확인</button>
      </footer>
    </dialog>
  </div>
</template>
