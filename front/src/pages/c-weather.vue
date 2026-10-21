<script setup lang="ts">
import { riskChartSeries, riskTimestamp } from '../utils/risk-chart'
import { useRiskChartClock } from '../composables/useRiskChartClock'
import { useBackendEvents } from '../composables/useBackendEvents'
import { appendRiskHistory } from '../services/streamUpdates'
import { onBeforeUnmount, onMounted, ref, computed, watch } from 'vue'
import { displayDate, dateParts } from '../utils/display-date'
import HourlyForecast from '../components/HourlyForecast.vue'

type Hour = {
  time: string
  temperature?: number | null
  rainfall?: number | null
  precipitationProbability?: number | null
}
type Day = {
  date: string
  minTemperature?: number | null
  maxTemperature?: number | null
  precipitationProbability?: number | null
}
type Weather = {
  temperature?: number | null
  humidity?: number | null
  rainfall?: number | null
  condition?: string
  observedAt?: string
  hourly?: Hour[]
  daily?: Day[]
}
const offices = [
  ['서울', '서울특별시청'],
  ['부산', '부산광역시청'],
  ['대구', '대구광역시청'],
  ['인천', '인천광역시청'],
  ['광주', '광주광역시청'],
  ['대전', '대전광역시청'],
  ['울산', '울산광역시청'],
  ['세종', '세종특별자치시청'],
  ['경기', '경기도청'],
  ['강원', '강원특별자치도청'],
  ['충북', '충청북도청'],
  ['충남', '충청남도청'],
  ['전북', '전북특별자치도청'],
  ['전남', '전라남도청'],
  ['경북', '경상북도청'],
  ['경남', '경상남도청'],
  ['제주', '제주특별자치도청'],
]
// Administrative office locations resolved by Kakao Places; not weather stations.
const places = ref(
  offices.map(([name, office]) => ({ name: name!, office: office!, lat: NaN, lng: NaN })),
)
const selected = ref('부산')
const location = ref({ lat: 35.1796, lng: 129.0756 })
const mapEl = ref<HTMLElement | null>(null)
const weather = ref<Weather | null>(null)
const weatherIcon = computed(() => {
  const c = weather.value?.condition || ''
  if (/눈|진눈깨비|snow/i.test(c)) return 'snow'
  if (/비|소나기|rain|shower/i.test(c)) return 'rain'
  if (/흐림|구름|cloud|overcast/i.test(c)) return 'cloud'
  if (/맑|clear|sunny/i.test(c)) return 'sun'
  return 'unknown'
})
type Facility = {
  id: number
  name: string
  latitude: number
  longitude: number
  regionName?: string
  roadAddress?: string
  currentStatus?: string
  currentRiskLevel?: string
}
type Rainfall = {
  rainfallMm?: number | null
  rainfall1hMm?: number | null
  rainfall3hMm?: number | null
  rainfall6hMm?: number | null
  rainfall12hMm?: number | null
  rainfall24hMm?: number | null
  predictedAt?: string
}
const facilities = ref<Facility[]>([])
const selectedFacilityId = ref('')
// 지도에서 시·도를 고르면 그 지역(regionName)의 지하차도 목록을 보여줍니다.
const forecastSection = ref<HTMLElement | null>(null)
const isRegionSelected = computed(() => places.value.some((p) => p.name === selected.value))
const regionFacilities = computed(() =>
  isRegionSelected.value
    ? facilities.value.filter((f) => facilityRegion(f) === selected.value)
    : facilities.value,
)
function facilityRegion(f: Facility) {
  const value = String(f.regionName || f.roadAddress || '').split(' ')[0]
  const names: Record<string, string> = {
    '서울특별시': '서울',
    '부산광역시': '부산',
    '대구광역시': '대구',
    '인천광역시': '인천',
    '대전광역시': '대전',
    '울산광역시': '울산',
    '세종특별자치시': '세종',
    '경기도': '경기',
    '강원특별자치도': '강원',
    '강원도': '강원',
    '충청북도': '충북',
    '충청남도': '충남',
    '전북특별자치도': '전북',
    '전라북도': '전북',
    '전라남도': '전남',
    '광주광역시': '광주',
    '경상북도': '경북',
    '경상남도': '경남',
    '제주특별자치도': '제주',
  }
  return names[value] || value
}
function facilityState(f: Facility) {
  if (f.currentStatus === 'BLOCKED') return '통제'
  return (
    (
      { SAFE: '정상', NORMAL: '정상', DANGER: '주의', WARNING: '주의', CAUTION: '주의' } as Record<
        string,
        string
      >
    )[f.currentRiskLevel || ''] || '미확인'
  )
}
function pickFacility(f: Facility, scroll = true) {
  selectedFacilityId.value = String(f.id)
  rainfall.value = null
  riskPoints.value = []
  riskForecast.value = []
  rainfallStale.value = false
  location.value = { lat: Number(f.latitude), lng: Number(f.longitude) }
  if (map) {
    const maps = (window as any).kakao.maps
    map.relayout()
    map.setLevel(5)
    map.setCenter(new maps.LatLng(location.value.lat, location.value.lng))
  }
  void refresh()
  if (scroll)
    forecastSection.value?.scrollIntoView({
      block: 'start',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
}
const rainfall = ref<Rainfall | null>(null)
// 관리자 대시보드와 같은 위험점수 추이(최근 24건). 마지막 기록이 현재 강수량입니다.
type RiskPoint = Rainfall & { riskScore: number; predictedAt: string }
const riskPoints = ref<RiskPoint[]>([])
// 시간별 예보 그래프와 같은 모양으로, 그래프 영역 폭에 맞춰 좌표를 계산합니다.
const riskChartEl = ref<HTMLElement | null>(null)
const riskChartWidth = ref(680)
const riskClock = useRiskChartClock(),
  riskForecast = ref<Record<string, any>[]>([])
const riskChart = computed(() => {
  const width = Math.max(320, riskChartWidth.value),
    last = Math.max(...riskPoints.value.map((row) => riskTimestamp(row.predictedAt)))
  const rows = riskPoints.value.filter(
    (row) => riskTimestamp(row.predictedAt) >= last - 12 * 3600000,
  )
  const series = riskChartSeries(rows, riskForecast.value, 56, width - 84, 200, 172, {
    now: riskClock.value,
  })
  const ticks = [0, 25, 50, 75, 100].map((value) => ({
    y: 200 - (value / 100) * 172,
    label: value,
  }))
  const step = Math.max(1, Math.ceil(series.samples.length / Math.max(2, Math.floor(width / 110))))
  return {
    width,
    points: series.samples,
    ticks,
    labels: series.samples.filter(
      (_, index) => index % step === 0 || index === series.samples.length - 1,
    ),
    path: series.observedPath,
    forecastPath: series.forecastPath,
    carryPath: series.carryPath,
  }
})
async function fetchRiskForecast(signal?: AbortSignal) {
  const id = selectedFacilityId.value
  if (!id) return
  try {
    const response = await fetch(`/api/underpasses/${id}/risk-forecast`, {
      signal,
      credentials: 'include',
      cache: 'no-store',
    })
    if (!response.ok) throw new Error()
    const result = await response.json()
    if (!signal?.aborted && id === selectedFacilityId.value)
      riskForecast.value = Array.isArray(result.data) ? result.data : []
  } catch {
    if (!signal?.aborted && id === selectedFacilityId.value) riskForecast.value = []
  }
}
useBackendEvents(({ name, data }) => {
  if (name === 'risk-update' && String(data.underpassId) === selectedFacilityId.value)
    riskPoints.value = appendRiskHistory(riskPoints.value, data, 500)
  else if (name === 'connected') void refresh()
  else if (
    name === 'data-changed' &&
    data.resource === 'risk-forecast' &&
    String(data.id) === selectedFacilityId.value
  )
    void fetchRiskForecast(request?.signal)
})

const timeLabel = (value: string) => dateParts(value)?.time || value
const loading = ref(false)
const error = ref('')
const mapError = ref('')
const mapReady = ref(false)
const knownPlaces = computed(() =>
  places.value.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
)
const weatherStale = ref(false)
const rainfallStale = ref(false)
const oldObservation = computed(() => {
  const time = Date.parse(weather.value?.observedAt || '')
  return Number.isFinite(time) && Date.now() - time > 3600000
})
const show = (value: number | null | undefined, unit: string) =>
  value == null ? '—' : `${value}${unit}`
let map: any,
  marker: any,
  request: AbortController | undefined,
  timer: ReturnType<typeof setInterval> | undefined
let active = true
const weatherCache = new Map<string, { at: number; data: Weather | null }>()
const regionMarkers: any[] = []
const regionOverlays: any[] = []
let resize: ResizeObserver | undefined
let pickVersion = 0
const lookupTimers = new Set<ReturnType<typeof setTimeout>>()
const markMapInteraction = () => {
  pickVersion++
}
// 시·도 라벨이 서로 겹치면 화면 기준으로 조금씩 밀어냅니다. 확대해서 떨어지면 원래 자리로 돌아갑니다.
let declutterTimer: ReturnType<typeof setTimeout> | undefined
function declutterLabels() {
  clearTimeout(declutterTimer)
  declutterTimer = setTimeout(() => {
    const labels = regionOverlays.map((o) => o.getContent() as HTMLElement)
    labels.forEach((el) => {
      el.style.transform = ''
    })
    const boxes = labels
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { el, x: r.left, y: r.top, w: r.width, h: r.height, dx: 0, dy: 0 }
      })
      .filter((b) => b.w > 0)
    const gap = 2
    for (let pass = 0; pass < 40; pass++) {
      let moved = false
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!,
            b = boxes[j]!
          const ax = a.x + a.dx,
            ay = a.y + a.dy,
            bx = b.x + b.dx,
            by = b.y + b.dy
          const ox = Math.min(ax + a.w, bx + b.w) - Math.max(ax, bx) + gap,
            oy = Math.min(ay + a.h, by + b.h) - Math.max(ay, by) + gap
          if (ox <= 0 || oy <= 0) continue
          moved = true
          // 덜 겹친 방향으로 두 라벨을 절반씩 밀어냅니다.
          if (oy <= ox) {
            const s = ((ay <= by ? -1 : 1) * oy) / 2
            a.dy += s
            b.dy -= s
          } else {
            const s = ((ax <= bx ? -1 : 1) * ox) / 2
            a.dx += s
            b.dx -= s
          }
        }
      if (!moved) break
    }
    boxes.forEach((b) => {
      if (b.dx || b.dy)
        b.el.style.transform = `translate(${Math.round(b.dx)}px,${Math.round(b.dy)}px)`
    })
  }, 50)
}

