<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useApp } from '../stores/app'
import MapWeatherWidget from './MapWeatherWidget.vue'
import DashboardWidgets from './DashboardWidgets.vue'
import DashboardOcr from './DashboardOcr.vue'
import DashboardFacilityWidget from './DashboardFacilityWidget.vue'
import JurisdictionContactList from './JurisdictionContactList.vue'
import { shortcutGroups, useDashboardShortcuts } from '../stores/dashboardShortcuts'
const props = defineProps<{ grid?: HTMLElement; margins?: {underpassId:number;underpassName:string;riskScore:number;margin:number}[] }>()
const app = useApp()
const shortcuts=useDashboardShortcuts(), libraryTab=ref<'widgets'|'shortcuts'>('widgets')
const catalog = [
  { id:'ocr', name:'OCR', path:'/admin-data/ocr' },
  { id:'weather', name:'날씨' },
  { id:'risk', name:'위험 추이' },
  { id:'summary', name:'현황', existing:true },
  { id:'map', name:'지도', existing:true },
  { id:'events', name:'이벤트 타임라인', existing:true },
  { id:'detail', name:'상세페이지', path:'/fac-detail' },
  { id:'todo', name:'예지보전', existing:true },
  { id:'top5', name:'예지보전 Top5', existing:true },
  { id:'risk-top5', name:'위험 임박 Top5' },
  { id:'calendar', name:'캘린더' },
  { id:'contacts', name:'비상연락망', path:'/jurisdiction-contacts' },
]
const descriptions:Record<string,string> = {
  ocr:'번호판 인식 현황과 기록', weather:'현재 기온과 날씨 정보', risk:'시설 위험도 변화 추이',
  summary:'주요 운영 수치 요약', map:'시설 위치와 실시간 상태', events:'최근 발생 이벤트',
  detail:'선택 시설의 상세 정보', todo:'설비 점검과 유지보수', calendar:'일정과 작업 관리', contacts:'관할 담당자 연락처',
  top5:'예지보전 점검 우선순위 상위 설비', 'risk-top5':'위험 임계치에 가까운 지하차도 5곳',
}
function enabled(id:string) {
  return !layout.value.hidden.includes(id) && (existingIds.includes(id) || layout.value.order.includes(id))
}
function trackCount() { return 1000 }
type Layout = { version:2; order:string[]; hidden:string[]; sizes:Record<string,{width:number;height:number}> }
const blank = ():Layout => ({version:2,order:[],hidden:[],sizes:{}})
const layout = ref<Layout>(blank()), editing = ref(false), opened = ref(false), error = ref('')
const customized = ref(false)
const extras = computed(() => catalog.filter(item => !item.existing && layout.value.order.includes(item.id) && !layout.value.hidden.includes(item.id)))
const storageKey = computed(() => `routel-dashboard-board-v1:${app.account?.role || 'guest'}:${app.account?.id || 'guest'}`)
let snapshot = '', dragId = '', cleanup: (()=>void)[] = []
const existingIds = ['summary','map','events','top5','todo','verify','health']
function nodes() { return Array.from(props.grid?.querySelectorAll<HTMLElement>('.dashboard-fixed-item') || []) }
function idFor(node:HTMLElement) { return existingIds.find(id=>node.classList.contains('fixed-'+id)) || node.dataset.widgetId || '' }
function save() {
  try { localStorage.setItem(storageKey.value,JSON.stringify(layout.value)); error.value='' }
  catch { error.value='위젯 배치를 저장하지 못했습니다.' }
}
function apply() {
  if(!props.grid)return
  props.grid.classList.toggle('board-customized', customized.value)
  props.grid.classList.toggle('board-editing', editing.value)
  for(const node of nodes()) {
    const id=idFor(node), size=layout.value.sizes[id]
    node.hidden=layout.value.hidden.includes(id)
    node.style.order=String(Math.max(0,layout.value.order.indexOf(id)))
    const height=size?.height || (id==='summary'?180:id==='map'?740:id==='events'?640:id==='weather'?320:320)
    const gridWidth=props.grid.clientWidth
    const minimum=Math.min(1000,Math.ceil(232/Math.max(1,gridWidth)*1000))
    const width=gridWidth<=600?1000:Math.max(minimum,Math.min(1000,size?.width || (id==='summary'?1000:id==='map'?750:id==='top5'?500:250)))
    node.style.gridColumn=customized.value ? `span ${width}` : ''
    node.style.gridRow=customized.value ? `span ${Math.ceil(height+16)}` : ''
    node.style.height=customized.value ? height+'px' : ''
    node.style.setProperty('--board-height',customized.value ? height+'px' : '')
  }
}
function customize() {
  if(!layout.value.order.length) layout.value.order=['summary','events','map','top5','todo','verify','health'].filter(id=>nodes().some(node=>idFor(node)===id))
  customized.value=true
}
function toggle(id:string) {
  customize()
  if(layout.value.order.includes(id) && !layout.value.hidden.includes(id)) layout.value.hidden.push(id)
  else { layout.value.hidden=layout.value.hidden.filter(value=>value!==id); if(!layout.value.order.includes(id))layout.value.order.push(id) }
}
function drag(event:DragEvent,id:string) { dragId=id;event.dataTransfer?.setData('text/routel-widget',id);if(event.dataTransfer)event.dataTransfer.effectAllowed='move' }
function drop(event:DragEvent) {
  const id=event.dataTransfer?.getData('text/routel-widget') || dragId
  if(![...existingIds,...catalog.map(item=>item.id)].includes(id))return
  event.preventDefault(); customize()
  const target=(event.target as Element).closest<HTMLElement>('.dashboard-fixed-item')
  const before=target?idFor(target):''
  if(before!==id) {
    const order=layout.value.order.filter(value=>value!==id), index=order.indexOf(before)
    order.splice(index<0?order.length:index,0,id);layout.value.order=order
  }
  layout.value.hidden=layout.value.hidden.filter(value=>value!==id);dragId=''
}
function begin() {snapshot=JSON.stringify({layout:layout.value,customized:customized.value});shortcuts.begin();editing.value=true;opened.value=true;apply()}
function finish() {if(!shortcuts.save())return;activeCleanup?.();editing.value=false;opened.value=false;save();apply()}
function cancel() {const old=JSON.parse(snapshot);layout.value=old.layout;customized.value=old.customized;shortcuts.cancel();finish()}
function reset() {layout.value=blank();customized.value=false;shortcuts.reset()}
watch(()=>shortcuts.requestEdit,()=>{if(!editing.value)begin();libraryTab.value='shortcuts';opened.value=true})
let activeCleanup:(()=>void)|undefined
function resize(event:PointerEvent,node:HTMLElement,side:string) {
  if(event.button!==0||!props.grid)return
  event.preventDefault();event.stopPropagation();customize();apply()
  const id=idFor(node), bounds=node.getBoundingClientRect(), startX=event.clientX,startY=event.clientY
  const gridStyle=getComputedStyle(props.grid), tracks=trackCount()
  const gap=Number.parseFloat(gridStyle.columnGap)||0
  const gridWidth=props.grid.clientWidth-(Number.parseFloat(gridStyle.paddingLeft)||0)-(Number.parseFloat(gridStyle.paddingRight)||0)
  const step=(gridWidth+gap)/tracks
  const move=(event:PointerEvent)=>{
    if(event.pointerId!==pointer)return
    const horizontal=side==='left'||side==='right'
    const width=Math.max(Math.min(tracks,Math.ceil(232/step)),Math.min(tracks,Math.round((bounds.width+12+gap+(event.clientX-startX)*(side==='left'?-1:1))/step)))
    const height=Math.max(160,Math.min(1800,Math.round(bounds.height+(event.clientY-startY)*(side==='top'?-1:1))))
    layout.value.sizes[id]={width:horizontal?width:Math.max(1,Math.round((bounds.width+12+gap)/step)),height:horizontal?bounds.height:height}
  }
  const pointer=event.pointerId
  const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);activeCleanup=undefined}
  activeCleanup?.();activeCleanup=stop
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop)
}
function wire() {
  for(const node of nodes()) {
    if(node.dataset.boardWired)continue
    node.dataset.boardWired='true'
    const id=idFor(node), title=node.querySelector<HTMLElement>('.wg-head,.map-top,.extra-widget-title')
    if(title) {
      title.draggable=true
      const start=(event:DragEvent)=>{if(!editing.value){event.preventDefault();return}drag(event,id)}
      title.addEventListener('dragstart',start);cleanup.push(()=>title.removeEventListener('dragstart',start))
    }
    for(const side of ['top','right','bottom','left']) {
      const handle=document.createElement('button');handle.type='button';handle.className=`board-resize board-resize-${side}`
      handle.setAttribute('aria-label',`${catalog.find(item=>item.id===id)?.name || id} ${ {top:'위',right:'오른쪽',bottom:'아래',left:'왼쪽'}[side]} 크기 조절`)
      handle.addEventListener('pointerdown',event=>resize(event,node,side))
      handle.addEventListener('keydown',event=>{
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return
        event.preventDefault();customize()
        apply()
        const tracks=trackCount()
        const gap=Number.parseFloat(getComputedStyle(props.grid!).columnGap)||0
        const step=(props.grid!.clientWidth+gap)/tracks
        const size=layout.value.sizes[id] || {width:Math.max(1,Math.round((node.getBoundingClientRect().width+12+gap)/step)),height:node.clientHeight}
        layout.value.sizes[id]={width:Math.max(Math.min(tracks,Math.ceil(232/step)),Math.min(tracks,size.width+(event.key==='ArrowRight'?10:event.key==='ArrowLeft'?-10:0))),height:Math.max(160,size.height+(event.key==='ArrowDown'?10:event.key==='ArrowUp'?-10:0))}
      })
      node.append(handle);cleanup.push(()=>handle.remove())
    }
  }
  apply()
}
watch(storageKey,()=>{
  activeCleanup?.();editing.value=false;opened.value=false;layout.value=blank();customized.value=false
  shortcuts.editing=false
  try {const saved=JSON.parse(localStorage.getItem(storageKey.value)||'null');if(saved&&Array.isArray(saved.order)&&Array.isArray(saved.hidden)&&saved.sizes&&typeof saved.sizes==='object') {
    if(saved.version!==2) {
      for(const size of Object.values(saved.sizes) as {width:number;height:number}[]) size.width=Math.min(1000,size.width*250)
      saved.version=2
    }
    layout.value=saved;customized.value=saved.order.length>0
  }}
  catch {error.value='저장된 배치를 불러오지 못했습니다.'}
  void nextTick(wire)
},{immediate:true})
watch(()=>props.grid,(grid,old)=>{
  old?.removeEventListener('drop',drop)
  if(grid){grid.addEventListener('drop',drop);grid.addEventListener('dragover',over);cleanup.push(()=>{grid.removeEventListener('drop',drop);grid.removeEventListener('dragover',over)})}
  void nextTick(wire)
})
function over(event:DragEvent) {if(editing.value)event.preventDefault()}
watch([layout,editing],()=>void nextTick(wire),{deep:true})
onMounted(()=>window.addEventListener('resize',apply))
onBeforeUnmount(()=>{if(shortcuts.editing)shortcuts.cancel();window.removeEventListener('resize',apply);activeCleanup?.();cleanup.forEach(dispose=>dispose())})
</script>
<template>
  <div class="board-toolbar" :class="{'is-editing':editing}">
    <button type="button" @click="editing?opened=!opened:begin()">화면편집</button>
    <template v-if="editing"><span>제목을 끌어 이동 · 위·아래·왼쪽·오른쪽 테두리로 크기 조절</span><button @click="reset">기본 구성</button><button @click="cancel">취소</button><button @click="finish">저장</button></template>
    <p v-if="error" role="alert">{{error}}</p>
  </div>
  <Teleport to="body">
    <aside v-if="opened" class="board-library" aria-label="위젯 리스트">
      <header><div><strong>화면 구성</strong><small>필요한 위젯과 바로가기를 선택하세요</small></div><button aria-label="위젯 리스트 닫기" @click="opened=false">×</button></header>
      <nav class="board-library-tabs" aria-label="편집 종류">
        <button type="button" :aria-pressed="libraryTab==='widgets'" @click="libraryTab='widgets'">위젯</button>
        <button type="button" :aria-pressed="libraryTab==='shortcuts'" @click="libraryTab='shortcuts'">바로가기</button>
      </nav>
      <template v-if="libraryTab==='widgets'">
        <p class="board-library-description">선택한 위젯은 대시보드에 표시됩니다. 끌어서 배치할 수도 있어요.</p>
        <div v-for="item in catalog" :key="item.id" class="board-library-row" draggable="true" @dragstart="drag($event,item.id)">
          <button :aria-pressed="enabled(item.id)" @click="toggle(item.id)"><span class="board-library-symbol" aria-hidden="true">▦</span><span class="board-library-copy"><strong>{{item.name}}</strong><small>{{descriptions[item.id]}}</small></span><span class="board-library-check" aria-hidden="true">{{enabled(item.id)?'✓':''}}</span></button>
        </div>
      </template>
      <template v-else>
        <p class="board-library-description">상단에 표시할 메뉴를 선택하세요. 바로가기 카드의 화살표나 끌기로 순서를 바꿀 수 있어요.</p>
        <section v-for="group in shortcutGroups" :key="group.title" class="board-shortcut-group">
          <h3>{{group.title}}</h3>
          <div v-for="item in group.items" :key="item.to" class="board-library-row">
            <button type="button" :aria-pressed="shortcuts.order.includes(item.to)" @click="shortcuts.toggle(item.to)">
              <span class="board-library-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path :d="item.icon" /></svg></span>
              <span class="board-library-copy"><strong>{{item.label}}</strong></span>
              <span class="board-library-check" aria-hidden="true">{{shortcuts.order.includes(item.to)?'✓':''}}</span>
            </button>
          </div>
        </section>
      </template>
      <p v-if="shortcuts.error" role="alert">{{shortcuts.error}}</p>
      <footer>{{libraryTab==='widgets'?catalog.filter(item=>enabled(item.id)).length:shortcuts.items.length}}개 선택됨 · 상단의 저장을 누르면 적용됩니다</footer>
    </aside>
  </Teleport>
  <Teleport v-if="grid" :to="grid">
    <article v-for="item in extras" :key="item.id" class="dashboard-fixed-item board-extra" :data-widget-id="item.id">
      <header class="extra-widget-title"><h2><RouterLink v-if="item.id==='ocr'" to="/admin-data/ocr">{{item.name}}</RouterLink><template v-else>{{item.name}}</template></h2></header>
      <MapWeatherWidget v-if="item.id==='weather'" />
      <DashboardWidgets v-else-if="item.id==='calendar'" :account-id="app.account?.id" :summary="null" :events="[]" :margins="[]" calendar-only />
      <DashboardOcr v-else-if="item.id==='ocr'" />
      <DashboardFacilityWidget v-else-if="item.id==='risk'||item.id==='detail'" :mode="item.id==='risk'?'risk':'detail'" />
      <JurisdictionContactList v-else-if="item.id==='contacts'" />
      <div v-else-if="item.id==='risk-top5'" class="board-risk-top5">
        <RouterLink to="/admin-reports?report=margin">전체 보기 →</RouterLink>
        <p v-if="!margins?.length">위험 임박 시설이 없습니다.</p>
        <ol v-else><li v-for="(facility,index) in margins.slice(0,5)" :key="facility.underpassId">
          <span class="board-risk-rank">{{index+1}}</span>
          <RouterLink :to="{path:'/fac-detail',query:{id:facility.underpassId}}">{{facility.underpassName}}<small>위험 임계치까지 {{facility.margin}}점</small></RouterLink>
          <strong>{{facility.riskScore}}</strong>
        </li></ol>
      </div>
      <RouterLink v-else :to="item.path!">{{item.name}} 열기 →</RouterLink>
    </article>
  </Teleport>
</template>
<style src="../styles/components/dashboard-editor.css"></style>
