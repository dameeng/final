<script setup lang="ts">
import {pageFriendlyMapScroll} from '../runtime/mapScroll'
import {useApp} from '../stores/app'
import '../styles/map-weather.css'
let disposeMapScroll:(()=>void)|undefined

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { displayDate, dateParts } from "../utils/display-date";
import { RouterLink,useRoute } from "vue-router";
import BusanCctvModal from '../components/BusanCctvModal.vue'
const cctvOpen=ref(false)
const currentRoute=useRoute()

const props = withDefaults(defineProps<{ manager?: boolean }>(), {
  manager: false,
});
// 고객과 관리자에서 조회하는 공개 시설 목록입니다.
const API_BASE_URL = "";
const app=useApp();
const STALE_AFTER_MS = 120000;
// 백엔드(back/final) UnderpassController 기준. 목록 항목에 현재 상태(currentStatus/currentRiskLevel)가 함께 옵니다.
const API = {
  underpasses: "/api/underpasses",
};
// 조회 구역의 대표 위치이며 지하차도 좌표/관측 데이터가 아닙니다.
// 2026-07 광주·전남 통합 반영. 이전 주소/지역 코드는 aliases로 함께 인식합니다.
const regions = [
  {
    id: "seoul",
    name: "서울특별시",
    aliases: ["서울특별시", "서울시", "서울"],
    codes: ["11"],
    latitude: 37.5665,
    longitude: 126.978,
  },
  {
    id: "busan",
    name: "부산광역시",
    aliases: ["부산광역시", "부산시", "부산"],
    codes: ["26"],
    latitude: 35.1796,
    longitude: 129.0756,
  },
  {
    id: "daegu",
    name: "대구광역시",
    aliases: ["대구광역시", "대구시", "대구"],
    codes: ["27"],
    latitude: 35.8714,
    longitude: 128.6014,
  },
  {
    id: "incheon",
    name: "인천광역시",
    aliases: ["인천광역시", "인천시", "인천"],
    codes: ["28"],
    latitude: 37.4563,
    longitude: 126.7052,
  },
  {
    id: "daejeon",
    name: "대전광역시",
    aliases: ["대전광역시", "대전시", "대전"],
    codes: ["30"],
    latitude: 36.3504,
    longitude: 127.3845,
  },
  {
    id: "ulsan",
    name: "울산광역시",
    aliases: ["울산광역시", "울산시", "울산"],
    codes: ["31"],
    latitude: 35.5384,
    longitude: 129.3114,
  },
  {
    id: "sejong",
    name: "세종특별자치시",
    aliases: ["세종특별자치시", "세종시", "세종"],
    codes: ["36"],
    latitude: 36.48,
    longitude: 127.289,
  },
  {
    id: "gyeonggi",
    name: "경기도",
    aliases: ["경기도", "경기"],
    codes: ["41"],
    latitude: 37.4138,
    longitude: 127.5183,
  },
  {
    id: "gangwon",
    name: "강원특별자치도",
    aliases: ["강원특별자치도", "강원도", "강원"],
    codes: ["42", "51"],
    latitude: 37.8228,
    longitude: 128.1555,
  },
  {
    id: "chungbuk",
    name: "충청북도",
    aliases: ["충청북도", "충북"],
    codes: ["43"],
    latitude: 36.8,
    longitude: 127.7,
  },
  {
    id: "chungnam",
    name: "충청남도",
    aliases: ["충청남도", "충남"],
    codes: ["44"],
    latitude: 36.5184,
    longitude: 126.8,
  },
  {
    id: "jeonbuk",
    name: "전북특별자치도",
    aliases: ["전북특별자치도", "전라북도", "전북"],
    codes: ["45", "52"],
    latitude: 35.82,
    longitude: 127.1088,
  },
  {
    id: "jeonnam-gwangju",
    name: "전남광주통합특별시",
    aliases: [
      "전남광주통합특별시",
      "전남광주특별시",
      "광주광역시",
      "광주시",
      "전라남도",
      "전남",
      "광주",
    ],
    codes: ["29", "46"],
    latitude: 35.1595,
    longitude: 126.8526,
  },
  {
    id: "gyeongbuk",
    name: "경상북도",
    aliases: ["경상북도", "경북"],
    codes: ["47"],
    latitude: 36.4919,
    longitude: 128.8889,
  },
  {
    id: "gyeongnam",
    name: "경상남도",
    aliases: ["경상남도", "경남"],
    codes: ["48"],
    latitude: 35.4606,
    longitude: 128.2132,
  },
  {
    id: "jeju",
    name: "제주특별자치도",
    aliases: ["제주특별자치도", "제주도", "제주"],
    codes: ["50"],
    latitude: 33.3846,
    longitude: 126.5535,
  },
];
type Json = Record<string, unknown>;
type Facility = {
  id: string;
  name: string;
  address: string;
  regionId: string;
  assignedRegionId?: string;
  assignedRegionName?: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  rainfallMm: number | null;
  riskScore: number | null;
  updatedAt: string;
  pumpStatus: string;
};
const facilities = ref<Facility[]>([]);
const detail = ref<Facility | null>(null);
type CompactWeather = {condition?: string; temperature?: number | null; humidity?: number | null; rainfall?: number | null; observedAt?: string};
const compactWeather=ref<CompactWeather|null>(null),weatherError=ref(''),weatherLoading=ref(false);
let weatherAbort:AbortController|undefined;

const detailRegion=ref<HTMLElement|null>(null);
const selectedId = ref(""),
  regionId = ref("busan"),
  query = ref(""),
  statusFilter = ref("");
const loading = ref(false),
  detailLoading = ref(false),
  locating = ref(false);
const listError = ref(""),
  statusError = ref(""),
  detailError = ref(""),
  mapError = ref("");
const receivedAt = ref(""),
  loaded = ref(false),
  now = ref(Date.now());
