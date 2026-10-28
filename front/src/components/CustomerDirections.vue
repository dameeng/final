<script setup lang="ts">
import { matchesKoreanSearch } from '../utils/korean-search'
import { useBackendEvents } from '../composables/useBackendEvents'
import CustomerMobileHeader from './CustomerMobileHeader.vue'
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
  type Place,
  type Route,
  type Point,
  type Guide,
  type SafetyRoute,
  safetyRouteCandidate,
  passesAvoidPoint,
} from '../services/navigation'
import { projectRoute, distanceMeters, formatDistance, routeTimeline } from '../utils/navigation-progress'
import '../styles/customer-app-7.css'
import '../styles/customer-directions.css'
const store = useApp(),
  mapHost = ref<HTMLElement>(),
  originText = ref('부산 동구청'),
  destinationText = ref('부산 오페라하우스'),
  origin = ref<Place | null>(null),
  destination = ref<Place | null>(null),
  choices = ref<Place[]>([]),
  choosing = ref<'origin' | 'destination'>('origin')
const routes = ref<Route[]>([]),
  selected = ref(0),
  busy = ref(false),
  error = ref(''),
  mapError = ref('')
const safety = ref<SafetyRoute|null>(null), safetyDialog = ref<HTMLDialogElement>()
const safetyUnavailable = computed(()=>!!safety.value?.mandatory&&!safety.value.detoured)
const rerouting=ref(false)
const demoIncident=ref(false)
const demoStartPending=ref(false)
let hazardTimer: ReturnType<typeof setTimeout>|undefined, prioritySpeechUntil = 0
function announce(message:string) {
  if (!speechSupported||!voice.value) return
  prioritySpeechUntil=Date.now()+4000
  speechSynthesis.cancel()
  const utterance=new SpeechSynthesisUtterance(message);utterance.lang='ko-KR';speechSynthesis.speak(utterance)
}
async function showSafety() { await nextTick(); if(alive&&!safetyDialog.value?.open)safetyDialog.value?.showModal() }
function acceptDetour() {
  const running=requested.value||demoStartPending.value
  if(safety.value?.suggestedDetour)chooseRoute(1)
  safetyDialog.value?.close()
  if(running&&!safetyUnavailable.value)startNavigation()
  demoStartPending.value=false
  announce('우회 경로로 안내합니다.')
}
function startSafeDetour(){
  if(!safety.value?.detoured||safetyUnavailable.value||!active.value)return
  safetyDialog.value?.close()
  startNavigation()
  demoStartPending.value=false
  announce('통제 구간을 피해 우회 경로로 안내합니다.')
}
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
  demoStartPending.value=false
  demoIncident.value=false
  stopNavigation()
  safety.value=null
  safetyDialog.value?.close()
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
    let candidates:Route[]
    if (store.account) {
      const assessed=await navigationRequest<SafetyRoute>('route',{origin:coord(from),destination:coord(to)},current.signal)
      if(!alive||current.signal.aborted)return
      safety.value=assessed
      if(assessed.mandatory&&!assessed.detoured){void showSafety();throw Error(assessed.message||'통제 지하차도를 피하는 경로를 찾지 못했습니다.')}
      candidates=[safetyRouteCandidate(assessed)]
      if(assessed.suggestedDetour)candidates.push(safetyRouteCandidate(assessed.suggestedDetour))
      if(assessed.mandatory||assessed.advisoryHazards?.length)void showSafety()
    } else candidates=await navigationRequest<Route[]>('directions',{origin:coord(from),destination:coord(to)},current.signal)
    if (!candidates.length) throw Error('이 구간에서 자동차 경로를 찾지 못했습니다.')
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
const searchExpanded = ref(true)
const summaryElement = ref<HTMLElement>()
let summaryResize: ResizeObserver | undefined
watch(summaryElement, (element) => {
  summaryResize?.disconnect()
  const update = () => mapHost.value?.closest<HTMLElement>('.navigation-body')?.style.setProperty(
    '--navigation-summary-height', `${element?.getBoundingClientRect().height || 0}px`,
  )
  if (element) {
    summaryResize = new ResizeObserver(update)
    summaryResize.observe(element)
  }
  update()
}, { flush: 'post' })
onBeforeUnmount(() => summaryResize?.disconnect())
const summaryExpanded = ref(true)
let summaryPointer: number | undefined, summaryStartY = 0, summaryDragged = false
function startSummarySwipe(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) return
  const interactive = (event.target as Element).closest('button,input,select,textarea,a')
  if (interactive && !interactive.classList.contains('navigation-summary-handle')) return
  summaryPointer = event.pointerId
  summaryStartY = event.clientY
  summaryDragged = false
  ;((interactive || event.currentTarget) as HTMLElement).setPointerCapture(event.pointerId)
}
function endSummarySwipe(event: PointerEvent) {
  if (summaryPointer !== event.pointerId) return
  const delta = event.clientY - summaryStartY
  if (Math.abs(delta) >= 30) {
    summaryExpanded.value = delta < 0
    summaryDragged = true
  }
  summaryPointer = undefined
  const panel = event.currentTarget as HTMLElement
  if (panel.hasPointerCapture(event.pointerId)) panel.releasePointerCapture(event.pointerId)
}
function toggleSummary() {
  if (summaryDragged) { summaryDragged = false; return }
  summaryExpanded.value = !summaryExpanded.value
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
const drivingMode = ref<'gps' | 'demo'>('gps'),
  demoSpeed = ref(4),
  demoPaused = ref(false),
  demoMeters = ref(0)
let demoFrame = 0, demoLastTime = 0
let watchId: number | undefined, userOverlay: any
const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const routePath = computed(() => (active.value ? routePoints(active.value) : []))
const timeline = computed(() => routeTimeline(routePath.value))
const progress = computed(() =>
  position.value
    ? drivingMode.value === 'demo'
      ? { total: timeline.value.total, progress: demoMeters.value, distance: 0,
          remaining: Math.max(0, timeline.value.total - demoMeters.value) }
      : projectRoute(routePath.value, position.value)
    : null,
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
  cameras.value.filter((item) => matchesKoreanSearch(item.name,cameraQuery.value)),
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
  cancelAnimationFrame(demoFrame)
  demoFrame = 0
  demoLastTime = 0
  demoPaused.value = false
  if (watchId !== undefined) navigator.geolocation.clearWatch(watchId)
  watchId = undefined
  requested.value = false
  userOverlay?.setMap(null)
  userOverlay = undefined
  if (speechSupported && voice.value) speechSynthesis.cancel()
  if (resetArrival) arrived.value = false
}
function updateDemoPosition() {
  const point = timeline.value.positionAt(demoMeters.value)
  if (!point) return
  position.value = { ...point, accuracy: 0, speed: (50 / 3.6) * demoSpeed.value }
  followPosition()
}
function demoTick(timestamp: number) {
  if (!alive || !requested.value || drivingMode.value !== 'demo' || demoPaused.value) return
  const elapsed = demoLastTime ? Math.min(0.25, (timestamp - demoLastTime) / 1000) : 0
  demoLastTime = timestamp
  demoMeters.value = Math.min(timeline.value.total, demoMeters.value + (50 / 3.6) * demoSpeed.value * elapsed)
  updateDemoPosition()
  if (demoMeters.value >= timeline.value.total) {
    arrived.value = true
    stopNavigation(false)
    return
  }
  demoFrame = requestAnimationFrame(demoTick)
}
function toggleDemoPause() {
  demoPaused.value = !demoPaused.value
  cancelAnimationFrame(demoFrame)
  demoLastTime = 0
  if (demoPaused.value) {
    if (speechSupported && voice.value) speechSynthesis.cancel()
  } else demoFrame = requestAnimationFrame(demoTick)
}
function changeDrivingMode() {
  const running = requested.value
  stopNavigation()
  position.value = null
  demoMeters.value = 0
  gpsError.value = ''
  if (running) startNavigation()
  else draw()
}
function previewRoute() {
  drivingMode.value = 'demo'
  startNavigation()
}
async function startDemoTrip() {
  if(busy.value)return
  drivingMode.value='demo'
  await search()
  demoStartPending.value=!!active.value
  if(active.value&&!safetyUnavailable.value&&!safetyDialog.value?.open){startNavigation();demoStartPending.value=false}
}
async function simulateClosure() {
  if(drivingMode.value!=='demo'||!requested.value||!position.value||!destination.value||busy.value)return
  const from={...position.value},to=destination.value
  const remaining=timeline.value.total-demoMeters.value
  if(remaining<300){gpsError.value='목적지에 가까워 통제 시연을 시작할 수 없어요. 시연을 다시 시작한 뒤 눌러 주세요.';return}
  const ahead=timeline.value.positionAt(demoMeters.value+Math.min(700,remaining/2))
  if(!ahead)return
  const wasPaused=demoPaused.value
  if(!demoPaused.value)toggleDemoPause()
  busy.value=true;error.value='';gpsError.value=''
  announce('시연 상황입니다. 전방 통제로 우회 경로를 찾습니다.')
  try {
    let candidate:Route|undefined
    const dx=ahead.lng-from.lng,dy=ahead.lat-from.lat,length=Math.hypot(dx,dy)||1
    for(const [north,east] of [[dx/length*.004,-dy/length*.004],[-dx/length*.004,dy/length*.004],[.008,0],[-.008,0],[0,.008],[0,-.008]]) {
      const waypoint={lat:ahead.lat+north!,lng:ahead.lng+east!}
      let options:Route[]
      try { options=await navigationRequest<Route[]>('directions',{origin:coord(from),destination:coord(to),waypoint:coord(waypoint)}) }
      catch {continue}
      if(!alive||drivingMode.value!=='demo')return
      candidate=options.find(row=>routePoints(row).length>1&&!passesAvoidPoint(row,ahead,60))
      if(candidate)break
    }
    if(!candidate)throw Error('이 위치에서는 시연 우회 경로를 찾지 못했어요. 기존 시연을 계속하며 잠시 뒤 다시 시도해 주세요.')
    stopNavigation()
    origin.value={...from,name:'시연 현재 위치'}
    originText.value=origin.value.name
    position.value=null
    routes.value=[candidate];selected.value=0
    demoIncident.value=true
    safety.value={distance:candidate.summary.distance,duration:candidate.summary.duration,path:routePoints(candidate).map(p=>[p.lat,p.lng]),guides:[],mandatory:true,detoured:true,blockedHazards:['전방 시연 구간'],advisoryHazards:[],passesHazards:[],message:'주행 중 통제가 발생한 시연 상황입니다. 실제 시설 통제에는 영향을 주지 않습니다.'}
    await nextTick();draw();void showSafety()
  } catch(e) {
    gpsError.value=(e as Error).message
    if(!wasPaused&&requested.value&&demoPaused.value)toggleDemoPause()
  }
  finally {busy.value=false}
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
    if (drivingMode.value === 'gps') map.setLevel(3)
    map.setCenter(point)
    // Keep the moving dot in the visible space between the guidance and bottom sheet.
    const host = mapHost.value?.getBoundingClientRect()
    const body = mapHost.value?.closest('.navigation-body')
    const guidance = body?.querySelector('.navigation-guidance')?.getBoundingClientRect()
    const summary = body?.querySelector('.navigation-summary')?.getBoundingClientRect()
    const projection = map.getProjection?.()
    if (host && projection?.coordsFromContainerPoint && sdk.maps.Point) {
      const top = Math.max(host.top, guidance?.bottom ?? host.top) + 20
      const bottom = Math.min(host.bottom, summary?.top ?? host.bottom) - 20
      if (bottom > top) {
        const targetY = (top + bottom) / 2 - host.top
        const center = projection.coordsFromContainerPoint(new sdk.maps.Point(host.width / 2, host.height - targetY))
        map.setCenter(center)
      }
    }
  }
}
function startNavigation() {
  if (!active.value || routePath.value.length < 2 || safetyUnavailable.value) return
  stopNavigation()
  gpsError.value = ''
  position.value = null
  following.value = true
  editing.value = false
  if (drivingMode.value === 'demo') {
    if (timeline.value.total <= 0) {
      gpsError.value = '시연할 수 있는 경로가 없습니다. 경로를 다시 조회해 주세요.'
      return
    }
    demoMeters.value = 0
    requested.value = true
    map?.setLevel(3)
    updateDemoPosition()
    demoFrame = requestAnimationFrame(demoTick)
    return
  }
  if (!navigator.geolocation) {
    gpsError.value = '현재 위치를 지원하지 않는 브라우저입니다.'
    return
  }
  requested.value = true
  watchId = navigator.geolocation.watchPosition(
    (fix) => {
      if (!alive || !requested.value || drivingMode.value !== 'gps') return
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
  map?.setLevel(3)
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
  searchExpanded.value = true
}
async function reroute() {
  if(rerouting.value)return
  rerouting.value=true
  const running=requested.value
  if (position.value) {
    origin.value = { name: '내 위치', lat: position.value.lat, lng: position.value.lng }
    originText.value = '내 위치'
  }
  try {
    const pending=search()
    announce('위험 정보를 반영해 경로를 재탐색합니다.')
    await pending
    if(running&&active.value&&!safetyUnavailable.value){startNavigation();announce('경로를 재탐색했습니다. 새 경로로 안내합니다.')}
  } finally {rerouting.value=false}
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
    demoPaused.value ||
    !voice.value ||
    !speechSupported ||
    !currentGuide.value ||
    offRoute.value
    || Date.now()<prioritySpeechUntil
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
useBackendEvents(({name,data})=>{
  if(!store.account||!active.value)return
  if(name!=='connected'&&name!=='control-change'&&!(name==='data-changed'&&data.resource==='navigation-hazard'))return
  clearTimeout(hazardTimer)
  hazardTimer=setTimeout(()=>{if(alive&&!busy.value)void reroute()},400)
})
watch(offRoute,(outside)=>{if(outside&&requested.value)announce('경로를 벗어났습니다. 경로 다시 찾기를 눌러 재탐색해 주세요.')})
onBeforeUnmount(() => {
  clearTimeout(hazardTimer)
  safetyDialog.value?.close()
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
    disposeMapScroll = pageFriendlyMapScroll(mapHost.value, map, true)
    map.setCursor('grab')
    listen('dragstart', () => {
      map.setCursor('grabbing')
      if (requested.value) following.value = false
    })
    listen('dragend', () => {
      map.setCursor('grab')
      if (requested.value) { following.value = true; followPosition() }
    })
    resize = new ResizeObserver(() => {
      const center = map.getCenter()
      map.relayout()
      map.setCenter(center)
      if (requested.value) followPosition()
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
  events.forEach(({ event, handler }) => sdk.maps.event.removeListener(map, event, handler))
})
</script>
<template>
  <div class="wire-page mobile-page page-customer-app-7 navigation-page"
    ><div class="ph"
      ><CustomerMobileHeader title="길찾기" />
      <main class="bd directions-body navigation-body">
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
          ><div class="navigation-search-title"
              ><button type="button" class="navigation-search-toggle" :aria-expanded="searchExpanded" aria-controls="navigation-search-fields" @click="searchExpanded=!searchExpanded">
                <strong>어디로 갈까요?</strong><svg class="navigation-search-chevron" :class="{'is-expanded':searchExpanded}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              <button class="ui-icon-button" v-if="active" type="button" aria-label="검색창 닫기" @click="editing=false"
                >
          <UiIcon name="close" />
        </button
              ></div
          ><div id="navigation-search-fields" v-show="searchExpanded">
          <form class="directions-form" @submit.prevent="search"
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
            ><button class="btn p" :disabled="busy">{{busy?'경로 조회 중…':'길찾기'}}</button><button type="button" class="btn navigation-demo-start" :disabled="busy" @click="startDemoTrip">시연 바로 시작</button></form
          ><ul v-if="choices.length" class="directions-place-results"
            ><li v-for="place in choices" :key="place.id"
              ><button @click="pickPlace(place)"
                ><b>{{place.name}}</b
                ><small>{{place.address}}</small></button
              ></li
            ></ul
          ><p v-if="error" class="directions-error" role="alert">{{error}}</p></div></section
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
              >{{currentGuide?.name}} · {{drivingMode==='demo' ? `시연 ${demoSpeed}배속${demoPaused?' · 일시정지':''}` : `위치 정확도 ${Math.round(position.accuracy)} m`}}</small
            ></div
          ></section
        >
<p v-if="rerouting" class="navigation-reroute-notice" role="status"><UiIcon name="refresh" />통제·위험 정보를 반영해 경로를 다시 찾고 있어요.</p>
<p v-if="mapError" class="navigation-map-error" role="status">{{mapError}}</p
        ><p v-if="gpsError" class="navigation-gps-error" role="alert">{{gpsError}}</p>
<section ref="summaryElement" v-if="active" class="navigation-summary directions-results" :class="{'summary-collapsed':!summaryExpanded}" aria-label="경로 결과"
          @pointerdown="startSummarySwipe" @pointerup="endSummarySwipe" @pointercancel="summaryPointer=undefined"
          ><button type="button" class="navigation-summary-handle" :aria-expanded="summaryExpanded" aria-label="주행 패널 접기·펼치기" @click="toggleSummary">
            <span aria-hidden="true"></span><small>{{summaryExpanded?'아래로 밀어 접기':'위로 밀어 펼치기'}}</small>
          </button><div v-if="safety?.mandatory&&safety.detoured" class="navigation-detour-banner"><UiIcon name="route" /><div><strong>통제 구간을 피한 우회 경로</strong><small v-if="safety.blockedHazards?.length">{{safety.blockedHazards.join(' · ')}}</small></div><button type="button" @click="showSafety">안내 보기</button></div><div class="navigation-demo-controls">
            <label>주행 방식
              <select v-model="drivingMode" @change="changeDrivingMode">
                <option value="gps">실제 GPS 안내</option>
                <option value="demo">시연 주행</option>
              </select>
            </label>
            <template v-if="drivingMode==='demo'">
              <label>시연 배속
                <select v-model.number="demoSpeed" aria-label="시연 배속">
                  <option v-for="speed in [1,2,4,8,16]" :key="speed" :value="speed">{{speed}}배속</option>
                </select>
              </label>
              <div v-if="requested" class="navigation-demo-actions"><button type="button" @click="toggleDemoPause">{{demoPaused?'시연 재개':'일시정지'}}</button>
              <button type="button" :disabled="busy" @click="simulateClosure">{{busy?'우회 경로 조회 중…':'주행 중 통제 발생'}}</button></div>
              <small v-if="demoIncident">통제 상황 시연 · 실제 시설 상태 유지</small>
              <small>가상 위치 · 1배속 기준 시속 50km</small>
            </template>
          </div><div v-if="!requested&&!arrived" class="navigation-route-options"
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
            ><button v-if="offRoute" type="button" @click="reroute">경로 다시 찾기</button><button v-if="offRoute&&drivingMode==='gps'" type="button" @click="previewRoute">시연으로 경로 확인</button></div
          ><nav class="navigation-quick-actions" aria-label="경로 상세 메뉴"
            ><button type="button" @click="guideDialog?.showModal()"
              >구간 안내 <small>{{guides.length}}</small></button
            ><button type="button" @click="openCameras"
              >주변 CCTV <small>{{cameras.length}}</small></button
            ><button type="button" @click="infoDialog?.showModal()">도착지 날씨</button></nav
          ></section
        > </main
      ><CustomerAppNav />
<WorkflowPage ref="guideDialog" class="navigation-detail-dialog" aria-labelledby="route-guide-title"
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
        ></WorkflowPage
      >
<WorkflowPage
        ref="cameraDialog"
        class="navigation-detail-dialog"
        :class="{'navigation-video-dialog':camera!==null}"
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
        ></WorkflowPage
      >
<WorkflowPage
        ref="infoDialog"
        class="navigation-detail-dialog navigation-weather-dialog"
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
        ></WorkflowPage
      >
    <Teleport to="body"><dialog ref="safetyDialog" class="navigation-safety-dialog" :data-blocked="safety?.mandatory" aria-labelledby="navigation-safety-title">
      <template v-if="safety">
        <header><span>{{safety.mandatory?'통제 지하차도 안내':'지하차도 위험 안내'}}</span><button type="button" aria-label="우회 안내 닫기" @click="safetyDialog?.close()">×</button></header>
        <div>
          <h2 id="navigation-safety-title">{{safetyUnavailable?'안전한 우회 경로를 찾지 못했습니다':safety.mandatory?'통제 구간을 피하는 경로입니다':'우회 경로로 이동하시겠습니까?'}}</h2>
          <p v-if="safety.mandatory" class="navigation-blocked-instruction"><strong>{{safety.blockedHazards?.length?safety.blockedHazards.join(' · '):'경로상의 지하차도'}} 통제 중</strong><span>해당 지하차도에 진입하지 말고 우회해 주세요.</span></p>
          <p>{{safety.message}}</p>
          <p v-if="safetyUnavailable" class="navigation-unavailable-help">기존 경로로 안내를 시작할 수 없습니다. 안전한 곳에서 경로를 다시 확인하고 현장 통제 안내를 따라 주세요.</p>
          <p v-if="safety.suggestedDetour">우회 시 약 {{Math.ceil(safety.suggestedDetour.extraSec/60)}}분 추가 소요</p>
        </div>
        <footer>
          <template v-if="safety.mandatory">
            <button v-if="safetyUnavailable" type="button" @click="safetyDialog?.close()">닫기</button>
            <button v-if="safetyUnavailable" type="button" class="primary" :disabled="busy" @click="reroute">경로 다시 찾기</button>
            <button v-else type="button" class="primary" :disabled="busy||!active" @click="startSafeDetour">우회 경로로 안내 시작</button>
          </template>
          <template v-else>
            <button v-if="safety.suggestedDetour" type="button" @click="safetyDialog?.close()">기존 경로 유지</button>
            <button v-if="safety.suggestedDetour" type="button" class="primary" @click="acceptDetour">우회 경로 선택</button>
            <button v-else type="button" class="primary" @click="safetyDialog?.close()">확인</button>
          </template>
        </footer>
      </template>
    </dialog></Teleport>
    </div></div
  >
</template>
<style scoped>
.navigation-safety-dialog[data-blocked=true]{border-color:#354b62;background:#19293b;color:#e6eef8;}
.navigation-safety-dialog[data-blocked=true] header{background:#22364c;color:#ff9aa8;border-bottom:1px solid #354b62;}
.navigation-safety-dialog[data-blocked=true] h2{color:#e6eef8;}
.navigation-safety-dialog[data-blocked=true] p{color:#adbed2;}
.navigation-safety-dialog[data-blocked=true] .navigation-blocked-instruction{background:#3b303e;color:#f0c5cc;border:1px solid #65434f;}
.navigation-safety-dialog[data-blocked=true] .navigation-unavailable-help{background:#22364c;color:#adbed2;}
.navigation-blocked-instruction{display:grid;gap:6px;padding:14px;border-radius:10px;background:var(--status-danger-bg,#fde3e9);color:var(--status-danger-ink,#a32446);}
.navigation-blocked-instruction strong{font-size:15px;line-height:23px;}.navigation-blocked-instruction span{font-size:13px;line-height:22px;}
.navigation-unavailable-help{padding:12px;border-radius:9px;background:var(--r-soft);font-size:13px!important;color:var(--r-muted);}
.navigation-reroute-notice{position:absolute;top:12px;left:12px;right:12px;z-index:35;display:flex;align-items:center;gap:10px;margin:0;padding:14px;border:1px solid var(--r-accent);border-radius:12px;background:var(--r-surface);color:var(--r-accent);font-size:13px;line-height:22px;box-shadow:var(--r-overlay-shadow);}
.navigation-reroute-notice .ui-icon{width:20px;height:20px;flex:none;}
.navigation-detour-banner{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:12px;border:1px solid var(--r-line);border-radius:10px;background:var(--r-selected);color:var(--r-accent);}
.navigation-detour-banner>.ui-icon{width:22px;height:22px;flex:none;}.navigation-detour-banner>div{flex:1;min-width:0;}
.navigation-detour-banner strong{font-size:13px;line-height:21px;}.navigation-detour-banner small{display:block;margin-top:3px;font-size:11px;line-height:18px;overflow-wrap:anywhere;}
.navigation-detour-banner>button{flex:none;padding:6px 8px;min-height:36px;border:1px solid var(--r-line);border-radius:8px;background:var(--r-surface);color:var(--r-accent);font-size:12px;}
.navigation-safety-dialog { box-sizing:border-box; width:min(420px,calc(100% - 32px)); max-height:calc(100dvh - 40px); padding:0; border:1px solid var(--status-caution-ink,#865000); border-radius:16px; background:var(--r-surface,#fff); color:var(--r-ink,#172d48); box-shadow:0 20px 70px #0004; } .navigation-safety-dialog::backdrop { background:#10203999; } .navigation-safety-dialog header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; background:var(--status-caution-bg,#fff1d6); font-weight:700; } .navigation-safety-dialog header button { border:0; background:transparent; color:inherit; font-size:24px; min-width:36px; min-height:36px; } .navigation-safety-dialog>div { padding:20px; } .navigation-safety-dialog h2 { margin:0 0 12px; font-size:20px; line-height:1.5; } .navigation-safety-dialog p { font-size:14px; line-height:1.8; overflow-wrap:anywhere; } .navigation-safety-dialog footer { display:flex; gap:8px; padding:0 20px 20px; } .navigation-safety-dialog footer button { flex:1; min-height:44px; padding:10px; border:1px solid var(--r-line,#dbe3ed); border-radius:9px; background:var(--r-surface,#fff); color:inherit; } .navigation-safety-dialog .primary { background:var(--r-accent,#225bb5); color:#fff; }
</style>