// 지도에서 고른 좌표 기준으로 가장 가까운 weather_area의 날씨를 가져옵니다(현재/시간별/일별).
async function fetchWeather(lat: number, lng: number, signal: AbortSignal) {
  try {
    const key = `${lat},${lng}`,
      cached = weatherCache.get(key)
    if (cached && Date.now() - cached.at < 60000) {
      if (active && request?.signal === signal) {
        weather.value = cached.data
        weatherStale.value = false
      }
      return
    }
    const response = await fetch(`/api/weather?lat=${lat}&lng=${lng}`, {
      signal,
      cache: 'no-store',
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || body?.success === false)
      throw new Error(body?.message || '날씨 정보를 받아오지 못했습니다.')
    if (active && request?.signal === signal) {
      weather.value = body.data ?? null
      weatherStale.value = false
      weatherCache.set(key, { at: Date.now(), data: weather.value })
    }
  } catch (cause) {
    if (!active || signal.aborted || request?.signal !== signal) return
    weatherStale.value = weather.value !== null
    error.value = cause instanceof Error ? cause.message : '날씨 정보를 받아오지 못했습니다.'
  }
}

async function refresh() {
  request?.abort()
  const current = new AbortController()
  request = current
  loading.value = true
  error.value = ''
  try {
    const weatherLoad = fetchWeather(location.value.lat, location.value.lng, current.signal)
    if (!facilities.value.length) {
      const collected: Facility[] = []
      for (let page = 1; page <= 100; page++) {
        const response = await fetch(`/api/underpasses?page=${page}&size=100`, {
          signal: current.signal,
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('시설 목록을 받아오지 못했습니다.')
        const body = await response.json()
        collected.push(
          ...(body.data?.items || []).filter(
            (row: Facility) =>
              Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)),
          ),
        )
        if (page >= Number(body.data?.totalPages || 1)) break
      }
      if (!active || request !== current || current.signal.aborted) return
      facilities.value = collected
      drawFacilityMarkers(true)
    }
    if (!active || request !== current || current.signal.aborted) return
    if (!selectedFacilityId.value && regionFacilities.value.length) {
      const near = [...regionFacilities.value].sort(
        (a, b) =>
          (Number(a.latitude) - location.value.lat) ** 2 +
          (Number(a.longitude) - location.value.lng) ** 2 -
          ((Number(b.latitude) - location.value.lat) ** 2 +
            (Number(b.longitude) - location.value.lng) ** 2),
      )[0]
      selectedFacilityId.value = String(near!.id)
    }
    if (!selectedFacilityId.value) {
      rainfall.value = null
      riskPoints.value = []
      riskForecast.value = []
      await weatherLoad
      return
    }
    const response = await fetch(
      `/api/underpasses/${selectedFacilityId.value}/risk-scores?hours=24`,
      { signal: current.signal, cache: 'no-store' },
    )
    if (!response.ok) throw new Error('강수량 기록을 받아오지 못했습니다.')
    const body = await response.json()
    if (active && request === current) {
      const rows: RiskPoint[] = Array.isArray(body.data) ? body.data : []
      rainfall.value = rows.at(-1) ?? null
      riskPoints.value = rows
      await fetchRiskForecast(current.signal)
      rainfallStale.value = false
    }
    await weatherLoad
  } catch (cause) {
    if (!active || current.signal.aborted || request !== current) return
    rainfallStale.value = rainfall.value !== null
    error.value = cause instanceof Error ? cause.message : '강수량 기록을 받아오지 못했습니다.'
  } finally {
    if (active && request === current) loading.value = false
  }
}

function choose(name: string, lat: number, lng: number) {
  pickVersion++
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    error.value = '지역 좌표 연결 확인 필요'
    return
  }
  weather.value = null
  rainfall.value = null
  riskPoints.value = []
  riskForecast.value = []
  weatherStale.value = false
  rainfallStale.value = false
  selected.value = name
  location.value = { lat, lng }
  selectedFacilityId.value = ''
  if (map) {
    const point = new (window as any).kakao.maps.LatLng(lat, lng)
    map.setLevel(8)
    map.setCenter(point)
    drawFacilityMarkers(true)
    marker?.setMap(null)
    regionOverlays.forEach((o) => {
      const el = o.getContent()
      el.classList.toggle('is-selected', el.dataset.region === name)
      el.setAttribute('aria-pressed', String(el.dataset.region === name))
    })
  }
  void refresh()
}
function selectPlace(event: Event) {
  const place = places.value.find((p) => p.name === (event.target as HTMLSelectElement).value)
  if (place) choose(place.name, place.lat, place.lng)
}
function showNation() {
  if (!map || !knownPlaces.value.length) return
  pickVersion++
  selected.value = '전국'
  selectedFacilityId.value = ''
  drawFacilityMarkers()
  const maps = (window as any).kakao.maps
  const bounds = new maps.LatLngBounds()
  const points = facilities.value.filter(
    (f) => Number.isFinite(Number(f.latitude)) && Number.isFinite(Number(f.longitude)),
  )
  if (points.length)
    points.forEach((f) => bounds.extend(new maps.LatLng(Number(f.latitude), Number(f.longitude))))
  else knownPlaces.value.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)))
  map.setBounds(bounds, 44, 44, 44, 44)
}

