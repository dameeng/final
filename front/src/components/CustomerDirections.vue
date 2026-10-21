<script setup lang="ts">
import NotificationBell from './NotificationBell.vue'
import { pageFriendlyMapScroll } from '../runtime/mapScroll'
let disposeMapScroll: (() => void) | undefined

import CustomerAppNav from './CustomerAppNav.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useApp } from '../stores/app'
import { loadKakao } from '../services/kakao'
import TrafficVideo from './TrafficVideo.vue'
import { getNearbyBusanCctvs } from '../services/busanCctv'
import {
  navigationRequest,
  searchNavigationPlaces,
  routePoints,
  passesAvoidPoint,
  type Place,
  type Route,
  type Point,
  type Guide,
} from '../services/navigation'
import { projectRoute, distanceMeters, formatDistance } from '../utils/navigation-progress'
import '../styles/customer-app-7.css'
import '../styles/customer-directions.css'
const store = useApp(),
  mapHost = ref<HTMLElement>(),
  originText = ref('부산역'),
  destinationText = ref('서면역'),
  origin = ref<Place | null>(null),
  destination = ref<Place | null>(null),
  choices = ref<Place[]>([]),
  choosing = ref<'origin' | 'destination'>('origin')
const routes = ref<Route[]>([]),
  selected = ref(0),
  busy = ref(false),
  error = ref(''),
  mapError = ref(''),
  avoid = ref<Point | null>(null),
  pickingAvoid = ref(false)
type Weather = {
  temperature: number | null
  humidity: number | null
  rainfall: number | null
  condition: string
  observedAt: string
}
type Camera = { name: string; url: string }
const weather = ref<Weather | null>(null),
  weatherError = ref(''),
  cameras = ref<Camera[]>([]),
  cameraError = ref(''),
  infoLoading = ref(false),
  camera = ref<Camera | null>(null),
  videoError = ref(false)
const active = computed(() => routes.value[selected.value]),
  guides = computed(() => active.value?.sections.flatMap((section) => section.guides || []) || [])
let sdk: any,
  map: any,
  resize: ResizeObserver | undefined,
  drawn: any[] = [],
  avoidCircle: any,
  controller: AbortController | undefined,
  alive = true
const events: { event: string; handler: (...args: any[]) => void }[] = [],
  coord = (point: Point) => `${point.lng},${point.lat}`