const mapElement = ref<HTMLDivElement | null>(null);
const findingPosition=ref(false);
let userLocation:any;
function zoomMap(change:number){if(map)map.setLevel(Math.max(1,Math.min(14,map.getLevel()+change)))}
function locateUser(){
 if(!map||findingPosition.value)return;
 if(!navigator.geolocation){mapError.value='이 브라우저에서는 위치 찾기를 지원하지 않습니다.';return}
 findingPosition.value=true;
 navigator.geolocation.getCurrentPosition(position=>{
  if(!alive)return;findingPosition.value=false;mapError.value='';
  const center=new maps.LatLng(position.coords.latitude,position.coords.longitude);
  if(!userLocation){const dot=document.createElement('div');dot.className='map-user-location';dot.setAttribute('aria-label','내 현재 위치');userLocation=new maps.CustomOverlay({map,position:center,content:dot,zIndex:4})}else userLocation.setPosition(center);
  map.setLevel(4);map.panTo(center);
 },error=>{if(!alive)return;findingPosition.value=false;mapError.value=error.code===1?'위치 권한을 허용한 뒤 다시 눌러 주세요.':'현재 위치를 확인하지 못했습니다.'},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
}
let alive = true,
  requestNumber = 0,
  regionLookupNumber = 0;
let listAbort: AbortController | undefined,
  detailAbort: AbortController | undefined;

let sdkWatchdog: number | undefined;
let sdkPoll: number | undefined;
let observer: ResizeObserver | undefined;
// 카카오 SDK에서 제공하는 객체입니다. 팀 프로젝트에 SDK 타입이 있으면 교체할 수 있습니다.
let maps: any, map: any, infoWindow: any, geocoder: any;
let overlays: any[] = [];
let markers: { id: string; marker: any; click: () => void }[] = [];
watch(()=>selectedId.value,async id=>{
 weatherAbort?.abort();compactWeather.value=null;weatherError.value='';weatherLoading.value=false;
 const facility=facilities.value.find(f=>f.id===id);
 if(!facility || props.manager)return;
 if(facility.latitude===null||facility.longitude===null){weatherError.value='위치 정보가 없어 날씨를 확인할 수 없습니다.';return}
 const controller=new AbortController();weatherAbort=controller;weatherLoading.value=true;
 try{const response=await fetch(`/api/weather?lat=${facility.latitude}&lng=${facility.longitude}`,{signal:controller.signal,cache:'no-store'});const body=await response.json();if(!response.ok||body?.success===false||!body?.data)throw new Error();if(!controller.signal.aborted)compactWeather.value=body.data}
 catch{if(!controller.signal.aborted)weatherError.value='현재 날씨를 불러오지 못했습니다.'}
 finally{if(!controller.signal.aborted)weatherLoading.value=false}
});
const regionCache = new Map<string, string>();

function object(value: unknown): Json {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
}
function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
function number(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  )
    return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
function findRegion(row: Json): string {
  const code = text(row.sidoCode || row.regionCode).slice(0, 2);
  const byCode = regions.find((r) => r.codes.includes(code));
  if (byCode) return byCode.id;
  // 백엔드 region이 구·군 단위("강서구")라 regionName만으로는 시·도를 못 찾는다.
  // 후보(지역명 → 시도명 → 주소)를 순서대로 모두 시도한다.
  // 주소 첫 단어만 사용하여 경기도 광주시와 옛 광주광역시를 혼동하지 않는다.
  const candidates = [
    row.regionName,
    row.sidoName,
    row.region,
    row.roadAddress,
    row.address,
  ]
    .map((v) => text(v).trim())
    .filter(Boolean);
  for (const name of candidates) {
    const hit = regions.find((r) =>
      r.aliases.some((alias) => name === alias || name.startsWith(alias + " ")),
    );
    if (hit) return hit.id;
  }
  return "";
}
function statusLabel(value: unknown): string {
  const labels: Record<string, string> = {
    NORMAL: "정상",
    SAFE: "정상",
    OPEN: "정상",
    NORMAL_TRAFFIC: "정상",
    CAUTION: "경고",
    WARNING: "경고",
    DANGER: "위험",
    BLOCKED: "통제",
    CLOSED: "통제",
    CONTROLLED: "통제",
    정상: "정상",
    안전: "정상",
    주의: "경고",
    경고: "경고",
    위험: "위험",
    통제: "통제",
    해제: "정상",
  };
  return labels[text(value).toUpperCase()] || "미확인";
}
// PDF는 URL과 공통 응답 형식만 정의합니다. 실제 조회 DTO 확정 시 이 매핑만 맞춥니다.
function normalize(row: Json, current?: Json): Facility | null {
  const id = text(row.underpassId ?? row.id);
  if (!id) return null;
  const state = current || {};
  const latitude = number(row.latitude),
    longitude = number(row.longitude);
  const coordinatesValid =
    latitude !== null &&
    longitude !== null &&
    latitude >= 32 &&
    latitude <= 39.5 &&
    longitude >= 124 &&
    longitude <= 132;
  const risk = number(state.riskScore);
  const hasBlocked = typeof state.isBlocked === "boolean";
  return {
    id,
    name: text(row.name) || "이름 미제공",
    address: text(row.roadAddress || row.address),
    regionId: findRegion(row),
    assignedRegionId: String(row.regionId ?? ""),
    assignedRegionName: String(row.regionName ?? ""),
    latitude: coordinatesValid ? latitude : null,
    longitude: coordinatesValid ? longitude : null,
    // 백엔드: currentStatus(NORMAL/BLOCKED) + currentRiskLevel(SAFE/WARNING/DANGER)
    status:
      (hasBlocked && state.isBlocked === true) ||
      text(state.currentStatus).toUpperCase() === "BLOCKED"
        ? "통제"
        : statusLabel(
            state.controlStatus ??
              state.status ??
              state.currentRiskLevel ??
              state.currentStatus,
          ),
    rainfallMm: number(state.rainfallMm),
    riskScore: risk !== null && risk >= 0 && risk <= 100 ? risk : null,
    // 백엔드 목록에는 상태 기준 시각이 없어 조회 시각(receivedAt)을 기준으로 사용합니다.
    updatedAt: text(
      state.updatedAt ||
        state.observedAt ||
        state.predictedAt ||
        state.receivedAt,
    ),
    pumpStatus: text(state.pumpStatus),
  };
}
function clearState(row: Facility): Facility {
  return {
    ...row,
    status: "미확인",
    rainfallMm: null,
    riskScore: null,
    updatedAt: "",
    pumpStatus: "",
  };
}
function stateLabel(row: Facility): string {
  if (
    listError.value ||
    statusError.value ||
    (selectedId.value === row.id && detailError.value)
  )
    return "확인 불가";
  if (!row.updatedAt || !Number.isFinite(Date.parse(row.updatedAt)))
    return "미확인 (기준 시각 없음)";
  const age = now.value - Date.parse(row.updatedAt);
  if (age < -60000 || age > STALE_AFTER_MS) return "갱신 지연";
  return row.status;
}
function formatTime(value: string): string {
  if (!props.manager) return displayDate(value);
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString("ko-KR") : "미제공";
}
async function request(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(API_BASE_URL + path, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("로그인이 필요한 정보입니다.");
    if (response.status === 403) throw new Error("조회 권한이 없습니다.");
    if (response.status === 404)
      throw new Error("조회 서비스를 찾을 수 없습니다.");
    throw new Error("정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("조회 서비스에 연결할 수 없습니다.");
  const body = object(await response.json());
  if (body.success !== true)
    throw new Error(text(body.message) || "조회에 실패했습니다.");
  return body.data;
}
async function collection(path: string, signal: AbortSignal): Promise<Json[]> {
  const all: Json[] = [];
  let page = 1;
  // 단순 배열 또는 백엔드 PageResponse(items, totalPages, page는 1부터, size 최대 100) 형태를 허용합니다.
  while (page <= 100) {
    const result = await request(`${path}?page=${page}&size=100`, signal);
    if (Array.isArray(result)) return [...all, ...result.map(object)];
    const body = object(result),
      rows = body.content ?? body.items;
    if (!Array.isArray(rows))
      throw new Error("목록 응답 형식을 확인할 수 없습니다.");
    all.push(...rows.map(object));
    const totalPages = number(body.totalPages);
    if (body.last === true || (totalPages !== null && page >= totalPages))
      return all;
    if (body.last !== false && totalPages === null) {
      if (
        number(body.totalElements) !== null &&
        Number(body.totalElements) > all.length
      )
        throw new Error("전체 목록을 확인할 수 없습니다.");
      return all;
    }
    if (rows.length === 0) throw new Error("목록 일부를 불러오지 못했습니다.");
    page++;
  }
  throw new Error(
    "전체 목록을 불러오지 못했습니다. 조회 범위를 확인해 주세요.",
  );
}
const filtered = computed(() =>
  facilities.value.filter(
    (f) =>
      (!regionId.value || f.regionId === regionId.value) &&
      (!query.value || (f.name + " " + f.address).includes(query.value)) &&
      (!statusFilter.value ||
        (statusFilter.value === "미확인"
          ? stateLabel(f).startsWith("미확인")
          : stateLabel(f) === statusFilter.value)),
  ),
);
const selected = computed(() =>
  detail.value?.id === selectedId.value
    ? detail.value
    : facilities.value.find((f) => f.id === selectedId.value) || null,
);
const missingCoordinates = computed(
  () =>
    filtered.value.filter((f) => f.latitude === null || f.longitude === null)
      .length,
);
const unclassified = computed(
  () => facilities.value.filter((f) => !f.regionId).length,
);
const page = ref(1),
  pageSize = props.manager ? 15 : 5;
const pages = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / pageSize)),
);
const shown = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize),
);
watch([regionId, query, statusFilter], () => {
  page.value = 1;
});
watch(pages, () => {
  page.value = Math.min(page.value, pages.value);
});

