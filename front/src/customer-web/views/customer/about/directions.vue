<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

// 지하차도 통제 현황 지도(underpass-map.vue)와 같은 카카오 지도 JavaScript 키
const KAKAO_JAVASCRIPT_KEY = "5e63dfabf16ffc6cde7a3831d301be65";
// 부평역 (인천 부평구)
const LOCATION = { name: "부평역", latitude: 37.489493, longitude: 126.724485 };

const mapEl = ref<HTMLDivElement | null>(null);
const mapError = ref("");
let alive = true;
let poll = 0;
let watchdog = 0;
let resizeObserver: ResizeObserver | undefined;

function drawMap() {
  const maps = (window as unknown as { kakao: any }).kakao.maps;
  if (!alive || !mapEl.value) return;
  const position = new maps.LatLng(LOCATION.latitude, LOCATION.longitude);
  const map = new maps.Map(mapEl.value, { center: position, level: 3 });
  map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
  const marker = new maps.Marker({ map, position, title: LOCATION.name });
  new maps.InfoWindow({
    // 카카오 말풍선 배경은 다크 모드에서도 흰색이라 글자색을 고정 (안 그러면 다크 모드의 밝은 글자색을 물려받아 안 보임)
    // 말풍선 칸은 최소 150px 이라 글자 영역도 150px 로 맞춰 가운데 정렬
    content: `<div style="box-sizing:border-box;width:150px;padding:6px 10px;font-size:13px;font-weight:600;color:#152d45;text-align:center;white-space:nowrap">${LOCATION.name}</div>`,
  }).open(map, marker);
  // 화면 배치가 끝나기 전(폭이 0에 가까울 때) 그려질 수 있어 크기가 바뀌면 다시 가운데로 맞춤
  resizeObserver = new ResizeObserver(() => {
    map.relayout();
    map.setCenter(position);
  });
  resizeObserver.observe(mapEl.value);
}

onMounted(() => {
  let script = document.querySelector<HTMLScriptElement>(
    'script[src*="dapi.kakao.com/v2/maps/sdk.js"]',
  );
  if (!script) {
    script = document.createElement("script");
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_JAVASCRIPT_KEY)}&libraries=services&autoload=false`;
    document.head.appendChild(script);
  }
  script.addEventListener("error", () => {
    if (alive) mapError.value = "지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  });
  watchdog = window.setTimeout(() => {
    clearInterval(poll);
    if (alive && !mapError.value && !mapEl.value?.childElementCount)
      mapError.value = "지도 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.";
  }, 15000);
  poll = window.setInterval(() => {
    const sdk = (window as unknown as { kakao?: any }).kakao;
    if (!sdk?.maps?.load) return;
    clearInterval(poll);
    sdk.maps.load(() => {
      clearTimeout(watchdog);
      drawMap();
    });
  }, 100);
});
onBeforeUnmount(() => {
  alive = false;
  resizeObserver?.disconnect();
  clearInterval(poll);
  clearTimeout(watchdog);
});
</script>

<template>
  <main class="routel-content-page directions-page">
    <h1>오시는 길</h1>
    <p class="directions-demo">위치는 부평역 기준이며, 사무실·연락처는 프로젝트 시연을 위한 가상 예시입니다.</p>
    <div class="directions-body">
      <div ref="mapEl" class="directions-map" role="img" :aria-label="`${LOCATION.name} 위치 지도`">
        <p v-if="mapError" class="directions-map-error">{{ mapError }}</p>
      </div>
      <dl class="directions-info">
        <dt>주소</dt>
        <dd>인천광역시 부평구 광장로 16 (부평역 인근) · ROUTEL 프로젝트 사무실</dd>
        <dt>문의</dt>
        <dd>visit@routel.example.com · 평일 09:00~18:00 (점심시간 12:00~13:00)</dd>
      </dl>
      <dl class="directions-info">
        <dt>지하철</dt>
        <dd>수도권 전철 1호선 · 인천 1호선 부평역 하차</dd>
        <dt>버스</dt>
        <dd>부평역 정류장 하차</dd>
      </dl>
    </div>
  </main>
</template>

<style scoped src="../../../styles/views/customer/about/directions.css"></style>
