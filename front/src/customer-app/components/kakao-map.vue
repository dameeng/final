<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { status } from "../services/format";
import { useApp } from "../composables/use-app";
import { loadKakao } from "../services/kakao";
import type { Facility } from "../services/types";
const { state } = useApp();
let fitted = false;
const props = withDefaults(defineProps<{ facilities: Facility[]; showControls?: boolean; selectedId?: string }>(), { showControls: true });
const emit = defineEmits<{ select: [id: string] }>();
const element = ref<HTMLElement | null>(null),
  error = ref(""),
  query = ref(""),
  results = ref<any[]>([]),
  searching = ref(false),
  message = ref(""),
  ready = ref(false);
let maps: any,
  map: any,
  resizeObserver: ResizeObserver | undefined,
  places: any,
  markers: any[] = [],
  destination: any,
  alive = true,
  searchVersion = 0;
function draw() {
  if (!map) return;
  markers.forEach((m) => m.setMap(null));
  markers = [];
  const bounds = new maps.LatLngBounds();
  for (const f of props.facilities) {
    if (!Number.isFinite(f.latitude) || !Number.isFinite(f.longitude)) continue;
    const point = new maps.LatLng(f.latitude, f.longitude);
    const current = status(f, state.demo, state.now);
    const tone = current.includes('미확인') ? '미확인' : current;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'facility-marker' + (props.selectedId === f.id ? ' is-selected' : '');
    button.dataset.status = tone;
    button.title = f.name + ' · ' + current;
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(props.selectedId === f.id));
    const symbol = document.createElement('span');
    symbol.textContent = ({'정상':'✓','주의':'!','통제':'−'} as Record<string,string>)[tone] || '?';
    symbol.setAttribute('aria-hidden', 'true');
    button.append(symbol);
    button.addEventListener('click', () => { maps.event.preventMap(); emit('select', f.id); });
    button.addEventListener('mousedown', () => maps.event.preventMap());
    button.addEventListener('touchstart', () => maps.event.preventMap(), { passive: true });
    const marker = new maps.CustomOverlay({ map, position: point, content: button, yAnchor: 0.5, zIndex: props.selectedId === f.id ? 10 : tone === '통제' ? 5 : 1 });
    markers.push(marker);
    bounds.extend(point);
  }
  if (markers.length && !fitted) { map.setBounds(bounds); fitted = true; }
}
function search() {
  if (!places || !query.value.trim()) return;
  const version = ++searchVersion;
  searching.value = true;
  results.value = [];
  message.value = "";
  places.keywordSearch(query.value.trim(), (data: any[], s: string) => {
    if (!alive || version !== searchVersion) return;
    searching.value = false;
    if (s === maps.services.Status.OK) results.value = data;
    else
      message.value =
        s === maps.services.Status.ZERO_RESULT
          ? "검색 결과가 없습니다."
          : "목적지 검색을 하지 못했습니다.";
  });
}
function destinationTo(row: any) {
  destination?.setMap(null);
  const p = new maps.LatLng(Number(row.y), Number(row.x));
  destination = new maps.Marker({ map, position: p, title: row.place_name });
  map.setCenter(p);
  map.setLevel(5);
  message.value =
    row.place_name +
    " 위치를 표시했습니다. 경로의 안전을 판단하는 기능은 아닙니다.";
}
function locate() {
  if (!map) return;
  if (!navigator.geolocation) {
    message.value = "현재 위치를 지원하지 않는 환경입니다.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (p) => {
      if (!alive) return;
      map.setCenter(new maps.LatLng(p.coords.latitude, p.coords.longitude));
      map.setLevel(5);
    },
    () => {
      if (alive) message.value = "위치 권한 또는 연결 상태를 확인해 주세요.";
    },
    { timeout: 10000, maximumAge: 60000 },
  );
}
onMounted(async () => {
  try {
    maps = await loadKakao();
    if (!alive || !element.value) return;
    map = new maps.Map(element.value, {
      center: new maps.LatLng(36.3, 127.8),
      level: 13,
    });
    map.addControl(new maps.ZoomControl(),maps.ControlPosition.BOTTOMRIGHT);
    resizeObserver = new ResizeObserver(() => map?.relayout());
    resizeObserver.observe(element.value);
    places = new maps.services.Places();
    ready.value = true;
    draw();
  } catch (e) {
    if (alive) error.value = (e as Error).message;
  }
});
watch([() => props.facilities, () => state.now, () => state.demo], draw);
watch(() => props.selectedId, id => {
  draw();
  const facility = props.facilities.find(f => f.id === id);
  if (map && facility && Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude)) {
    map.panTo(new maps.LatLng(facility.latitude, facility.longitude));
  }
});
function overview() { fitted = false; draw(); }
onBeforeUnmount(() => {
  alive = false;
  resizeObserver?.disconnect();
  searchVersion++;
  markers.forEach((m) => m.setMap(null));
  destination?.setMap(null);
});
</script>
<template>
  <section class="kakao-map" aria-label="지도와 목적지 검색">
    <form v-if="showControls" class="map-search" @submit.prevent="search">
      <label
        >목적지
        <input
          v-model="query"
          placeholder="장소 또는 주소"
          required
          maxlength="100" /></label
      ><button :disabled="!ready || searching">
        {{ searching ? "검색 중" : "목적지 검색" }}
      </button>
    </form>
    <button v-if="showControls" class="map-locate" type="button" :disabled="!ready" @click="locate">현재 위치</button>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="map-canvas-wrap"><div ref="element" class="map-area" aria-label="카카오 지도"></div><button type="button" class="map-overview" :disabled="!ready" @click="overview">전체 보기</button></div>
    <p v-if="message" role="status">{{ message }}</p>
    <ul v-if="results.length">
      <li v-for="row in results" :key="row.id">
        <button @click="destinationTo(row)">
          {{ row.place_name }} · {{ row.road_address_name || row.address_name }}
        </button>
      </li>
    </ul>
  </section>
</template>
