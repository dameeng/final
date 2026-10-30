<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { displayDate } from '../utils/display-date'
import { dashboardEventTarget } from '../utils/dashboard-event-target'
import { valueLabels } from '../data/backendResources'
import { useNewItemGlow } from '../composables/useNewItemGlow'
const props = defineProps<{ accountId?: string; summary: Record<string,number> | null; events: any[]; margins: any[]; calendarOnly?: boolean }>()
const eventKey=(event:Record<string,any>)=>String(event.id??JSON.stringify([event.createdAt,event.underpassId,event.eventType,event.reason]))
const isNewEvent=useNewItemGlow(()=>props.events,eventKey)
const catalog = [
  {id:'status',name:'지하차도 현황',description:'담당 시설·통제·위험·판별 대기·잔류 차량을 확인합니다.'},
  {id:'events',name:'최근 이벤트',description:'수신된 최근 이벤트를 확인합니다.'},
  {id:'risk',name:'위험 임박 Top5',description:'위험 임계치에 가까운 시설을 확인합니다.'},
  {id:'maintenance',name:'예지보전',description:'설비와 점검 대상을 확인합니다.'},
  {id:'review',name:'수동 판별 대기',description:'판별 대기 건수를 확인하고 처리합니다.'},
  {id:'alerts',name:'오늘 알림',description:'오늘 발송된 알림을 확인합니다.'},
  {id:'calendar',name:'캘린더·일정',description:'날짜별 점검·회의 일정을 기록합니다.'},
  {id:'checklist',name:'업무 체크리스트',description:'오늘 처리할 업무를 추가하고 완료를 표시합니다.'},
  {id:'memo',name:'업무 메모',description:'인계 사항과 확인할 내용을 적어 둡니다.'},
  {id:'shortcuts',name:'업무 바로가기',description:'시설·판별·알림·보고서로 빠르게 이동합니다.'},
]
const defaults=props.calendarOnly?['calendar']:['status','events','risk','maintenance','review','alerts','calendar','shortcuts']
const sizeOptions=[{id:'compact',name:'작은형 · 1칸',height:200},{id:'standard',name:'기본형 · 1칸',height:360},{id:'wide',name:'가로형 · 2칸',height:280},{id:'tall',name:'세로형 · 1칸',height:560},{id:'large',name:'큰형 · 2칸',height:560},{id:'full',name:'전체 너비',height:200}]
const sizes=ref<Record<string,string>>({})
type Span={columns:number;rows:number}
const spans=ref<Record<string,Span>>({}),grid=ref<HTMLElement>(),columns=ref(4),resizing=ref('')
const fixedMap=ref<HTMLElement>(),mapRows=ref(8)
let originalSpans:Record<string,Span>={}
const spanKey=computed(()=>`routel-dashboard-${props.calendarOnly?'calendar-':''}spans-v1:${props.accountId || 'guest'}`)
function spanFor(id:string):Span{
  const name=widgetSize(id).id
  const preset:Record<string,Span>={compact:{columns:1,rows:2},standard:{columns:1,rows:4},wide:{columns:2,rows:3},tall:{columns:1,rows:7},large:{columns:2,rows:7},full:{columns:columns.value,rows:2}}
  const span=spans.value[id]||preset[name]!
  return {columns:Math.min(columns.value,span.columns),rows:span.rows}
}
function spanStyle(id:string){const span=spanFor(id);return {gridColumn:`span ${span.columns}`,gridRow:`span ${span.rows}`}}
function selectSize(id:string,event:Event){sizes.value[id]=(event.target as HTMLSelectElement).value;const next={...spans.value};delete next[id];spans.value=next}
let observer:ResizeObserver|undefined
onMounted(()=>{observer=new ResizeObserver(()=>{if(grid.value)columns.value=getComputedStyle(grid.value).gridTemplateColumns.split(' ').filter(Boolean).length;if(fixedMap.value)mapRows.value=Math.ceil((fixedMap.value.getBoundingClientRect().height+16)/80)});if(grid.value)observer.observe(grid.value);if(fixedMap.value)observer.observe(fixedMap.value)})
onBeforeUnmount(()=>observer?.disconnect())
let resizeState:{id:string;pointer:number;x:number;y:number;width:number;height:number;widths:number[];direction:'right'|'bottom'|'corner';original?:Span}|undefined
function startResize(event:PointerEvent,id:string,direction:'right'|'bottom'|'corner'='corner'){
  if(!editing.value||!grid.value||event.button!==0)return
  const handle=event.currentTarget as HTMLElement,card=handle.closest('article')!,bounds=card.getBoundingClientRect(),container=grid.value.getBoundingClientRect()
  const tracks=getComputedStyle(grid.value).gridTemplateColumns.split(' ').map(Number.parseFloat)
  let offset=0,leftColumn=0
  for(let index=0;index<tracks.length;index++){if(Math.abs(offset-(bounds.left-container.left))<2){leftColumn=index;break}offset+=tracks[index]!+16}
  const widths=tracks.slice(leftColumn).map((_,index)=>tracks.slice(leftColumn,leftColumn+index+1).reduce((sum,track)=>sum+track,0)+16*index)
  resizeState={id,pointer:event.pointerId,x:event.clientX,y:event.clientY,width:bounds.width,height:bounds.height,widths,direction,original:spans.value[id]&&{...spans.value[id]!}}
  resizing.value=id;handle.setPointerCapture(event.pointerId);event.preventDefault();event.stopPropagation()
}
function resizeMove(event:PointerEvent){
  const state=resizeState;if(!state||event.pointerId!==state.pointer)return
  const width=state.width+event.clientX-state.x,height=state.height+event.clientY-state.y
  const current=spanFor(state.id)
  const nearest=state.widths.reduce((best,candidate,index)=>Math.abs(candidate-width)<Math.abs(state.widths[best]!-width)?index:best,0)+1
  spans.value={...spans.value,[state.id]:{columns:state.direction==='bottom'?current.columns:nearest,rows:state.direction==='right'?current.rows:Math.max(state.id==='calendar'?6:2,Math.min(10,Math.round((height+16)/80)))}}
}
function finishResize(){resizeState=undefined;resizing.value=''}
function cancelResize(){if(resizeState){const next={...spans.value};if(resizeState.original)next[resizeState.id]=resizeState.original;else delete next[resizeState.id];spans.value=next}finishResize()}
let originalSizes:Record<string,string>={}
const sizeKey=computed(()=>`routel-dashboard-${props.calendarOnly?'calendar-':''}sizes-v1:${props.accountId || 'guest'}`)
function availableSizes(id:string){return id==='calendar'?sizeOptions.filter(option=>['tall','large'].includes(option.id)):sizeOptions}
function widgetSize(id:string){const fallback=id==='status'?'full':id==='calendar'?'tall':id==='events'?'tall':['review','alerts','maintenance'].includes(id)?'compact':'standard';return availableSizes(id).find(option=>option.id===(sizes.value[id]||fallback))||availableSizes(id)[0]!}
type Task = {id:string; text:string; date:string; done:boolean}
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const selectedDate = ref(today), year = ref(Number(today.slice(0,4))), month = ref(Number(today.slice(5,7)))
const enabled = ref<string[]>([]), tasks = ref<Task[]>([]), memo = ref(''), draft = ref(''), taskDraft = ref(''), saveError = ref('')
const editing=ref(false)
const drawerOpen=ref(false),drawer=ref<HTMLElement>()
function closeDrawer(){drawerOpen.value=false}
function outsideDrawer(event:PointerEvent){if(drawerOpen.value&&!dragging.value&&event.target instanceof Element&&!drawer.value?.contains(event.target)&&!event.target.closest('.widget-drawer-trigger'))closeDrawer()}
function drawerKey(event:KeyboardEvent){if(event.key==='Escape'&&drawerOpen.value){event.preventDefault();closeDrawer()}}
onMounted(()=>{document.addEventListener('pointerdown',outsideDrawer,true);document.addEventListener('keydown',drawerKey)})
onBeforeUnmount(()=>{document.removeEventListener('pointerdown',outsideDrawer,true);document.removeEventListener('keydown',drawerKey)})
let originalLayout:string[]=[]
const key = computed(() => `routel-dashboard-${props.calendarOnly?'calendar':'widgets'}-v1:${props.accountId || 'guest'}`)
const layoutKey=computed(()=>`routel-dashboard-${props.calendarOnly?'calendar-':''}layout-v2:${props.accountId || 'guest'}`)
const dragging=ref(''), dropTarget=ref('')
const newWidgets=ref(new Set<string>())
const arrivalTimers=new Map<string,ReturnType<typeof setTimeout>>()
function markNewWidget(id:string){
  clearTimeout(arrivalTimers.get(id));newWidgets.value.add(id)
  arrivalTimers.set(id,setTimeout(()=>{newWidgets.value.delete(id);arrivalTimers.delete(id)},6000))
}
onBeforeUnmount(()=>{for(const timer of arrivalTimers.values())clearTimeout(timer)})
let restoring = false
watch(key, () => {
  restoring=true
  enabled.value=[...defaults]; tasks.value=[]; memo.value=''; saveError.value=''
  sizes.value={}
  spans.value={}
  try {
    const saved=JSON.parse(localStorage.getItem(key.value) || 'null')
    if (saved) {
      if(Array.isArray(saved.tasks)) tasks.value=saved.tasks.filter((task:any)=>typeof task?.id==='string' && typeof task.text==='string' && typeof task.date==='string').map((task:Task)=>({...task,done:!!task.done}))
      if(typeof saved.memo==='string') memo.value=saved.memo
    }
    const layout=JSON.parse(localStorage.getItem(layoutKey.value)||'null')
    if(Array.isArray(layout)&&!props.calendarOnly)enabled.value=[...new Set<string>(layout.filter((id:unknown)=>catalog.some(item=>item.id===id)))]
    const storedSizes=JSON.parse(localStorage.getItem(sizeKey.value)||'null')
    if(storedSizes&&typeof storedSizes==='object'&&!Array.isArray(storedSizes))for(const widget of catalog){const size=storedSizes[widget.id];if(availableSizes(widget.id).some(option=>option.id===size))sizes.value[widget.id]=size}
    const savedSpans=JSON.parse(localStorage.getItem(spanKey.value)||'null')
    if(savedSpans&&typeof savedSpans==='object')for(const widget of catalog){const span=savedSpans[widget.id];if(Number.isInteger(span?.columns)&&span.columns>=1&&span.columns<=4&&Number.isInteger(span.rows)&&span.rows>=2&&span.rows<=10)spans.value[widget.id]=span}
  } catch { saveError.value='저장된 위젯 설정을 불러오지 못했습니다.' }
  restoring=false
}, {immediate:true,flush:'sync'})
watch([enabled,tasks,memo,sizes,spans],()=>{
  if(restoring)return
  try { localStorage.setItem(key.value,JSON.stringify({tasks:tasks.value,memo:memo.value}));localStorage.setItem(layoutKey.value,JSON.stringify(enabled.value));localStorage.setItem(sizeKey.value,JSON.stringify(sizes.value));localStorage.setItem(spanKey.value,JSON.stringify(spans.value)); saveError.value='' }
  catch { saveError.value='브라우저에 변경 내용을 저장하지 못했습니다.' }
},{deep:true,flush:'sync'})
const widgets = computed(()=>enabled.value.map(id=>catalog.find(item=>item.id===id)!))
const days = computed(()=>{
  const offset=new Date(Date.UTC(year.value,month.value-1,1)).getUTCDay()
  const count=new Date(Date.UTC(year.value,month.value,0)).getUTCDate()
  return Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>i>=offset && i<offset+count ? i-offset+1 : null)
})
const dateFor=(day:number)=>`${year.value}-${String(month.value).padStart(2,'0')}-${String(day).padStart(2,'0')}`
const dailyTasks=computed(()=>tasks.value.filter(task=>task.date===selectedDate.value))
const todos=computed(()=>tasks.value.filter(task=>!task.date))
function shiftMonth(amount:number){const date=new Date(Date.UTC(year.value,month.value-1+amount,1));year.value=date.getUTCFullYear();month.value=date.getUTCMonth()+1}
function toggle(id:string){const adding=!enabled.value.includes(id);enabled.value=adding?[...enabled.value,id]:enabled.value.filter(item=>item!==id);if(adding)markNewWidget(id)}
function move(id:string,offset:number){const list=[...enabled.value],index=list.indexOf(id),next=index+offset;if(next<0||next>=list.length)return;[list[index],list[next]]=[list[next]!,list[index]!];enabled.value=list}
function addTask(calendar:boolean){const text=(calendar?draft.value:taskDraft.value).trim();if(!text)return;tasks.value.push({id:crypto.randomUUID(),text,date:calendar?selectedDate.value:'',done:false});if(calendar)draft.value='';else taskDraft.value=''}
function reset(){enabled.value=[...defaults];sizes.value={};spans.value={};dragging.value='';dropTarget.value=''}
function dragStart(event:DragEvent,id:string){if(!editing.value||!event.dataTransfer){event.preventDefault();return}dragging.value=id;event.dataTransfer.setData('text/plain',id);event.dataTransfer.effectAllowed='move'}
function dragEnd(){dragging.value='';dropTarget.value=''}
function drop(event:DragEvent,before?:string){
  const id=event.dataTransfer?.getData('text/plain')||dragging.value
  if(!catalog.some(widget=>widget.id===id))return
  event.preventDefault();event.stopPropagation()
  if(id!==before){const list=enabled.value.filter(item=>item!==id);const index=before?list.indexOf(before):-1;list.splice(index<0?list.length:index,0,id);enabled.value=list}
  markNewWidget(id)
  dragEnd()
}
function beginEdit(){if(!editing.value){originalLayout=[...enabled.value];originalSizes={...sizes.value};originalSpans=Object.fromEntries(Object.entries(spans.value).map(([id,span])=>[id,{...span}]))}editing.value=true;drawerOpen.value=true}
function finishEdit(){editing.value=false;closeDrawer();dragEnd()}
function cancelEdit(){enabled.value=[...originalLayout];sizes.value={...originalSizes};spans.value={...originalSpans};finishEdit()}
function open(){beginEdit()}
defineExpose({open,reset})
</script>
<template>
  <section class="dashboard-personal" aria-label="내 업무 위젯">
    <header class="personal-heading"><div><h2>대시보드</h2><p v-if="editing">위젯 제목을 끌어 순서를 바꾸세요. 지도는 고정됩니다.</p></div><div class="widget-toolbar"><template v-if="editing"><button type="button" class="widget-drawer-trigger" :aria-expanded="drawerOpen" @click="drawerOpen=!drawerOpen">위젯 목록</button><button type="button" @click="reset">기본 배치</button><button type="button" class="widget-edit-done" @click="finishEdit">편집 완료</button><button type="button" @click="cancelEdit">취소</button></template><button v-else type="button" class="widget-drawer-trigger" @click="beginEdit">위젯 편집</button></div></header>
    <Teleport to="body"><section v-if="editing&&drawerOpen" ref="drawer" class="widget-library widget-library-drawer" aria-label="추가할 위젯 목록"><header><div><strong>위젯 추가</strong><p>누르거나 대시보드로 끌어 놓으세요.</p></div><button type="button" aria-label="위젯 서랍 닫기" @click="closeDrawer">×</button></header><div class="widget-library-items"><div v-for="widget in catalog" :key="widget.id" class="widget-library-item" :draggable="!enabled.includes(widget.id)" @dragstart="dragStart($event,widget.id)" @dragend="dragEnd"><button type="button" :aria-pressed="enabled.includes(widget.id)" :aria-label="widget.name+(enabled.includes(widget.id)?' 제거':' 추가')" @click="toggle(widget.id)"><span><strong>{{widget.name}}</strong><small>{{widget.description}}</small></span><span aria-hidden="true">{{enabled.includes(widget.id)?'✓':'+'}}</span></button></div></div><footer><button type="button" @click="closeDrawer">닫기</button></footer></section></Teleport>
    <p v-if="saveError" role="alert">{{saveError}}</p>
    <p v-if="!widgets.length" class="widget-empty">추가된 위젯이 없습니다. ‘위젯 추가·관리’에서 선택해 주세요.</p>
    <div ref="grid" class="personal-widget-grid" :class="{'dashboard-unified-grid':$slots.map,'widget-dragging':dragging,'widget-resizing':resizing}" @dragover.prevent @drop="drop($event)">
      <div v-if="$slots.map" ref="fixedMap" class="personal-fixed-map" :style="{'--map-rows':mapRows}"><slot name="map" /></div>
      <article v-for="(widget,index) in widgets" :key="widget.id" class="personal-widget" :style="spanStyle(widget.id)" :class="['dashboard-widget--'+widget.id,'widget-size-'+widgetSize(widget.id).id,{'widget-drop-target':dropTarget===widget.id,'notification-arrival-glow':newWidgets.has(widget.id)}]" :aria-label="widget.name" @dragover.prevent.stop="dropTarget=widget.id" @drop="drop($event,widget.id)">
        <button v-if="editing" type="button" class="widget-resize-handle resize-corner" :aria-label="widget.name+' 크기 조절'" title="모서리를 끌어 크기 조절" @pointerdown="startResize($event,widget.id)" @pointermove="resizeMove" @pointerup="finishResize" @pointercancel="cancelResize" @lostpointercapture="finishResize" @keydown.right.prevent="spans[widget.id]={...spanFor(widget.id),columns:Math.min(columns,spanFor(widget.id).columns+1)}" @keydown.left.prevent="spans[widget.id]={...spanFor(widget.id),columns:Math.max(1,spanFor(widget.id).columns-1)}" @keydown.down.prevent="spans[widget.id]={...spanFor(widget.id),rows:Math.min(10,spanFor(widget.id).rows+1)}" @keydown.up.prevent="spans[widget.id]={...spanFor(widget.id),rows:Math.max(widget.id==='calendar'?6:2,spanFor(widget.id).rows-1)}"></button>
        <button v-if="editing" type="button" class="widget-resize-handle resize-right" tabindex="-1" :aria-label="widget.name+' 너비 조절'" @pointerdown="startResize($event,widget.id,'right')" @pointermove="resizeMove" @pointerup="finishResize" @pointercancel="cancelResize" @lostpointercapture="finishResize"></button>
        <button v-if="editing" type="button" class="widget-resize-handle resize-bottom" tabindex="-1" :aria-label="widget.name+' 높이 조절'" @pointerdown="startResize($event,widget.id,'bottom')" @pointermove="resizeMove" @pointerup="finishResize" @pointercancel="cancelResize" @lostpointercapture="finishResize"></button>
        <header :draggable="editing" @dragstart="dragStart($event,widget.id)" @dragend="dragEnd"><h3><span v-if="editing" class="widget-grip" aria-hidden="true">⠿</span>{{widget.name}}</h3><div v-if="editing" class="widget-tools"><button type="button" :disabled="index===0" :aria-label="widget.name+' 앞으로 이동'" @click="move(widget.id,-1)">←</button><button type="button" :disabled="index===widgets.length-1" :aria-label="widget.name+' 뒤로 이동'" @click="move(widget.id,1)">→</button><button type="button" :aria-label="widget.name+' 위젯 제거'" @click="toggle(widget.id)">×</button></div></header>
        <div class="widget-content">
        <template v-if="widget.id==='calendar'">
          <nav class="widget-calendar-nav" aria-label="캘린더 월 이동"><button type="button" aria-label="이전 달" @click="shiftMonth(-1)">‹</button><strong>{{year}}년 {{month}}월</strong><button type="button" aria-label="다음 달" @click="shiftMonth(1)">›</button></nav>
          <div class="widget-calendar"><span v-for="weekday in ['일','월','화','수','목','금','토']" :key="weekday" class="weekday">{{weekday}}</span><template v-for="(day,position) in days" :key="position"><button v-if="day" type="button" :aria-label="dateFor(day)" :aria-pressed="selectedDate===dateFor(day)" :class="{today:dateFor(day)===today,'has-schedule':tasks.some(task=>task.date===dateFor(day))}" @click="selectedDate=dateFor(day)">{{day}}</button><span v-else></span></template></div>
          <p class="widget-selected-date">{{selectedDate}} 일정</p>
          <ul class="widget-task-list"><li v-for="task in dailyTasks" :key="task.id"><label><input v-model="task.done" type="checkbox" /><span :class="{completed:task.done}">{{task.text}}</span></label><button type="button" :aria-label="task.text+' 삭제'" @click="tasks=tasks.filter(row=>row.id!==task.id)">×</button></li></ul>
          <p v-if="!dailyTasks.length" class="widget-empty">등록된 일정이 없습니다.</p>
          <form class="widget-add-form" @submit.prevent="addTask(true)"><input v-model="draft" aria-label="새 일정" placeholder="점검·회의 일정 입력" maxlength="120" /><button type="submit" :disabled="!draft.trim()">추가</button></form>
        </template>
        <template v-else-if="widget.id==='checklist'">
          <p class="widget-empty">완료 {{todos.filter(task=>task.done).length}} / {{todos.length}}</p><ul class="widget-task-list"><li v-for="task in todos" :key="task.id"><label><input v-model="task.done" type="checkbox" /><span :class="{completed:task.done}">{{task.text}}</span></label><button type="button" :aria-label="task.text+' 삭제'" @click="tasks=tasks.filter(row=>row.id!==task.id)">×</button></li></ul>
          <form class="widget-add-form" @submit.prevent="addTask(false)"><input v-model="taskDraft" aria-label="새 업무" placeholder="처리할 업무 입력" maxlength="120" /><button type="submit" :disabled="!taskDraft.trim()">추가</button></form>
        </template>
        <template v-else-if="widget.id==='memo'"><textarea v-model="memo" aria-label="업무 메모" placeholder="인계 사항이나 확인할 내용을 기록하세요." maxlength="4000" rows="8"></textarea><p class="widget-empty">{{memo.length}} / 4,000자 · 자동 저장</p></template>
        <nav v-else-if="widget.id==='shortcuts'" class="widget-shortcuts"><RouterLink to="/fac-list">지하차도 관리 <span>→</span></RouterLink><RouterLink to="/verify">번호판 판별 <span>→</span></RouterLink><RouterLink to="/pm-equipment">설비·점검 <span>→</span></RouterLink><RouterLink to="/notifications">알림 내역 <span>→</span></RouterLink><RouterLink to="/admin-reports">보고서 <span>→</span></RouterLink></nav>
        <dl v-else-if="widget.id==='status'" class="widget-kpis"><div v-for="[key,label] in [['facilityCount','담당 시설'],['blockedCount','통제 중'],['dangerLevelCount','위험'],['pendingReviewCount','판별 대기'],['remainingCount','잔류 차량']]" :key="key"><dt>{{label}}</dt><dd>{{summary?.[key!]??'—'}}</dd></div></dl>
        <template v-else-if="widget.id==='maintenance'"><p class="widget-empty">시설 설비와 점검 대상을 확인하세요.</p><RouterLink to="/pm-equipment">설비·점검 대상 보기 →</RouterLink></template>
        <template v-else-if="widget.id==='review'"><p class="widget-count">{{summary?.pendingReviewCount??'—'}}<small> 건 대기 중</small></p><RouterLink to="/verify">판별하러 가기 →</RouterLink></template>
        <template v-else-if="widget.id==='alerts'"><p class="widget-count">{{summary?.alertsToday??'—'}}<small> 건 발송</small></p><RouterLink to="/notifications">알림 내역 →</RouterLink></template>
        <template v-else-if="widget.id==='events'"><RouterLink to="/admin-reports?report=timeline">로그 전체 보기 →</RouterLink><p v-if="!events.length" class="widget-empty">표시할 이벤트가 없습니다.</p><ul class="widget-data-list"><li v-for="event in events" :key="eventKey(event)" :class="{'notification-arrival-glow':isNewEvent(event)}"><RouterLink :to="dashboardEventTarget(event)" data-button class="widget-event-link"><strong>{{event.underpassName||'시설'}}</strong><span>{{event.reason||valueLabels[event.eventType]||event.eventType||'시설 상태 변경'}}</span><small>{{displayDate(event.createdAt)}}</small></RouterLink></li></ul></template>
        <template v-else-if="widget.id==='risk'"><p v-if="!margins.length" class="widget-empty">위험 임박 시설이 없습니다.</p><ul class="widget-data-list"><li v-for="facility in margins" :key="facility.underpassId"><RouterLink :to="{path:'/fac-detail',query:{id:facility.underpassId}}">{{facility.underpassName}}</RouterLink><span>위험 임계치까지 {{facility.margin}}점</span></li></ul></template>
        </div>
      </article>
    </div>
  </section>
</template>
<style scoped src="../styles/components/dashboard-widgets.css"></style>
<style scoped src="../styles/components/dashboard-widget-drawer.css"></style>

<style scoped src="../styles/components/dashboard-widget-grid.css"></style>