function listen(event: string, handler: (...args: any[]) => void) {
  sdk.maps.event.addListener(map, event, handler)
  events.push({ event, handler })
}
function clearDrawing() {
  drawn.forEach((item) => item.setMap(null))
  drawn = []
}
function draw() {
  if (!map || !active.value || !origin.value || !destination.value) return
  clearDrawing()
  const path = routePoints(active.value).map((p) => new sdk.maps.LatLng(p.lat, p.lng))
  if (!path.length) return
  drawn.push(
    new sdk.maps.Polyline({
      map,
      path,
      strokeWeight: 6,
      strokeColor: '#2878cc',
      strokeOpacity: 0.9,
    }),
  )
  for (const p of [origin.value, destination.value])
    drawn.push(
      new sdk.maps.Marker({ map, position: new sdk.maps.LatLng(p.lat, p.lng), title: p.name }),
    )
  const bounds = new sdk.maps.LatLngBounds()
  path.forEach((p) => bounds.extend(p))
  map.setBounds(bounds, 80, 40, 190, 40)
  if (requested.value) followPosition()
}
function pickPlace(place: Place) {
  if (choosing.value === 'origin') {
    origin.value = place
    originText.value = place.name
  } else {
    destination.value = place
    destinationText.value = place.name
  }
  choices.value = []
  routes.value = []
  clearDrawing()
}
async function searchPlace(field: 'origin' | 'destination') {
  choosing.value = field
  error.value = ''
  try {
    choices.value = await searchNavigationPlaces(
      (field === 'origin' ? originText.value : destinationText.value).trim(),
    )
    if (!choices.value.length) error.value = '검색한 장소를 찾지 못했습니다.'
  } catch (e) {
    error.value = (e as Error).message
  }
}
async function resolvePlace(field: 'origin' | 'destination', signal: AbortSignal) {
  const existing = field === 'origin' ? origin.value : destination.value
  if (existing) return existing
  const q = (field === 'origin' ? originText.value : destinationText.value).trim()
  if (!q) throw Error('출발지와 도착지를 입력해 주세요.')
  const found = await searchNavigationPlaces(q, signal)
  if (!found.length) throw Error(`“${q}” 장소를 찾지 못했습니다.`)
  const place = found.find((p) => p.name === q) || found[0]!
  if (field === 'origin') {
    origin.value = place
    originText.value = place.name
  } else {
    destination.value = place
    destinationText.value = place.name
  }
  return place
}
async function loadInfo(place: Place, signal: AbortSignal) {
  infoLoading.value = true
  weatherError.value = ''
  cameraError.value = ''
  const result = await Promise.allSettled([
    navigationRequest<Weather>(
      'weather',
      { lat: String(place.lat), lng: String(place.lng) },
      signal,
    ),
    getNearbyBusanCctvs(place.lat, place.lng),
  ])
  if (!alive || signal.aborted) return
  const [wx, cc] = result
  if (wx.status === 'fulfilled') weather.value = wx.value
  else weatherError.value = wx.reason.message
  if (cc.status === 'fulfilled') cameras.value = cc.value
  else cameraError.value = cc.reason.message
  infoLoading.value = false
}
async function search() {
  stopNavigation()
  position.value = null
  controller?.abort()
  const current = new AbortController()
  controller = current
  busy.value = true
  error.value = ''
  routes.value = []
  choices.value = []
  weather.value = null
  cameras.value = []
  camera.value = null
  clearDrawing()
  try {
    const [from, to] = await Promise.all([
      resolvePlace('origin', current.signal),
      resolvePlace('destination', current.signal),
    ])
    void loadInfo(to, current.signal)
    let candidates = await navigationRequest<Route[]>(
      'directions',
      { origin: coord(from), destination: coord(to) },
      current.signal,
    )
    if (avoid.value) {
      const point = avoid.value
      candidates = candidates.filter((r) => !passesAvoidPoint(r, point))
      if (!candidates.length) {
        const dy = 600 / 111000,
          dx = 600 / (111000 * Math.cos((point.lat * Math.PI) / 180))
        for (const waypoint of [
          { lat: point.lat + dy, lng: point.lng },
          { lat: point.lat - dy, lng: point.lng },
          { lat: point.lat, lng: point.lng + dx },
          { lat: point.lat, lng: point.lng - dx },
        ]) {
          const found = await navigationRequest<Route[]>(
            'directions',
            { origin: coord(from), destination: coord(to), waypoint: coord(waypoint) },
            current.signal,
          )
          candidates.push(...found.filter((r) => !passesAvoidPoint(r, point)))
        }
        candidates.sort((a, b) => a.summary.duration - b.summary.duration)
      }
    }
    if (!candidates.length)
      throw Error(
        avoid.value
          ? '지정한 지점을 피하는 경로를 찾지 못했습니다.'
          : '이 구간에서 자동차 경로를 찾지 못했습니다.',
      )
    if (!alive || current.signal.aborted) return
    routes.value = candidates
    selected.value = 0
    editing.value = false
    await nextTick()
    draw()
  } catch (e) {
    if (!current.signal.aborted) error.value = (e as Error).message
  } finally {
    if (!current.signal.aborted) busy.value = false
  }
}
function clearAvoid() {
  avoid.value = null
  avoidCircle?.setMap(null)
  pickingAvoid.value = false
  editing.value = true
  routes.value = []
  clearDrawing()
}
function locate() {
  if (!navigator.geolocation) {
    error.value = '위치를 지원하지 않는 브라우저입니다.'
    return
  }
  navigator.geolocation.getCurrentPosition(
    (p) => {
      if (!alive) return
      origin.value = { name: '내 위치', lat: p.coords.latitude, lng: p.coords.longitude }
      originText.value = '내 위치'
      map?.panTo(new sdk.maps.LatLng(p.coords.latitude, p.coords.longitude))
    },
    () => {
      if (alive) error.value = '위치 권한을 확인해 주세요.'
    },
    { timeout: 10000 },
  )
}
function focusGuide(g: Guide) {
  map?.setLevel(3)
  map?.panTo(new sdk.maps.LatLng(g.y, g.x))
}
const editing = ref(true),
  guideDialog = ref<HTMLDialogElement>(),
  cameraDialog = ref<HTMLDialogElement>(),
  infoDialog = ref<HTMLDialogElement>(),
  cameraQuery = ref('')