function drawFacilityMarkers(fit = false) {
  if (!map) return
  const maps = (window as any).kakao.maps
  regionMarkers.splice(0).forEach((m) => m.setMap(null))
  const rows = regionFacilities.value.filter(
    (f) => Number.isFinite(Number(f.latitude)) && Number.isFinite(Number(f.longitude)),
  )
  const bounds = new maps.LatLngBounds()
  for (const f of rows) {
    const point = new maps.LatLng(Number(f.latitude), Number(f.longitude))
    bounds.extend(point)
    const color =
      ({ '통제': '#8b1e2d', '주의': '#e8b923', '정상': '#2eaa6b' } as Record<string, string>)[
        facilityState(f)
      ] || '#8793a0'
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="9" fill="${color}" stroke="white" stroke-width="3"/></svg>`
    const marker = new maps.Marker({
      map,
      position: point,
      title: f.name + ' · ' + facilityState(f),
      image: new maps.MarkerImage(
        'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
        new maps.Size(24, 24),
      ),
    })
    maps.event.addListener(marker, 'click', () => pickFacility(f, false))
    regionMarkers.push(marker)
  }
  if (fit && rows.length) {
    map.relayout()
    map.setBounds(bounds, 40, 40, 40, 40)
    if (rows.length === 1) map.setLevel(6)
  }
}
function selectFacilityFromList() {
  const f = facilities.value.find((f) => String(f.id) === selectedFacilityId.value)
  if (f) pickFacility(f, false)
}

async function loadMap() {
  const win = window as any
  try {
    if (!win.kakao?.maps?.load) {
      let script = document.querySelector<HTMLScriptElement>(
        'script[src*="dapi.kakao.com/v2/maps/sdk.js"]',
      )
      if (!script) {
        script = document.createElement('script')
        const key = import.meta.env.VITE_KAKAO_MAP_KEY || ''
        if (!key) throw new Error('카카오 지도 키를 설정해 주세요.')
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`
        document.head.appendChild(script)
      }
      await new Promise<void>((resolve, reject) => {
        if (win.kakao?.maps?.load) return resolve()
        script!.addEventListener('load', () => resolve(), { once: true })
        script!.addEventListener('error', () => reject(new Error('지도 로드 실패')), { once: true })
      })
    }
    if (!active) return
    win.kakao.maps.load(() => {
      if (!active || !mapEl.value) return
      const maps = win.kakao.maps
      const position = new maps.LatLng(location.value.lat, location.value.lng)
      map = new maps.Map(mapEl.value, { center: position, level: 13 })
      mapReady.value = true
      const bounds = new maps.LatLngBounds()
      const addPlace = (place: { name: string; lat: number; lng: number }) => {
        if (!active || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return
        const point = new maps.LatLng(place.lat, place.lng)
        bounds.extend(point)
      }
      // Two workers bound lookup concurrency; exact office names exclude nearby shops/branches.
      const lookup = new maps.services.Places()
      let next = 0,
        found = 0
      const initialPick = pickVersion
      const resolveOffice = (place: (typeof places.value)[number]) =>
        new Promise<void>((resolve) => {
          let finished = false
          const timeout = setTimeout(() => {
            lookupTimers.delete(timeout)
            finished = true
            resolve()
          }, 8000)
          lookupTimers.add(timeout)
          lookup.keywordSearch(place.office, (rows: any[], status: string) => {
            if (finished) return
            finished = true
            clearTimeout(timeout)
            lookupTimers.delete(timeout)
            if (active && status === maps.services.Status.OK) {
              const row = rows.find((r) => String(r.place_name).replace(/\s/g, '') === place.office)
              if (row && Number.isFinite(Number(row.y)) && Number.isFinite(Number(row.x))) {
                place.lat = Number(row.y)
                place.lng = Number(row.x)
                addPlace(place)
                found++
              }
            }
            resolve()
          })
        })
      const worker = async () => {
        while (active && next < places.value.length) {
          const place = places.value[next++]!
          await resolveOffice(place)
        }
      }
      void Promise.all([worker(), worker()]).then(() => {
        if (!active) return
        if (found && pickVersion === initialPick) drawFacilityMarkers(true)
      })
      maps.event.addListener(map, 'dragstart', markMapInteraction)
      maps.event.addListener(map, 'zoom_changed', markMapInteraction)
      maps.event.addListener(map, 'idle', declutterLabels)
      map.setZoomable(false)
      map.addControl(new maps.ZoomControl(), maps.ControlPosition.BOTTOMRIGHT)
      resize = new ResizeObserver(() => {
        const center = map.getCenter()
        map.relayout()
        map.setCenter(center)
      })
      resize.observe(mapEl.value)

      drawFacilityMarkers(true)
    })
  } catch {
    mapError.value = '지도를 불러오지 못했습니다. 카카오 지도 키와 등록 도메인을 확인해 주세요.'
  }
}
let riskChartResize: ResizeObserver | undefined
onMounted(() => {
  if (riskChartEl.value) {
    riskChartWidth.value = riskChartEl.value.clientWidth || riskChartWidth.value
    riskChartResize = new ResizeObserver(([entry]) => {
      if (entry) riskChartWidth.value = Math.round(entry.contentRect.width)
    })
    riskChartResize.observe(riskChartEl.value)
  }
  void loadMap()
  void refresh()
})
onBeforeUnmount(() => {
  active = false
  riskChartResize?.disconnect()
  lookupTimers.forEach(clearTimeout)
  lookupTimers.clear()
  if (map) {
    const events = (window as any).kakao?.maps?.event
    events?.removeListener(map, 'dragstart', markMapInteraction)
    events?.removeListener(map, 'zoom_changed', markMapInteraction)
    events?.removeListener(map, 'idle', declutterLabels)
  }
  clearTimeout(declutterTimer)
  resize?.disconnect()
  regionMarkers.forEach((m) => m.setMap(null))
  regionOverlays.forEach((m) => m.setMap(null))
  marker?.setMap(null)
  request?.abort()
  if (timer) clearInterval(timer)
})
</script>