let initialFacilityBoundsApplied = false;
async function searchFacilities() {
  await refresh(); await nextTick();
  if (!map || selectedId.value) return;
  const rows=filtered.value.filter(f=>f.latitude!==null && f.longitude!==null);
  if (!rows.length) return;
  map.relayout(); const bounds=new maps.LatLngBounds();
  rows.forEach(f=>bounds.extend(new maps.LatLng(f.latitude,f.longitude)));
  map.setBounds(bounds,48,32,32,32); if(rows.length===1)map.setLevel(5);
}
async function refresh() {
  if (loading.value || !alive) return;
  const version = ++requestNumber;
  listAbort?.abort();
  listAbort = new AbortController();
  const signal = listAbort.signal;
  const timeout = window.setTimeout(() => listAbort?.abort(), 15000);
  loading.value = true;
  listError.value = "";
  statusError.value = "";
  try {
    const master = await collection(API.underpasses, signal);
    if (!alive || version !== requestNumber) return;
    const fetchedAt = new Date().toISOString();
    const unique = new Map<string, Facility>();
    for (const row of master) {
      // 목록 항목 자체에 현재 상태가 들어 있으므로 상태 정보로도 사용합니다.
      const f = normalize(row, { ...row, receivedAt: fetchedAt });
      if (!f)
        throw new Error("지하차도 목록의 식별자 형식을 확인할 수 없습니다.");
      if (f) {
        const cached = regionCache.get(`${f.latitude},${f.longitude}`);
        if (!f.regionId && cached) f.regionId = cached;
        unique.set(f.id, f);
      }
    }
    facilities.value = [...unique.values()];
    if (map && !initialFacilityBoundsApplied && facilities.value.length && !selectedId.value) { fitNation(); initialFacilityBoundsApplied = true; }
    loaded.value = true;
    receivedAt.value = new Date().toISOString();
    now.value = Date.now();
    if (selectedId.value && !unique.has(selectedId.value)) {
      selectedId.value = "";
      detail.value = null;
      infoWindow?.close();
    }
    if (selectedId.value) await loadDetail(selectedId.value);
    void resolveRegions();
  } catch (error) {
    if (!alive || version !== requestNumber) return;
    facilities.value = facilities.value.map(clearState);
    detail.value = null;
    listError.value = signal.aborted
      ? "응답 시간이 초과되었습니다. 다시 조회해 주세요."
      : error instanceof Error
        ? error.message
        : "목록을 불러오지 못했습니다.";
  } finally {
    clearTimeout(timeout);
    if (alive && version === requestNumber) loading.value = false;
  }
}
// 위험도(riskScore)/강우량(rainfallMm)은 상세 응답에 없고 MP-05 추이 엔드포인트에만 있어
// 최근 1건을 가져와 최신 값으로 사용합니다. 실패해도 상세 조회 자체는 계속 진행합니다.
async function fetchLatestRiskScore(
  id: string,
  signal: AbortSignal,
): Promise<Json | null> {
  try {
    const rows = await request(
      `${API.underpasses}/${encodeURIComponent(id)}/risk-scores?limit=1`,
      signal,
    );
    if (!Array.isArray(rows) || !rows.length) return null;
    // 서비스가 오름차순으로 반환하므로 마지막 원소가 최신입니다.
    return object(rows[rows.length - 1]);
  } catch {
    return null;
  }
}
async function loadDetail(id: string) {
  detailAbort?.abort();
  detailAbort = new AbortController();
  const signal = detailAbort.signal;
  const timeout = window.setTimeout(() => {
    if (!signal.aborted) controller.abort();
  }, 10000);
  const controller = detailAbort;
  detailLoading.value = true;
  detailError.value = "";
  detail.value = null;
  try {
    const [rawBody, latestRisk] = await Promise.all([
      request(`${API.underpasses}/${encodeURIComponent(id)}`, signal),
      fetchLatestRiskScore(id, signal),
    ]);
    const body = object(rawBody);
    if (!alive || selectedId.value !== id || signal.aborted) return;
    const base = facilities.value.find((f) => f.id === id);
    const receivedId = text(body.underpassId ?? body.id);
    if (receivedId && receivedId !== id)
      throw new Error("선택한 지하차도와 응답 정보가 다릅니다.");
    const riskState = latestRisk
      ? {
          riskScore: latestRisk.riskScore,
          rainfallMm: latestRisk.rainfallMm,
          predictedAt: latestRisk.predictedAt,
        }
      : {};
    const normalized = normalize(
      {
        ...body,
        underpassId: id,
        name: body.name || base?.name,
        regionName: body.regionName,
        latitude: body.latitude ?? base?.latitude,
        longitude: body.longitude ?? base?.longitude,
      },
      { ...body, ...riskState },
    );
    if (normalized) {
      // 상세 응답에 상태 정보가 없는 경우 최신 요약값만 사용합니다.
      const hasCurrent =
        body.currentStatus !== undefined ||
        body.status !== undefined ||
        body.controlStatus !== undefined ||
        body.isBlocked !== undefined;
      detail.value = hasCurrent
        ? {
            ...normalized,
            regionId: normalized.regionId || base?.regionId || "",
            updatedAt: normalized.updatedAt || base?.updatedAt || "",
          }
        : base || normalized;
    }
  } catch (error) {
    if (
      !alive ||
      selectedId.value !== id ||
      (signal.aborted && controller !== detailAbort)
    )
      return;
    detailError.value = signal.aborted
      ? "상세 응답 시간이 초과되었습니다."
      : error instanceof Error
        ? error.message
        : "최신 상세 정보를 확인할 수 없습니다.";
  } finally {
    clearTimeout(timeout);
    if (alive && selectedId.value === id && controller === detailAbort) {
      detailLoading.value = false;
      await nextTick();
      openSelectedPopup();
    }
  }
}
async function selectFacility(f: Facility) {
  selectedId.value = f.id;
  detail.value = null;
  if (!regionId.value && f.regionId) regionId.value = f.regionId;
  await nextTick();
  if (selectedId.value !== f.id) return;
  if (map && f.latitude !== null && f.longitude !== null) {
    map.relayout();clusterer?.redraw();
    map.setLevel(5, { anchor: new maps.LatLng(f.latitude, f.longitude) });
    map.setCenter(new maps.LatLng(f.latitude, f.longitude));
    drawMap();
  }
  void loadDetail(f.id);
  detailRegion.value?.focus({preventScroll:true});
  mapElement.value?.closest('.map-columns')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
function clearRegionSelection(id: string) {
  detailAbort?.abort();
  selectedId.value = "";
  detail.value = null;
  detailError.value = "";
  detailLoading.value = false;
  infoWindow?.close();
  regionId.value = id;
}
async function chooseRegion(id: string) {
  clearRegionSelection(id);
  await nextTick();
  if (regionId.value !== id) return;
  map?.relayout();
  if (!map) return;
  const region = regions.find((r) => r.id === id);
  if (region) {
    map.setCenter(new maps.LatLng(region.latitude, region.longitude));
    const rows=facilities.value.filter(f=>f.regionId===id && f.latitude !== null && f.longitude !== null && Number.isFinite(f.latitude) && Number.isFinite(f.longitude));
    if(rows.length){const bounds=new maps.LatLngBounds();rows.forEach(f=>bounds.extend(new maps.LatLng(f.latitude,f.longitude)));map.setBounds(bounds,40,40,40,40);if(rows.length===1)map.setLevel(6)}else map.setLevel(10);
  } else fitNation();
}
// 지역 선택(레벨 10) 후 사용자가 이 레벨 이상으로 축소하면 전국 지역 선택 화면으로 돌아갑니다.
const NATION_VIEW_LEVEL = 12;
function handleZoomChanged() {
  // Explicit nationwide button preserves selection during programmatic zoom.
}
function fitNation() {
  const bounds = new maps.LatLngBounds();
  const assigned=props.manager?app.account?.regions||[]:[];
  const scoped=facilities.value.filter(f=>assigned.some(r=>String(r.id)===f.assignedRegionId||f.assignedRegionName===r.name||f.address.includes(r.name)));
  const points = (scoped.length?scoped:facilities.value.filter(f=>!regionId.value||f.regionId===regionId.value)).filter(f => f.latitude !== null && f.longitude !== null && Number.isFinite(f.latitude) && Number.isFinite(f.longitude));
  for (const f of points) bounds.extend(new maps.LatLng(f.latitude, f.longitude));
  // Keep the existing service region representatives (including Jeju) in the nationwide view.
  for (const r of (points.length ? [] : regions)) if(Number.isFinite(r.latitude) && Number.isFinite(r.longitude)) bounds.extend(new maps.LatLng(r.latitude,r.longitude));
  map.setBounds(bounds, props.manager ? 16 : 48, 16, 16, 16);
  if (points.length === 1) map.setLevel(props.manager ? 4 : 6);
}
function openSelectedPopup() {
  if (!map || !selected.value || detailLoading.value) return;
  const item = markers.find((m) => m.id === selectedId.value);
  if (!item) return;
  const row = selected.value,
    content = document.createElement("div");
  content.className = "routel-map-popup";
  const heading = document.createElement("strong");
  heading.className = "routel-map-popup__title";
  heading.textContent = row.name;
  content.append(heading);
  const status = document.createElement("p");
  status.className = "routel-map-popup__row";
  const label = document.createElement("span");
  label.className = "routel-map-popup__label";
  label.textContent = "현재 상태";
  const badge = document.createElement("span");
  badge.className = "routel-map-popup__status";
  badge.dataset.state = stateLabel(row);
  badge.textContent = stateLabel(row);
  status.append(label, badge);
  const time = document.createElement("p");
  time.className = "routel-map-popup__row routel-map-popup__row--time";
  const timeLabel = document.createElement("span");
  timeLabel.className = "routel-map-popup__label";
  timeLabel.textContent = "기준 시각";
  const timeValue = document.createElement("span");
  timeValue.className = "routel-map-popup__time";
  timeValue.textContent = formatTime(row.updatedAt);
  time.append(timeLabel, timeValue);
  content.append(status, time);
  if (detailError.value) {
    const p = document.createElement("p");
    p.className = "routel-map-popup__error";
    p.textContent = detailError.value;
    content.append(p);
  }
  infoWindow.setContent(content);
  infoWindow.open(map, item.marker);
}
// 상태별 마커 색상. 위에 있을수록 위험한 상태이며 겹칠 때 앞쪽에 그립니다.
const markerStyles = [
  { label: "통제", color: "#8b1e2d", zIndex: 6 },
  { label: "위험", color: "#e75b36", zIndex: 5 },
  { label: "경고", color: "#e8b923", zIndex: 4 },
  { label: "정상", color: "#2eaa6b", zIndex: 2 },
  { label: "미확인", color: "#8793a0", zIndex: 1 },

];
function markerStyle(state: string) {
  return (
    markerStyles.find((m) => m.label === state) ||
    markerStyles[markerStyles.length - 1]!
  );
}
const markerImages = new Map<string, any>();
function markerImage(state: string) {
  const style = markerStyle(state);
  const cached = markerImages.get(style.label);
  if (cached) return cached;
  // 통제는 가운데 ✕, 나머지는 흰 점으로 표시합니다.
  const center =
    style.label === "통제"
      ? "<path d='M10 10l8 8M18 10l-8 8' stroke='white' stroke-width='3' stroke-linecap='round'/>"
      : "<circle cx='14' cy='14' r='5' fill='white'/>";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='38' viewBox='0 0 28 38'><path d='M14 1C6.8 1 1 6.8 1 14c0 9.6 13 23 13 23s13-13.4 13-23C27 6.8 21.2 1 14 1z' fill='${style.color}' stroke='white' stroke-width='2'/>${center}</svg>`;
  const image = new maps.MarkerImage(
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
    new maps.Size(28, 38),
    { offset: new maps.Point(14, 37) },
  );
  markerImages.set(style.label, image);
  return image;
}
function removeMarkers() {
  clusterer?.clear();
  for (const { marker, click } of markers) {
    maps.event.removeListener(marker, "click", click);
    marker.setMap(null);
  }
  markers = [];
  overlays.forEach((overlay) => overlay.setMap(null));
  overlays = [];
}
let clusterer:any;const clusterFacilityIds=ref<string[]>([]);const clusterRows=computed(()=>facilities.value.filter(f=>clusterFacilityIds.value.includes(f.id)));
function selectCluster(cluster:any){clusterFacilityIds.value=cluster.getMarkers().map((m:any)=>markers.find(x=>x.marker===m)?.id).filter(Boolean);selectedId.value='';detail.value=null}
function drawMap() {
  if (!map) return;
  infoWindow.close();
  removeMarkers();
  if (!regionId.value && !query.value && !selectedId.value) {
    for (const region of regions) {
      const rows = facilities.value.filter((f) => f.regionId === region.id);
      const blocked = rows.filter((f) => stateLabel(f) === "통제").length;
      const unknown = rows.filter(
        (f) =>
          !["정상", "주의", "통제"].includes(stateLabel(f)),
      ).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-region-label";
      const caption =
        !loaded.value || listError.value || statusError.value
          ? "상태 미확인"
          : !rows.length
            ? "등록 시설 없음"
            : `통제 ${blocked} · 미확인 ${unknown}`;
      const shortName: Record<string, string> = {
        seoul: "서울",
        busan: "부산",
        daegu: "대구",
        incheon: "인천",
        daejeon: "대전",
        ulsan: "울산",
        sejong: "세종",
        gyeonggi: "경기",
        gangwon: "강원",
        chungbuk: "충북",
        chungnam: "충남",
        jeonbuk: "전북",
        "jeonnam-gwangju": "광주·전남",
        gyeongbuk: "경북",
        gyeongnam: "경남",
        jeju: "제주",
      };
      button.textContent = shortName[region.id] || region.name;
      button.title = `${region.name} · ${caption}`;
      button.setAttribute("aria-label", `${region.name} 현황 보기`);
      // 전국 보기에서 붙어 있는 라벨을 화면 기준으로 살짝 벌립니다.
      const labelShift: Record<string, string> = {
        chungnam: "translate(-30px, 0)",
        chungbuk: "translate(12px, -6px)",
        daejeon: "translate(10px, 20px)",
        jeonbuk: "translate(-18px, 4px)",
        ulsan: "translate(10px, -4px)",
        busan: "translate(4px, 4px)",
      };
      button.style.transform = labelShift[region.id] || "";
      button.addEventListener("click", () => chooseRegion(region.id));
      overlays.push(
        new maps.CustomOverlay({
          map,
          position: new maps.LatLng(region.latitude, region.longitude),
          content: button,
          // Incheon label is centred on its actual coordinates; no westward offset.
          xAnchor: region.id === "gyeonggi" ? -0.2 : 0.5,
          yAnchor: 0.5,
        }),
      );
    }
  } else {
    for (const row of filtered.value) {
      if (row.latitude === null || row.longitude === null) continue;
      const state = stateLabel(row);
      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(row.latitude, row.longitude),
        title: `${row.name} · ${state}`,
        image: markerImage(state),
        zIndex: markerStyle(state).zIndex,
      });
      const click = () => selectFacility(row);
      maps.event.addListener(marker, "click", click);
      markers.push({ id: row.id, marker, click });
    }
    clusterer?.clear();clusterer?.addMarkers(markers.map(m=>m.marker));
    openSelectedPopup();
  }
}
// 지역명 없는 좌표는 카카오 행정구역 조회로 보완합니다. 임의로 가까운 시·도에 배정하지 않습니다.
async function resolveRegions() {
  if (!geocoder || !alive) return;
  const version = ++regionLookupNumber;
  const pending = facilities.value.filter(
    (f) => !f.regionId && f.latitude !== null && f.longitude !== null,
  );
  if (!pending.length) {
    locating.value = false;
    return;
  }
  locating.value = true;
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length && alive && version === regionLookupNumber) {
      const row = pending[cursor++]!;
      const cacheKey = `${row.latitude},${row.longitude}`;
      const region = await new Promise<string>((resolve) => {
        const timer = window.setTimeout(() => resolve(""), 3000);
        geocoder.coord2RegionCode(
          row.longitude,
          row.latitude,
          (result: Json[], status: string) => {
            clearTimeout(timer);
            const admin =
              result?.find((r) => r.region_type === "H") || result?.[0];
            resolve(
              status === maps.services.Status.OK && admin
                ? findRegion({ regionName: admin.region_1depth_name })
                : "",
            );
          },
        );
      });
      if (region) {
        regionCache.set(cacheKey, region);
        if (alive && version === regionLookupNumber) {
          const current = facilities.value.find((f) => f.id === row.id);
          if (current) current.regionId = region;
        }
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  if (alive && version === regionLookupNumber) {
    locating.value = false;
    drawMap();
  }
}
const KAKAO_JAVASCRIPT_KEY = import.meta.env.VITE_KAKAO_MAP_KEY || '';
let sdkErrorCleanup: (() => void) | undefined;
async function initializeMap() {
  if(!KAKAO_JAVASCRIPT_KEY){mapError.value='카카오 지도 키를 설정하면 실제 시설 위치를 표시합니다.';return}
  if (!(window as unknown as { kakao?: any }).kakao?.maps?.load) {
    let script = document.querySelector<HTMLScriptElement>(
      'script[src*="dapi.kakao.com/v2/maps/sdk.js"]',
    );
    const isNew = !script;
    if (!script) {
      script = document.createElement("script");
      script.id = "kakao-map-sdk";
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_JAVASCRIPT_KEY)}&libraries=services,clusterer&autoload=false`;
    }
    const onError = () => {
      if (!alive) return;
      clearInterval(sdkPoll);
      mapError.value =
        "카카오 지도 스크립트를 불러오지 못했습니다. JavaScript 키, 카카오맵 사용 설정, 등록된 사이트 주소와 네트워크를 확인해 주세요.";
    };
    script.addEventListener("error", onError);
    const sdkScript = script;
    sdkErrorCleanup = () => sdkScript.removeEventListener("error", onError);
    if (isNew) document.head.appendChild(script);
  }
  const start = Date.now();
  sdkPoll = window.setInterval(() => {
    if (!alive) {
      clearInterval(sdkPoll);
      return;
    }
    const sdk = (window as unknown as { kakao?: any }).kakao;
    if (sdk?.maps?.load) {
      clearInterval(sdkPoll);
      sdkWatchdog = window.setTimeout(() => {
        if (alive && !map)
          mapError.value =
            "지도 응답이 지연되고 있습니다. 목록을 이용해 주세요.";
      }, 10000);
      sdk.maps.load(() => {
        clearTimeout(sdkWatchdog);
        if (!alive || !mapElement.value) return;
        try {
          mapError.value = "";
          maps = sdk.maps;
          map = new maps.Map(mapElement.value, {
            center: new maps.LatLng(36.3, 127.8),
            level: 12,
            scrollwheel: false,
          });
          disposeMapScroll=pageFriendlyMapScroll(mapElement.value,map);
          clusterer=new maps.MarkerClusterer({map,averageCenter:true,minLevel:0,gridSize:70,disableClickZoom:true});
          maps.event.addListener(clusterer,'clusterclick',selectCluster);
          infoWindow = new maps.InfoWindow({ removable: true, disableAutoPan: true });
          geocoder = maps.services ? new maps.services.Geocoder() : undefined;
          fitNation();
          initialFacilityBoundsApplied = facilities.value.length > 0;
          maps.event.addListener(map, "zoom_changed", handleZoomChanged);
          drawMap();
          void resolveRegions();
          observer = new ResizeObserver(() => {
            const center = map.getCenter();
            map.relayout();clusterer?.redraw();
            const row = selected.value;
            map.setCenter(row?.latitude != null && row?.longitude != null ? new maps.LatLng(row.latitude,row.longitude) : center);
          });
          observer.observe(mapElement.value);
        } catch {
          mapError.value =
            "지도를 표시할 수 없습니다. 아래 목록을 이용해 주세요.";
        }
      });
    } else if (Date.now() - start > 10000) {
      clearInterval(sdkPoll);
      mapError.value =
        "지도 로딩 시간이 초과되었습니다. 카카오 JavaScript 키와 등록 주소를 확인한 뒤 새로고침해 주세요.";
    }
  }, 100);
}
function handleVisibility() {
  if (!document.hidden) {
    now.value = Date.now();
  }
}
watch([filtered, regionId, selectedId, now, listError, statusError], drawMap);
watch([regionId,query,statusFilter],()=>clusterFacilityIds.value=[]);
watch(filtered,rows=>clusterFacilityIds.value=clusterFacilityIds.value.filter(id=>rows.some(f=>f.id===id)));
onMounted(() => {
  void initializeMap();
  void refresh();
  document.addEventListener("visibilitychange", handleVisibility);
});
onBeforeUnmount(() => {
 userLocation?.setMap(null);
 disposeMapScroll?.()
  if(clusterer)maps.event.removeListener(clusterer,'clusterclick',selectCluster);clusterer?.clear();
  weatherAbort?.abort();
  alive = false;
  requestNumber++;
  regionLookupNumber++;
  listAbort?.abort();
  detailAbort?.abort();
  clearTimeout(sdkWatchdog);
  sdkErrorCleanup?.();
  clearInterval(sdkPoll);
  observer?.disconnect();
  document.removeEventListener("visibilitychange", handleVisibility);
  infoWindow?.close();
  if (map) {
    maps.event.removeListener(map, "zoom_changed", handleZoomChanged);
    removeMarkers();
  }
});
</script>