const requested = ref(false),
  position = ref<(Point & { accuracy: number; speed: number | null }) | null>(null),
  following = ref(true),
  arrived = ref(false),
  voice = ref(false),
  gpsError = ref('')
let watchId: number | undefined, userOverlay: any
const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const routePath = computed(() => (active.value ? routePoints(active.value) : []))
const progress = computed(() =>
  position.value ? projectRoute(routePath.value, position.value) : null,
)
const navigating = computed(() => requested.value && position.value !== null)
const offRoute = computed(
  () => !!progress.value && progress.value.distance > Math.max(100, position.value?.accuracy || 0),
)
const guidePositions = computed(() =>
  guides.value.map(
    (guide) => projectRoute(routePath.value, { lat: guide.y, lng: guide.x }).progress,
  ),
)
const guideIndex = computed(() => {
  if (!progress.value) return 0
  const next = guidePositions.value.findIndex((meters) => meters > progress.value!.progress + 15)
  return next < 0 ? Math.max(0, guides.value.length - 1) : next
})
const currentGuide = computed(() => guides.value[guideIndex.value])
const nextDistance = computed(() =>
  progress.value
    ? Math.max(
        0,
        (guidePositions.value[guideIndex.value] ?? progress.value.total) - progress.value.progress,
      )
    : 0,
)
const remainingDistance = computed(() =>
  arrived.value
    ? 0
    : active.value
      ? progress.value && requested.value
        ? active.value.summary.distance *
          (1 - progress.value.progress / Math.max(1, progress.value.total))
        : active.value.summary.distance
      : 0,
)
const remainingMinutes = computed(() => {
  if (!active.value) return 0
  const estimate =
    ((active.value.summary.duration / 60) * remainingDistance.value) /
    Math.max(1, active.value.summary.distance)
  return Math.max(arrived.value ? 0 : 1, Math.ceil(estimate - 1e-6))
})
const arrivalTime = computed(() =>
  new Date(Date.now() + remainingMinutes.value * 60000).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }),
)
const filteredCameras = computed(() =>
  cameras.value.filter((item) => item.name.includes(cameraQuery.value.trim())),
)
const turnIcon = computed(() =>
  /좌회전|왼쪽/.test(currentGuide.value?.guidance || '')
    ? '↰'
    : /우회전|오른쪽/.test(currentGuide.value?.guidance || '')
      ? '↱'
      : /유턴/.test(currentGuide.value?.guidance || '')
        ? '↶'
        : '↑',
)
function stopNavigation(resetArrival = true) {
  if (watchId !== undefined) navigator.geolocation.clearWatch(watchId)
  watchId = undefined
  requested.value = false
  userOverlay?.setMap(null)
  userOverlay = undefined
  if (speechSupported && voice.value) speechSynthesis.cancel()
  if (resetArrival) arrived.value = false
}
function followPosition() {
  if (!map || !position.value) return
  const point = new sdk.maps.LatLng(position.value.lat, position.value.lng)
  if (sdk.maps.CustomOverlay) {
    if (!userOverlay)
      userOverlay = new sdk.maps.CustomOverlay({
        map,
        position: point,
        content: '<span class="navigation-user-dot" aria-label="내 위치"></span>',
        zIndex: 10,
      })
    else userOverlay.setPosition(point)
  }
  if (following.value) {
    map.setLevel(3)
    map.panTo(point)
  }
}
function startNavigation() {
  if (!active.value || routePath.value.length < 2) return
  stopNavigation()
  gpsError.value = ''
  position.value = null
  following.value = true
  editing.value = false
  if (!navigator.geolocation) {
    gpsError.value = '현재 위치를 지원하지 않는 브라우저입니다.'
    return
  }
  requested.value = true
  watchId = navigator.geolocation.watchPosition(
    (fix) => {
      if (!alive || !requested.value) return
      position.value = {
        lat: fix.coords.latitude,
        lng: fix.coords.longitude,
        accuracy: fix.coords.accuracy,
        speed: fix.coords.speed,
      }
      gpsError.value = ''
      followPosition()
      if (
        destination.value &&
        fix.coords.accuracy <= 50 &&
        distanceMeters(position.value, destination.value) <= 35 &&
        (progress.value?.remaining ?? Infinity) < 100
      ) {
        arrived.value = true
        stopNavigation(false)
      }
    },
    (failure) => {
      if (!alive) return
      gpsError.value =
        failure.code === 1
          ? '위치 권한을 허용하면 안내를 시작할 수 있습니다.'
          : failure.code === 3
            ? '현재 위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.'
            : '현재 위치를 확인하지 못했습니다. 다시 시도해 주세요.'
      stopNavigation()
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 },
  )
}
function recenter() {
  following.value = true
  followPosition()
}
function chooseRoute(index: number) {
  stopNavigation()
  position.value = null
  selected.value = index
  draw()
}
function editRoute() {
  stopNavigation()
  editing.value = true
}
function reroute() {
  if (position.value) {
    origin.value = { name: '내 위치', lat: position.value.lat, lng: position.value.lng }
    originText.value = '내 위치'
  }
  void search()
}
function openCameras() {
  camera.value = null
  cameraQuery.value = ''
  cameraDialog.value?.showModal()
}
function closeCameras() {
  camera.value = null
  cameraDialog.value?.close()
}
function chooseGuide(guide: Guide) {
  following.value = false
  focusGuide(guide)
  guideDialog.value?.close()
}
function retryInfo() {
  if (destination.value && controller && !controller.signal.aborted)
    void loadInfo(destination.value, controller.signal)
}
watch([guideIndex, navigating, voice], () => {
  if (
    !navigating.value ||
    !voice.value ||
    !speechSupported ||
    !currentGuide.value ||
    offRoute.value
  )
    return
  speechSynthesis.cancel()
  const message = new SpeechSynthesisUtterance(
    `${formatDistance(nextDistance.value)} 후 ${currentGuide.value.guidance}`,
  )
  message.lang = 'ko-KR'
  speechSynthesis.speak(message)
})
watch(voice, (enabled) => {
  if (!enabled && speechSupported) speechSynthesis.cancel()
})
onBeforeUnmount(() => {
  stopNavigation()
  guideDialog.value?.close()
  cameraDialog.value?.close()
  infoDialog.value?.close()
})
onMounted(async () => {
  try {
    sdk = await loadKakao()
    if (!alive || !mapHost.value) return
    map = new sdk.maps.Map(mapHost.value, {
      center: new sdk.maps.LatLng(35.1796, 129.0756),
      level: 7,
    })
    disposeMapScroll = pageFriendlyMapScroll(mapHost.value, map)
    map.setCursor('grab')
    listen('dragstart', () => {
      map.setCursor('grabbing')
      if (requested.value) following.value = false
    })
    listen('dragend', () => map.setCursor('grab'))
    listen('click', (e: any) => {
      if (!pickingAvoid.value) return
      avoid.value = { lat: e.latLng.getLat(), lng: e.latLng.getLng() }
      avoidCircle?.setMap(null)
      avoidCircle = new sdk.maps.Circle({
        map,
        center: e.latLng,
        radius: 150,
        strokeColor: '#c62828',
        strokeWeight: 2,
        fillColor: '#c62828',
        fillOpacity: 0.15,
      })
      pickingAvoid.value = false
      editing.value = true
      routes.value = []
      clearDrawing()
    })
    resize = new ResizeObserver(() => {
      const center = map.getCenter()
      map.relayout()
      map.setCenter(center)
    })
    resize.observe(mapHost.value)
    draw()
  } catch (e) {
    mapError.value = (e as Error).message
  }
})
onBeforeUnmount(() => {
  disposeMapScroll?.()
  alive = false
  controller?.abort()
  resize?.disconnect()
  clearDrawing()
  avoidCircle?.setMap(null)
  events.forEach(({ event, handler }) => sdk.maps.event.removeListener(map, event, handler))
})
</script>
<template>
  <div class="wire-page mobile-page page-customer-app-7 navigation-page"
    ><div class="ph"
      ><header class="ah"
        ><span>길찾기</span
        ><NotificationBell /><button
          type="button"
          class="ui-icon-button theme-toggle"
          aria-label="라이트·다크 전환"
          @click="store.themeToggle()"
          >
          <UiIcon name="theme" />
        </button
        ></header
      ><main class="bd directions-body navigation-body">
        <div class="directions-map-wrap"
          ><div ref="mapHost" class="directions-map" aria-label="카카오 자동차 길찾기 지도"></div
          ><div class="directions-map-zoom"
            ><button class="ui-icon-button" aria-label="지도 확대" @click="map?.setLevel(Math.max(1,map.getLevel()-1))"
              >
          <UiIcon name="plus" />
        </button
            ><button class="ui-icon-button" aria-label="지도 축소" @click="map?.setLevel(Math.min(14,map.getLevel()+1))"
              >
          <UiIcon name="minus" />
        </button
            ><button class="ui-icon-button"
              v-if="requested"
              aria-label="현재 위치 따라가기"
              :aria-pressed="following"
              @click="recenter"
              >
          <UiIcon name="location" />
        </button
            ></div
          ></div
        >