<template>
  <main class="wire-page customer-content page-c-weather routel-content-page weather-page">
    <h1>날씨</h1>
    <div class="weather-place">
      <label for="weather-region">지역</label>
      <select id="weather-region" :value="selected" @change="selectPlace">
        <option v-if="!places.some(p => p.name === selected)" :value="selected">
          {{ selected }}
        </option>
        <option
          v-for="place in places"
          :key="place.name"
          :value="place.name"
          :disabled="!Number.isFinite(place.lat)"
        >
          {{ place.name }}{{ Number.isFinite(place.lat) ? '' : ' (위치 확인 중)' }}
        </option>
      </select>
    </div>
    <section ref="forecastSection" class="weather-forecast">
      <h2>시설별 강수량</h2>
      <label>조회 시설 <select v-model="selectedFacilityId" @change="selectFacilityFromList">
          <option v-for="item in regionFacilities" :key="item.id" :value="String(item.id)">
            {{ item.name }}
          </option>
        </select>
      </label>

      <dl class="weather-rain-grid">
        <div
          v-for="item in [
          { label: '현재', value: rainfall?.rainfallMm }, { label: '1시간', value: rainfall?.rainfall1hMm },
          { label: '3시간', value: rainfall?.rainfall3hMm }, { label: '6시간', value: rainfall?.rainfall6hMm },
          { label: '12시간', value: rainfall?.rainfall12hMm }, { label: '24시간', value: rainfall?.rainfall24hMm },
        ]"
          :key="item.label"
        >
          <dt>{{ item.label }}</dt>
          <dd>{{ show(item.value, ' mm') }}</dd>
        </div>
      </dl>
      <p v-if="rainfallStale" role="status">갱신 실패 · 이전 수신 강수량 기록입니다.</p>
      <p>기록 시각: {{ displayDate(rainfall?.predictedAt) }}</p>
      <h3 class="weather-risk-title">위험도 추이 · 최근 12시간</h3>

      <div ref="riskChartEl" class="weather-risk-chart">
        <svg
          v-if="riskChart.points.length"
          class="weather-risk-trend"
          :width="riskChart.width"
          height="240"
          :viewBox="`0 0 ${riskChart.width} 240`"
          role="img"
          aria-label="선택한 지하차도 위험점수 추이 꺾은선 그래프"
        >
          <g v-for="tick in riskChart.ticks" :key="tick.label" class="weather-risk-grid">
            <line x1="48" :x2="riskChart.width - 20" :y1="tick.y" :y2="tick.y" />
            <text x="38" :y="tick.y + 4" text-anchor="end">{{ tick.label }}</text>
          </g>
          <path class="weather-risk-line" :d="riskChart.path" />
          <path
            v-if="riskChart.forecastPath"
            class="weather-risk-line"
            :d="riskChart.forecastPath"
            stroke-dasharray="6 4"
          />
          <path
            v-if="riskChart.carryPath"
            class="weather-risk-line"
            :d="riskChart.carryPath"
            stroke-dasharray="2 3"
            opacity=".5"
          />
          <circle
            v-for="(point, index) in riskChart.points"
            :key="index"
            class="weather-risk-dot"
            :cx="point.x"
            :cy="point.y"
            r="3.5"
          >
            <title>{{ displayDate(point.time) }} · {{ point.score.toFixed(2) }}점</title>
          </circle>
          <text
            v-for="(point, index) in riskChart.labels"
            :key="'t' + index"
            class="weather-risk-time"
            :x="point.x"
            y="226"
            text-anchor="middle"
          >
            {{ timeLabel(point.time) }}
          </text>
        </svg>
        <p v-else>표시할 위험점수 기록이 없습니다.</p>
        <p v-if="riskChart.forecastPath">실선: 관측 · 점선: 향후 3시간 예측</p>
        <p v-if="riskChart.carryPath">엷은 점선: 최근 관측값을 현재까지 유지 (추가 관측 아님)</p>
      </div>
    </section>
    <div class="weather-overview">
      <section>
        <h2>{{ selected }} 지하차도 지도</h2>
        <div class="weather-map-wrap">
          <div ref="mapEl" class="weather-map" aria-label="날씨 조회 지역 지도"></div>
          <button
            class="weather-nation-button"
            type="button"
            :disabled="!mapReady || !knownPlaces.length"
            @click.stop="showNation"
          >전국 보기</button>
        </div>
        <p v-if="mapError" role="status">{{ mapError }}</p>
      </section>
      <section class="weather-current">
        <h2>{{ selected }} 최근 관측 날씨</h2>

        <p v-if="loading" role="status">조회 중…</p>
        <p v-if="error" role="status">{{ error }}</p>
        <p v-if="weatherStale" role="status">갱신 실패 · 이전 수신 날씨입니다.</p>
        <svg
          v-if="weather"
          class="weather-symbol"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <g v-if="weatherIcon==='sun'">
            <circle cx="32" cy="32" r="12" />
            <path d="M32 5v7m0 40v7M5 32h7m40 0h7M13 13l5 5m28 28 5 5M13 51l5-5m28-28 5-5" />
          </g>
 <g v-else-if="weatherIcon!=='unknown'">
            <path d="M18 42a11 11 0 1 1 1-22 15 15 0 0 1 29 2 10 10 0 1 1 1 20Z" />
            <path v-if="weatherIcon==='rain'" d="m22 48-3 8m14-8-3 8m14-8-3 8" />
            <path v-if="weatherIcon==='snow'" d="M22 48v10m-4-5h8m13-5v10m-4-5h8" />
          </g>
 <g v-else>
            <circle cx="32" cy="32" r="22" stroke-dasharray="3 5" />
            <path d="M26 25a6 6 0 1 1 10 4c-3 2-4 3-4 7m0 7h.1" />
          </g>
        </svg>
        <strong class="weather-temperature">{{ show(weather?.temperature, '°C') }}</strong>
        <p v-if="oldObservation" role="status">1시간 이상 지난 관측 자료입니다. 관측 시각을 확인해 주세요.</p>
        <p>{{ weather?.condition || '—' }}</p>
        <dl>
          <dt>강우량</dt>
          <dd>{{ show(weather?.rainfall, ' mm') }}</dd>
          <dt>습도</dt>
          <dd>{{ show(weather?.humidity, '%') }}</dd>
          <dt>관측 시각</dt>
          <dd>{{ displayDate(weather?.observedAt) }}</dd>
        </dl>
      </section>
    </div>
    <section v-if="isRegionSelected" class="weather-region-facilities">
      <h2>
        {{ selected }} 지하차도 <small>{{ regionFacilities.length }}곳</small>
      </h2>
      <ul v-if="regionFacilities.length">
        <li v-for="item in regionFacilities" :key="item.id">
          <button
            type="button"
            :aria-pressed="selectedFacilityId === String(item.id)"
            @click="pickFacility(item)"
          >
            <strong>{{ item.name }}</strong>
            <span class="weather-region-facility-address">
              {{ item.roadAddress || '주소 미제공' }}
            </span>
            <span class="routel-page-state" :data-state="facilityState(item)">
              {{ facilityState(item) }}
            </span>
          </button>
        </li>
      </ul>
      <p v-else>이 지역에 등록된 지하차도가 없습니다.</p>
    </section>
    <section class="weather-forecast">
      <h2>시간별 예보</h2>
      <HourlyForecast v-if="weather?.hourly?.length" :hours="weather.hourly.slice(0, 12)" />
      <p v-else>자료 없음</p>
    </section>
    <section class="weather-forecast">
      <h2>일별 예보</h2>
      <div v-if="weather?.daily?.length" class="weather-scroll">
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th v-for="row in weather.daily" :key="row.date">{{ row.date }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>최저 / 최고</th>
              <td v-for="row in weather.daily" :key="row.date">
                {{ show(row.minTemperature, '°C') }} / {{ show(row.maxTemperature, '°C') }}
              </td>
            </tr>
            <tr>
              <th>강수 확률</th>
              <td v-for="row in weather.daily" :key="row.date">
                {{ show(row.precipitationProbability, '%') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else>자료 없음</p>
    </section>
  </main>
</template>