<template>
  <main class="wire-page customer-content page-c-live-map routel-content-page" :class="{ 'customer-underpass-page': !props.manager }">
    <RouterLink v-if="props.manager&&selectedId&&currentRoute.path.startsWith('/admin-app/')" :to="'/admin-app/screen-5?id='+selectedId">시설 상세</RouterLink><div v-if="props.manager&&selectedId&&!currentRoute.path.startsWith('/admin-app/')" class="service-actions"><RouterLink :to="'/admin-data/facilities?id='+selectedId">시설 정보·통제</RouterLink><RouterLink :to="'/admin-data/cameras?underpassId='+selectedId">카메라 관리</RouterLink><RouterLink :to="'/admin-data/transits?underpassId='+selectedId">차량 통과 기록</RouterLink></div>
<h1>{{ props.manager ? "통제 / 해제" : "지하차도 통제 현황" }}</h1>
    <form @submit.prevent="searchFacilities" class="underpass-map-form">
      <label class="underpass-map-label"
        >지역<select
          :value="regionId"
          @change="chooseRegion(($event.target as HTMLSelectElement).value)"
        >
          <option value="">전국</option>
          <option v-for="region in regions" :key="region.id" :value="region.id">
            {{ region.name }}
          </option>
        </select></label
      >
      <label class="underpass-map-label-2"
        >지하차도명·주소<input v-model.trim="query" type="search"
      /></label>
      <label class="underpass-map-label-3"
        >상태<select v-model="statusFilter">
          <option value="">전체 상태</option>
          <option>정상</option>
          <option>경고</option>
          <option>위험</option>
          <option>통제</option>
        </select></label
      >
      <button type="submit" :disabled="loading">
        {{ loading ? "조회 중" : "새로고침" }}
      </button>
      <button
        type="button"
        @click="
          query = '';
          statusFilter = '';
          chooseRegion('');
        "
      >
        전국 보기
      </button>
    </form>
    <div v-if="listError || statusError || locating || unclassified" :class="{ 'customer-map-status': !props.manager }" aria-live="polite">

    <p role="alert" v-if="listError">{{ listError }}</p>
    <p role="alert" v-if="statusError">{{ statusError }}</p>
    <p v-if="locating">좌표의 행정구역을 확인하고 있습니다.</p>
    <p v-if="unclassified && !locating">
      지역을 확인하지 못한 시설 {{ unclassified }}개는 전국 목록에서 확인할 수
      있습니다.
    </p>
    </div>
    <section v-if="clusterFacilityIds.length && !selected" class="live-cluster-list"><h2>묶음 시설 {{clusterRows.length}}곳</h2><button @click="clusterFacilityIds=[]">전체 목록으로</button><button v-for="row in clusterRows" :key="row.id" @click="selectFacility(row)">{{row.name}} · {{stateLabel(row)}}</button></section>
    <div :class="{ 'map-columns': !props.manager }">
      <section
        aria-label="전국 지하차도 지도"
        :class="{ 'map-canvas-column': !props.manager }"
      >
        <p v-if="mapError" role="alert">{{ mapError }}</p>
        <ul aria-label="마커 색상 안내" class="underpass-map-legend">
          <li v-for="style in markerStyles" :key="style.label">
            <span
              class="underpass-map-legend-dot"
              :data-state="style.label"
              :style="{background:style.color}"
            ></span>{{ style.label === '정상' ? '안전' : style.label === '경고' ? '주의' : style.label }}
          </li>
          <li><span class="underpass-map-legend-dot" style="background:#1671d9"></span>내 위치</li>
        </ul>
        <!-- 지도 표시에는 높이가 필요합니다. 지도 크기 외 디자인 CSS는 없습니다. -->
        <div class="live-map-surface">
        <div
          ref="mapElement"
          class="underpass-map-div"
          aria-label="카카오 지도"
        ></div>
        <div class="kakao-map-controls live-map-controls" aria-label="지도 조작">
          <button type="button" aria-label="카카오 지도 확대" @click="zoomMap(-1)">+</button>
          <button type="button" aria-label="카카오 지도 축소" @click="zoomMap(1)">−</button>
          <button type="button" aria-label="내 위치 찾기" :disabled="findingPosition" :aria-busy="findingPosition" @click="locateUser"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/></svg></button>
        </div></div>
      </section>
      <aside :class="{'map-sidebar': !props.manager}">
      <section
        v-if="selected"
        ref="detailRegion" tabindex="-1"
        aria-live="polite"
        :class="{ 'map-detail-column': !props.manager }"
      >
        <h2>{{ selected.name }}</h2><button @click="selectedId='';detail=null">{{clusterFacilityIds.length?'묶음 목록으로':'목록으로'}}</button>
        <p>{{ selected.address || "주소 미제공" }}</p>
        <p v-if="detailLoading">선택한 지하차도의 최신 상태를 조회 중입니다.</p>
        <p v-if="detailError" role="alert">{{ detailError }}</p>
        <dl>
          <dt>현재 상태</dt>
          <dd>{{ detailLoading ? "조회 중" : stateLabel(selected) }}</dd>
          <template v-if="props.manager">
            <dt>관측 기준 시각</dt>
            <dd>{{ formatTime(selected.updatedAt) }}</dd>
          </template>
          <template v-else>
            <dt class="observation-label">관측 기준 날짜</dt>
            <dd class="observation-value">{{ dateParts(selected.updatedAt)?.date ?? '—' }}</dd>
            <dt class="observation-label">관측 기준 시간</dt>
            <dd class="observation-value">{{ dateParts(selected.updatedAt)?.time ?? '—' }}</dd>
          </template>
          <dt>강우량</dt>
          <dd>
            {{
              selected.rainfallMm === null
                ? "—"
                : selected.rainfallMm + " mm"
            }}
          </dd>
          <dt>위험도</dt>
          <dd>
            {{
              selected.riskScore === null
                ? "—"
                : selected.riskScore.toFixed(2) + "점"
            }}
          </dd>

        </dl>
        <section v-if="!props.manager" class="compact-weather" aria-label="지하차도 인근 날씨">
          <h3>인근 날씨</h3><p v-if="weatherLoading">날씨 확인 중…</p><p v-else-if="weatherError" role="status">{{weatherError}}</p>
          <template v-else-if="compactWeather"><p>{{compactWeather.condition || '기상 상태 미제공'}} · {{compactWeather.temperature == null ? '기온 —' : compactWeather.temperature+'°C'}}</p><p>강우량 {{compactWeather.rainfall ?? selected.rainfallMm ?? '—'}} mm · 습도 {{compactWeather.humidity ?? '—'}}%</p><small>관측 {{formatTime(compactWeather.observedAt || '')}}</small></template>
        </section>
        <button v-if="!props.manager" type="button" @click="cctvOpen=true">주변 CCTV 보기</button>
        <p v-if="props.manager">
          <RouterLink
            :to="{
              name: 'manager-underpass-detail',
              params: { id: selected.id },
            }"
            >지하차도 상세 및 CCTV</RouterLink
          >
        </p>

        <button
          type="button"
          @click="
            detailAbort?.abort();
            selectedId = '';
            detail = null;
            detailError = '';
            infoWindow?.close();
          "
        >
          상세 닫기
        </button>
      </section>
      <section
        v-if="!props.manager && !selected"
        aria-label="선택한 지하차도 정보"
        class="underpass-map-section"
      >
        <h2>지하차도 정보</h2>
        <p>지도 또는 목록에서 지하차도를 선택해 주세요.</p>
      </section>
    <section class="map-list-column">
      <h2>지하차도 목록</h2>

      <p v-if="missingCoordinates">
        좌표가 없는 시설 {{ missingCoordinates }}개는 목록으로 표시합니다.
      </p>
      <div class="underpass-map-div-2">
        <table class="underpass-map-table">
          <caption>
            조회 결과
            {{
              filtered.length
            }}건
          </caption>
          <thead>
            <tr>
              <th scope="col">지하차도</th>
              <th scope="col">지역</th>
              <th scope="col" class="underpass-state-cell">상태</th>
              <th scope="col">기준 시각</th>
              <th scope="col">상세</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in shown" :key="row.id">
              <td><button class="facility-name-button" @click="selectFacility(row)">{{ row.name }}</button></td>
              <td>
                {{
                  regions.find((r) => r.id === row.regionId)?.name || "미분류"
                }}
              </td>
              <td class="underpass-state-cell"><span class="routel-page-state" :data-state="stateLabel(row)">{{ stateLabel(row) }}</span></td>
              <td>{{ formatTime(row.updatedAt) }}</td>
              <td><button @click="selectFacility(row)">상태 보기</button></td>
            </tr>
            <tr v-if="!shown.length">
              <td colspan="5">
                {{
                  loading
                    ? "조회 중입니다."
                    : listError
                      ? "정보를 불러오지 못했습니다."
                      : loaded
                        ? "조회 조건에 맞는 지하차도가 없습니다."
                        : "정보를 확인 중입니다."
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav v-if="pages > 1" class="facility-pagination" aria-label="목록 페이지">
        <button :disabled="page === 1" @click="page--">이전</button>
        <span>{{ page }} / {{ pages }} 페이지</span>
        <button :disabled="page === pages" @click="page++">다음</button>
      </nav>
    </section>      </aside>
    </div>
    <BusanCctvModal v-model="cctvOpen" :facility-name="selected?.name||''" :lat="selected?.latitude" :lng="selected?.longitude"/>
  </main>
</template>


<!-- 지도 SDK가 생성하는 DOM에도 적용되는 전용 클래스 스타일 -->