<section v-if="editing" class="navigation-search" aria-label="경로 검색"
          ><form class="directions-form" @submit.prevent="search"
            ><div class="navigation-search-title"
              ><strong>어디로 갈까요?</strong
              ><button class="ui-icon-button" v-if="active" type="button" aria-label="검색창 닫기" @click="editing=false"
                >
          <UiIcon name="close" />
        </button
              ></div
            ><label
              >출발지<div
                ><input
                  :disabled="busy"
                  v-model="originText"
                  @input="origin=null"
                  placeholder="출발 장소"
                  required
                /><button :disabled="busy" type="button" @click="searchPlace('origin')">검색</button
                ><button :disabled="busy" type="button" @click="locate">내 위치</button></div
              ></label
            ><label
              >도착지<div
                ><input
                  :disabled="busy"
                  v-model="destinationText"
                  @input="destination=null"
                  placeholder="도착 장소"
                  required
                /><button :disabled="busy" type="button" @click="searchPlace('destination')"
                  >검색</button
                ></div
              ></label
            ><button class="btn p" :disabled="busy">{{busy?'경로 조회 중…':'길찾기'}}</button></form
          ><ul v-if="choices.length" class="directions-place-results"
            ><li v-for="place in choices" :key="place.id"
              ><button @click="pickPlace(place)"
                ><b>{{place.name}}</b
                ><small>{{place.address}}</small></button
              ></li
            ></ul
          ><div class="directions-avoid"
            ><button
              type="button"
              :aria-pressed="pickingAvoid"
              @click="pickingAvoid=!pickingAvoid;editing=!pickingAvoid"
              >{{pickingAvoid?'지도에서 피할 지점을 누르세요':'회피 지점 지정'}}</button
            ><button v-if="avoid" type="button" @click="clearAvoid">회피 해제</button
            ><small v-if="avoid">지정한 지점 반경 150m를 피합니다.</small></div
          ><p v-if="error" class="directions-error" role="alert">{{error}}</p></section
        >
<button
          v-else-if="!requested&&!arrived"
          type="button"
          class="navigation-trip"
          @click="editRoute"
          ><span>{{origin?.name}} → {{destination?.name}}</span
          ><small>경로 변경</small></button
        >
<section
          v-if="requested||arrived"
          class="navigation-guidance"
          aria-label="현재 주행 안내"
          aria-live="polite"
          ><span class="navigation-turn" aria-hidden="true">{{arrived?'✓':turnIcon}}</span
          ><div
            ><b
              >{{arrived?'목적지에 도착했습니다':!position?'현재 위치 확인 중…':offRoute?'경로를 벗어났습니다':formatDistance(nextDistance)}}</b
            ><p
              >{{arrived?destination?.name:!position?'GPS 위치를 기다리고 있습니다.':offRoute?'현재 위치에서 경로를 다시 조회하세요.':currentGuide?.guidance||'목적지 방향으로 이동하세요.'}}</p
            ><small v-if="position&&!arrived"
              >{{currentGuide?.name}} · 위치 정확도 {{Math.round(position.accuracy)}} m</small
            ></div
          ></section
        >
<p v-if="mapError" class="navigation-map-error" role="status">{{mapError}}</p
        ><div v-if="pickingAvoid" class="navigation-pick-note" role="status"
          >지도에서 피할 지점을 선택해 주세요.<button
            type="button"
            @click="pickingAvoid=false;editing=true"
            >취소</button
          ></div
        ><p v-if="gpsError" class="navigation-gps-error" role="alert">{{gpsError}}</p>
<section v-if="active" class="navigation-summary directions-results" aria-label="경로 결과"
          ><div v-if="!requested&&!arrived" class="navigation-route-options"
            ><button
              v-for="(route,index) in routes"
              :key="index"
              type="button"
              :aria-pressed="selected===index"
              @click="chooseRoute(index)"
              ><b>{{index===0?'추천':'대안'}} {{Math.ceil(route.summary.duration/60)}}분</b
              ><span
                >{{formatDistance(route.summary.distance)}} · 통행료 {{route.summary.fare?.toll?.toLocaleString()??'—'}}원</span
              ></button
            ></div
          ><div class="navigation-arrival"
            ><div
              ><strong>{{remainingMinutes}}<small>분</small></strong
              ><span>{{formatDistance(remainingDistance)}} · {{arrivalTime}} 도착 예상</span></div
            ><button
              v-if="!requested"
              type="button"
              class="navigation-start"
              @click="startNavigation"
              >{{arrived?'다시 안내':'안내 시작'}}</button
            ><button v-else type="button" class="navigation-stop" @click="stopNavigation()"
              >안내 종료</button
            ></div
          ><div v-if="requested" class="navigation-driving-tools"
            ><button
              type="button"
              :disabled="!speechSupported"
              :aria-pressed="voice"
              @click="voice=!voice"
              >음성 안내 {{voice?'켜짐':'꺼짐'}}</button
            ><button v-if="offRoute" type="button" @click="reroute">경로 다시 찾기</button></div
          ><nav class="navigation-quick-actions" aria-label="경로 상세 메뉴"
            ><button type="button" @click="guideDialog?.showModal()"
              >구간 안내 <small>{{guides.length}}</small></button
            ><button type="button" @click="openCameras"
              >주변 CCTV <small>{{cameras.length}}</small></button
            ><button type="button" @click="infoDialog?.showModal()">도착지 날씨</button></nav
          ><p class="directions-source">카카오모빌리티 · 조회 시점 기준 예상 소요 시간</p></section
        > </main
      ><CustomerAppNav />
<dialog ref="guideDialog" class="navigation-detail-dialog" aria-labelledby="route-guide-title"
        ><header
          ><div
            ><small>{{origin?.name}} → {{destination?.name}}</small
            ><h2 id="route-guide-title">구간별 안내</h2></div
          ><button class="ui-icon-button" type="button" aria-label="구간 안내 닫기" @click="guideDialog?.close()"
            >
          <UiIcon name="close" />
        </button
          ></header
        ><div class="navigation-detail-content"
          ><ol class="navigation-guide-list"
            ><li
              v-for="(guide,index) in guides"
              :key="index"
              :class="{'is-current':navigating&&guideIndex===index}"
              ><button type="button" @click="chooseGuide(guide)"
                ><span>{{index+1}}</span
                ><div
                  ><b>{{guide.guidance}}</b
                  ><small
                    >{{guide.distance>0?formatDistance(guide.distance)+' 이동 후 · ':''
                    }}{{guide.name}}</small
                  ></div
                ><span aria-hidden="true">›</span></button
              ></li
            ></ol
          ><p v-if="!guides.length">제공된 구간 안내가 없습니다.</p></div
        ></dialog
      >
<dialog
        ref="cameraDialog"
        class="navigation-detail-dialog"
        aria-labelledby="route-cctv-title"
        @close="camera=null"
        ><header
          ><div
            ><small>{{destination?.name}} 인근</small
            ><h2 id="route-cctv-title">주변 도로 CCTV</h2></div
          ><button class="ui-icon-button" type="button" aria-label="CCTV 창 닫기" @click="closeCameras">
          <UiIcon name="close" />
        </button></header
        ><div class="navigation-detail-content"
          ><template v-if="!camera"
            ><p class="directions-source"
              >주변 도로 영상이며 지하차도 내부 영상과 다를 수 있습니다.</p
            ><input
              v-model="cameraQuery"
              class="navigation-camera-search"
              type="search"
              placeholder="CCTV 이름 검색"
              aria-label="CCTV 이름 검색"
            /><p v-if="infoLoading" role="status">CCTV 목록을 불러오는 중입니다.</p
            ><div v-else-if="cameraError" role="alert"
              ><p>{{cameraError}}</p
              ><button type="button" @click="retryInfo">다시 불러오기</button></div
            ><ul v-else class="directions-camera-list"
              ><li v-for="item in filteredCameras" :key="item.name+item.url"
                ><button type="button" @click="camera=item"
                  ><span>{{item.name}}</span
                  ><span aria-hidden="true">›</span></button
                ></li
              ></ul
            ><p
              v-if="!infoLoading&&!cameraError&&!filteredCameras.length"
              >{{cameraQuery?'검색한 CCTV가 없습니다.':'인근에 제공되는 CCTV가 없습니다.'}}</p
            ></template
          ><section v-else class="directions-camera-player"
            ><button type="button" class="navigation-camera-back" @click="camera=null"
              >‹ CCTV 목록으로</button
            ><h3>{{camera.name}}</h3
            ><TrafficVideo :src="camera.url" hls /><a
              :href="camera.url"
              target="_blank"
              rel="noopener noreferrer"
              >영상 주소 열기 ↗</a
            ></section
          ></div
        ></dialog
      >
<dialog
        ref="infoDialog"
        class="navigation-detail-dialog"
        aria-labelledby="route-weather-title"
        ><header
          ><div
            ><small>{{destination?.name}} 인근</small
            ><h2 id="route-weather-title">도착지 날씨</h2></div
          ><button class="ui-icon-button" type="button" aria-label="날씨 창 닫기" @click="infoDialog?.close()"
            >
          <UiIcon name="close" />
        </button
          ></header
        ><div class="navigation-detail-content"
          ><p v-if="infoLoading" role="status">날씨 조회 중…</p
          ><div v-else-if="weatherError" role="alert"
            ><p>{{weatherError}}</p
            ><button type="button" @click="retryInfo">다시 불러오기</button></div
          ><div v-else-if="weather" class="directions-weather"
            ><b>{{weather.condition}} · {{weather.temperature??'—'}}°C</b
            ><span>습도 {{weather.humidity??'—'}}% · 강우량 {{weather.rainfall??'—'}} mm</span
            ><small>기상청 · {{new Date(weather.observedAt).toLocaleString('ko-KR')}}</small></div
          ></div
        ></dialog
      >
    </div></div
  >
</template>
