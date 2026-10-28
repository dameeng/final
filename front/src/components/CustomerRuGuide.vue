<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useApp} from '../stores/app'
import ru from '../assets/mascot/routel-ru-transparent.png'
import wink from '../assets/mascot/routel-ru-wink.png'
import {completeCustomerGuide,customerGuidePending} from '../services/customerOnboarding'
import walk from '../assets/mascot/routel-ru-walk.png'
import {managerGuideSteps} from '../data/managerGuide'
import {backend} from '../services/backend'
import {ownsFacility} from '../services/facilityAccess'
const props=defineProps<{manager?:boolean}>()
const guideEvent=props.manager?'routel-manager-guide-open':'routel-customer-guide-open'
const guideFacility=ref(''),guideEquipment=ref('')
const route=useRoute(),router=useRouter(),app=useApp()
const dialog=ref<HTMLDialogElement>(),heading=ref<HTMLElement>(),opened=ref(false),step=ref(0),moving=ref(false)
const card=ref<HTMLElement>(),coachStyle=ref<Record<string,string>>(),actor=ref({left:0,top:0}),travelling=ref(false),direction=ref(1)
const mobile=ref(false),spotlight=ref<{left:number;top:number;width:number;height:number}>(),error=ref('')
let timer:ReturnType<typeof setTimeout>|undefined,owner='',returnTo='',trigger:HTMLElement|null=null
let travelTimer:ReturnType<typeof setTimeout>|undefined,placementTimer:ReturnType<typeof setTimeout>|undefined,cardObserver:ResizeObserver|undefined
let contentObserver:ResizeObserver|undefined,contentTimer:ReturnType<typeof setTimeout>|undefined
const guideScrollAreas=new Set<HTMLElement>()
function resetGuideScrollAreas(){for(const area of guideScrollAreas)area.classList.remove('ru-guide-scroll-space');guideScrollAreas.clear()}
let listOpenedByGuide=false
function restoreGuideList(){
  if(!listOpenedByGuide)return
  const handle=document.querySelector<HTMLButtonElement>('.app-map-sheet .mobile-sheet-handle')
  if(handle?.getAttribute('aria-expanded')==='true')handle.click()
  listOpenedByGuide=false
}
const eligible=computed(()=>props.manager
  ?!!app.account&&app.account.role!=='customer'&&route.path.startsWith('/admin-app/')&&!['/admin-app/screen-1','/admin-app/signup','/admin-app/password-reset'].includes(route.path)
  :app.account?.role==='customer'&&!/^\/(?:admin|fac-|pm-|cs-|bot-)/.test(route.path)&&!/^\/(?:login|signup|password-reset|find-id)(?:\/|$)/.test(route.path)&&!/^\/customer-app\/(?:screen-[1234]|password-reset|find-id)(?:\/|$)/.test(route.path))
const steps=computed(()=>props.manager?managerGuideSteps(guideFacility.value,guideEquipment.value):[
  {title:'안녕하세요, 안전 안내자 루예요!',body:'ROUTEL에 오신 걸 환영해요. 출발 전에 알아두면 좋은 기능을 저와 함께 하나씩 살펴볼까요?',hint:'버튼을 누르면 실제 화면을 함께 둘러봐요.',icon:'help',path:'',target:''},
  {title:'지나갈 지하차도, 먼저 확인해요',body:'지도에서 지하차도의 상태를 확인해요. 마커를 누르면 요약 카드가 뜨고, 지하차도 이름을 누르면 자세한 정보를 볼 수 있어요.',hint:'지도 → 마커 선택 → 이름을 눌러 상세 보기',icon:'map',path:mobile.value?'/customer-app/screen-5':'/c-map',target:mobile.value?'.app-map-search||.customer-app-nav a[href="/customer-app/screen-5"]':'.facility-list-panel .ph||.customer-header a[href="/c-map"]'},
  mobile.value?{title:'이동할 길도 함께 확인해요',body:'출발지와 도착지를 입력해 경로를 찾아보세요. 통제 구간 안내가 나오면 내용을 확인하고 안전한 우회 경로를 선택해 주세요.',hint:'출발지·도착지 입력 → 길찾기',icon:'route',path:'/customer-app/screen-7',target:'.navigation-search||.customer-app-nav a[href="/customer-app/screen-7"]'}
    :{title:'필요한 안전 안내를 확인해요',body:'공지사항에서 서비스 안내와 안전 소식을 확인할 수 있어요. 궁금한 이용 방법은 FAQ에서도 찾아보세요.',hint:'공지사항에서 중요한 안내 확인',icon:'bell',path:'/c-notice',target:'.service-filters||.customer-header a[href="/c-notice"]'},
  {title:'통제 중이면 진입하지 말고 우회해요',body:mobile.value?'통제 안내를 받으면 해당 지하차도에 진입하지 마세요. 길찾기에서 우회 경로를 확인하고 안내를 시작해 주세요. 우회 경로를 찾지 못했다면 기존 경로로 진입하지 말고 현장 안내를 따라 주세요.':'지도에 통제로 표시된 지하차도에는 진입하지 마세요. 고객 앱의 길찾기에서 통제 구간을 피하는 경로를 확인하고, 현장 통제 안내를 따라 이동해 주세요.',hint:'통제 알림 확인 → 진입하지 않기 → 우회 경로 확인',icon:'route',path:mobile.value?'/customer-app/screen-7':'/c-map',target:mobile.value?'.navigation-search .btn.p||.navigation-search':'.mtop .pill||.facility-list-panel .ph'},
  {title:'내 정보와 차량을 관리해요',body:'내 정보에서 연락처와 차량 번호를 확인하고 알림 설정을 관리해요. 등록한 차량 번호가 정확한지도 확인해 주세요.',hint:'내 정보 관리 · 내 차량 · 알림 수신 설정',icon:'user',path:mobile.value?'/customer-app/screen-13':'/my-home',target:mobile.value?'.app-account-menu a[href="/customer-app/account/profile"]':'.customer-profile-identity||.account-service'},
  {title:'궁금할 때는 루를 찾아 주세요',body:mobile.value?'내 정보의 AI 도우미에서 궁금한 내용을 물어보세요. 이 안내도 ‘루와 사용법 보기’에서 언제든 다시 볼 수 있어요.':'화면의 루 옆 ‘챗봇 문의’를 누르면 궁금한 내용을 물어볼 수 있어요. 이 안내는 내 정보의 ‘루와 사용법 보기’에서 다시 볼 수 있어요.',hint:'중요한 통제 정보는 지도에서 다시 확인해 주세요.',icon:'chat',path:mobile.value?'/customer-app/screen-13':'/my-home',target:mobile.value?'.app-account-chat':'.customer-guide-replay'},
].flatMap((item,index)=>{
  const mapPath=mobile.value?'/customer-app/screen-5':'/c-map'
  const extra=(title:string,body:string,path:string,target:string)=>({title,body,path,target,hint:'',icon:'help'})
  if(index===1)return [item,
    extra('이름을 검색하고, 위험한 곳부터 살펴봐요','위 검색창에 지하차도 이름을 입력해 찾아보세요. 목록은 통제·위험 상태가 먼저 나오고, 같은 상태에서는 위험 점수가 높은 순서로 정렬돼요. 지역과 상태를 선택하면 필요한 시설만 볼 수 있어요.',mapPath,'.app-map-search||.facility-list-panel .ph'),
    extra('목록을 펼쳐 놓았어요','아래 손잡이를 올리거나 ‘목록 펼치기’를 누르면 이렇게 목록이 열려요. 숫자는 현재 조건에 맞는 시설 수예요. 목록 안을 위아래로 스크롤하면 모든 시설을 볼 수 있고, 손잡이를 내리거나 ‘목록 접기’를 누르면 다시 지도가 넓어져요.',mapPath,'.app-map-sheet .mobile-sheet-handle||.facility-list-panel'),
    extra('지역과 상태로 목록을 좁혀요','‘부산 전체’에서 원하는 구·군을 선택하세요. 아래 ‘전체·통제·위험·주의·안전’을 누르면 해당 상태의 시설만 남아요. 다른 시설이 보이지 않으면 지역과 상태를 ‘전체’로 되돌려 보세요.',mapPath,'.app-map-sheet .ph||.facility-list-panel .ph'),
    extra('위험한 시설부터, 상태를 함께 확인해요','통제 시설이 먼저 나오고 위험도가 높은 순서로 정렬돼요. 같은 상태에서는 위험 점수가 높은 시설이 앞에 있어요. 각 줄에서 시설명·상태 배지·지역을 확인하고, 시설을 눌러 정보를 살펴보세요. 통제 표시가 있으면 진입하지 마세요.',mapPath,'.app-map-sheet .lst||.facility-list-panel .lst'),
    extra('마커는 요약, 이름은 상세 보기예요','지도 마커를 한 번 누르면 시설 이름과 상태를 담은 요약 카드가 떠요. 이름을 누르면 상세 화면으로 이동해요. 숫자로 묶인 마커는 먼저 시설을 골라 주세요.',mapPath,'.customer-map-canvas'),
    extra('주변 CCTV와 전광판도 확인해요','지도 위 CCTV·VMS 버튼을 켜면 주변 교통 시설을 볼 수 있어요. 해당 마커를 누르면 영상이나 전광판 정보를 확인해요. 영상은 제공 기관의 연결 상태에 따라 재생이 지연될 수 있어요.',mapPath,'.traffic-layer-switches||.mtop'),
  ]
  if(index===2&&mobile.value)return [item,
    extra('시연은 동구청에서 오페라하우스로 가요','기본 출발지는 부산 동구청, 도착지는 부산 오페라하우스예요. ‘시연 바로 시작’을 누르면 경로를 조회하고 가상 위치로 주행해요. 실제 GPS로 안내하려면 주행 방식을 바꿔 주세요.','/customer-app/screen-7','.navigation-search'),
    extra('주행 중 통제되는 상황도 시연해요','시연 주행을 시작한 뒤 패널의 ‘주행 중 통제 발생’을 누르면 우회 경로를 다시 찾아요. 통제 안내에서 ‘우회 경로로 안내 시작’을 누르면 새 경로로 이어져요. 실제 시설 상태는 바꾸지 않아요.','/customer-app/screen-7','.navigation-search'),
  ]
  if(index===4)return [item,
    extra('종을 누르면 받은 알림을 볼 수 있어요','헤더의 종을 눌러 최근 알림을 확인하세요. 알림을 누르면 상세 내용으로 이동하고 읽음 처리돼요. 최근 알림 창의 ‘모두 읽음’으로 정리할 수 있어요. 통제 안내를 받으면 해당 시설에 진입하지 마세요.',mobile.value?'/customer-app/screen-13':'/my-home','.customer-mobile-header .notification-bell||.notification-bell'),
    extra('차량 번호와 알림 설정을 확인해요','내 정보 관리에서 연락처와 차량 번호를 등록·수정하고, 알림 수신 설정도 확인하세요. 차량 번호를 정확히 입력해야 내 차량과 연결된 안내를 확인하기 쉬워요. 공지사항·FAQ·내 문의도 마이페이지에서 열 수 있어요.',mobile.value?'/customer-app/screen-13':'/my-home','.app-account-menu||.customer-profile-identity'),
  ]
  return [item]
}))
const current=computed(()=>steps.value[step.value]!)
function targetElement(){
  for(const selector of current.value.target.split('||').filter(Boolean)){
    const element=document.querySelector<HTMLElement>(selector)
    const rect=element?.getBoundingClientRect()
    if(rect&&rect.width>8&&rect.height>8)return element
  }
  return null
}
async function revealTarget(){
  const expectedStep=step.value
  if(props.manager&&route.path==='/admin-app/screen-3'){
    for(let attempt=0;attempt<40;attempt++){
      const map=document.querySelector('.map-only-live')
      if(map&&map.getBoundingClientRect().height>50)break
      await new Promise(resolve=>setTimeout(resolve,50))
      if(!opened.value||step.value!==expectedStep)return
    }
  }
  if(props.manager&&(guideFacility.value&&current.value.target.startsWith('.app-facility-')||['/admin-app/reviews','/admin-app/pm-daily'].includes(current.value.path)||current.value.path.startsWith('/admin-app/screen-10?'))){
    const selector=current.value.target.split('||')[0]!
    for(let attempt=0;attempt<20&&!document.querySelector(selector);attempt++){
      await new Promise(resolve=>setTimeout(resolve,50))
      if(!opened.value||step.value!==expectedStep)return
    }
  }
  if(!opened.value||step.value!==expectedStep)return
  const target=targetElement(),scroller=props.manager?target?.closest<HTMLElement>('.app-restored-body,.app-extra-body'):undefined
  if(target&&scroller){
    if(route.path==='/admin-app/screen-3'){
      scroller.classList.remove('ru-guide-scroll-space');guideScrollAreas.delete(scroller)
      scroller.scrollTop=0
    }else{
      scroller.classList.add('ru-guide-scroll-space');guideScrollAreas.add(scroller)
      const box=target.getBoundingClientRect(),area=scroller.getBoundingClientRect()
      scroller.scrollTop+=box.top-area.top-12
    }
  }else target?.scrollIntoView({block:props.manager?'start':'nearest',behavior:'instant'})
  await nextTick()
}
function watchGuideContent(){
  contentObserver?.disconnect();clearTimeout(contentTimer)
  if(!props.manager||!opened.value||step.value===0)return
  const target=targetElement(),content=target?.closest('.app-restored-body,.app-extra-body')?.firstElementChild
  contentObserver=new ResizeObserver(()=>{
    clearTimeout(contentTimer)
    contentTimer=setTimeout(()=>{if(opened.value)void revealTarget().then(measure)},80)
  })
  if(content)contentObserver.observe(content)
  if(target&&target!==content)contentObserver.observe(target)
}
function measure(){
  if(!opened.value||!card.value)return
  if(step.value===0){
    const image=card.value.querySelector('img')?.getBoundingClientRect()
    if(image)actor.value={left:image.left,top:image.top}
    return
  }
  const target=targetElement(),r=target?.getBoundingClientRect()
  const area=target?.closest('.app-restored-body,.app-extra-body,.navigation-body')?.getBoundingClientRect()
  const visibleTop=Math.max(2,r?.top??0,area?.top??0),visibleBottom=Math.min(innerHeight-2,r?.bottom??0,area?.bottom??innerHeight)
  spotlight.value=r&&r.width>8&&visibleBottom-visibleTop>8?{left:Math.max(2,r.left-3),top:visibleTop,width:r.width+6,height:visibleBottom-visibleTop}:undefined
  const frame=mobile.value?document.querySelector<HTMLElement>(props.manager?'.manager-app-shell':'.customer-mobile-header')?.getBoundingClientRect():undefined
  const leftEdge=(frame?.left||0)+12,rightEdge=(frame?.right||innerWidth)-12
  const width=Math.min(360,rightEdge-leftEdge),actorHeight=innerHeight<=600?66:92
  const nav=mobile.value?document.querySelector(props.manager?'.admin-app-bottom-nav':'.customer-app-nav')?.getBoundingClientRect():undefined
  const bottom=(nav?.top||innerHeight)-12,maxHeight=Math.max(160,bottom-actorHeight-28)
  const height=Math.min(card.value.getBoundingClientRect().height,maxHeight)
  const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(value,Math.max(min,max)))
  let left=(leftEdge+rightEdge-width)/2,top=bottom-height
  if(r){
    if(!mobile.value&&r.right+24+width<=rightEdge){left=r.right+24;top=r.top+actorHeight+12}
    else if(!mobile.value&&r.left-width-24>=leftEdge){left=r.left-width-24;top=r.top+actorHeight+12}
    else{
      left=r.left+r.width/2-width/2
      top=r.bottom+actorHeight+16
      if(top+height>bottom&&r.top-height-20>=actorHeight+16)top=r.top-height-20
    }
  }
  left=Math.round(clamp(left,leftEdge,rightEdge-width));top=Math.round(clamp(top,actorHeight+16,bottom-height))
  coachStyle.value={left:left+'px',top:top+'px',bottom:'auto',transform:'none',width:width+'px',maxHeight:maxHeight+'px'}
  const next={left:left+16,top:top-actorHeight+4}
  if(Math.abs(next.left-actor.value.left)>4||Math.abs(next.top-actor.value.top)>4){
    direction.value=next.left<actor.value.left?-1:1
    travelling.value=!matchMedia('(prefers-reduced-motion: reduce)').matches
    clearTimeout(travelTimer);travelTimer=setTimeout(()=>{travelling.value=false},650)
  }
  actor.value=next
}
async function start(){
  if(!eligible.value||opened.value)return
  if(document.querySelector('dialog[open]'))return
  owner=String(app.account!.id);mobile.value=props.manager||route.path.startsWith('/customer-app/');returnTo=route.fullPath
  trigger=document.activeElement instanceof HTMLElement?document.activeElement:null
  step.value=0;error.value='';spotlight.value=undefined;coachStyle.value=undefined;opened.value=true
  await nextTick();dialog.value?.showModal();heading.value?.focus({preventScroll:true});measure()
  cardObserver?.disconnect();cardObserver=new ResizeObserver(measure)
  if(card.value)cardObserver.observe(card.value)
  if(props.manager){
    guideFacility.value='';guideEquipment.value=''
    const results=await Promise.allSettled([backend<any>('/api/underpasses?page=1&size=100'),backend<any>('/api/pm/equipments?page=1&size=1')])
    if(!opened.value||String(app.account?.id)!==owner)return
    if(results[0].status==='fulfilled'){
      const value=results[0].value,rows=Array.isArray(value)?value:value?.items||[]
      const owned=rows.filter((row:any)=>ownsFacility(row))
      const facility=owned.find((row:any)=>String(row.name||row.underpassName||'').includes('초량'))||owned[0]
      guideFacility.value=String(facility?.id??facility?.underpassId??'')
    }
    if(results[1].status==='fulfilled')guideEquipment.value=String(results[1].value?.items?.[0]?.equipId??'')
  }
}
function checkAutomatic(){
  if(props.manager)return
  clearTimeout(timer)
  if(!eligible.value||opened.value||!customerGuidePending(String(app.account!.id)))return
  if(document.querySelector('dialog[open]')){timer=setTimeout(checkAutomatic,600);return}
  void start()
}
async function go(index:number){
  if(moving.value||index<0||index>=steps.value.length)return
  moving.value=true;error.value='';spotlight.value=undefined
  contentObserver?.disconnect();clearTimeout(contentTimer)
  resetGuideScrollAreas()
  try{
    const destination=steps.value[index]!.path
    if(destination&&route.fullPath!==destination)await router.push(destination)
    step.value=index
    coachStyle.value=index===0?undefined:coachStyle.value
    await nextTick()
    const action='action' in current.value?current.value.action:undefined
    if(props.manager&&action){
      let shown=false
      for(let attempt=0;attempt<20&&!shown;attempt++){
        window.dispatchEvent(new CustomEvent('routel-manager-guide-action',{detail:{mode:action,opened:()=>{shown=true}}}))
        await new Promise(resolve=>setTimeout(resolve,50))
        if(!opened.value)return
      }
      await nextTick()
    }
    if(mobile.value&&current.value.target.startsWith('.app-map-sheet')){
      const handle=document.querySelector<HTMLButtonElement>('.app-map-sheet .mobile-sheet-handle')
      if(handle?.getAttribute('aria-expanded')==='false'){handle.click();listOpenedByGuide=true;await nextTick()}
    }else restoreGuideList()
    await revealTarget()
    measure();heading.value?.focus({preventScroll:true})
    watchGuideContent()
    clearTimeout(placementTimer);placementTimer=setTimeout(()=>{void revealTarget().then(measure)},350)
  }catch{error.value='화면을 이동하지 못했어요. 다시 눌러 주세요.'}
  finally{moving.value=false}
}
function finish(){
  if(!opened.value)return
  if(props.manager)window.dispatchEvent(new CustomEvent('routel-manager-guide-action',{detail:{mode:'close'}}))
  restoreGuideList()
  contentObserver?.disconnect();clearTimeout(contentTimer)
  resetGuideScrollAreas()
  if(!props.manager)completeCustomerGuide(owner)
  opened.value=false;dialog.value?.close();spotlight.value=undefined
  clearTimeout(travelTimer);clearTimeout(placementTimer);cardObserver?.disconnect();travelling.value=false
  if(trigger?.isConnected)trigger.focus({preventScroll:true})
}
async function done(){finish();if(route.fullPath!==returnTo)await router.push(returnTo)}
function manual(){void start()}
watch(()=>[route.path,app.account?.id,app.account?.role],()=>{
  if(opened.value&&(!eligible.value||String(app.account?.id)!==owner)){opened.value=false;dialog.value?.close();spotlight.value=undefined}
  clearTimeout(timer);timer=setTimeout(checkAutomatic,250)
},{immediate:true})
onMounted(()=>{window.addEventListener(guideEvent,manual);window.addEventListener('routel-customer-guide-ready',checkAutomatic);window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true)})
onBeforeUnmount(()=>{clearTimeout(timer);clearTimeout(travelTimer);clearTimeout(placementTimer);clearTimeout(contentTimer);contentObserver?.disconnect();resetGuideScrollAreas();cardObserver?.disconnect();dialog.value?.close();window.removeEventListener(guideEvent,manual);window.removeEventListener('routel-customer-guide-ready',checkAutomatic);window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true)})
</script>
<template>
  <dialog ref="dialog" class="ru-guide-dialog" :class="{'manager-ru-guide':manager}" aria-labelledby="ru-guide-heading" aria-describedby="ru-guide-copy" @cancel.prevent="finish">
    <template v-if="opened">
      <div v-if="spotlight" class="ru-guide-spotlight" :style="{left:spotlight.left+'px',top:spotlight.top+'px',width:spotlight.width+'px',height:spotlight.height+'px'}" aria-hidden="true"></div><div v-else class="ru-guide-dimmer" aria-hidden="true"></div>
      <div class="ru-guide-actor" :class="{'is-hidden':step===0,'is-travelling':travelling}" :style="{left:actor.left+'px',top:actor.top+'px','--guide-facing':direction}" aria-hidden="true"><img :src="travelling?walk:step===steps.length-1?wink:ru" alt="" width="84" height="92" /></div>
      <section ref="card" class="ru-guide-card" :class="{'is-mobile':mobile,'is-coach':step>0}" :style="step>0?coachStyle:undefined">
        <header><span>{{step===0?'루와 함께하는 첫걸음':'루가 알려드려요'}}</span><button type="button" :disabled="moving" @click="finish">건너뛰기 <UiIcon name="close" /></button></header>
        <div class="ru-guide-intro"><img v-if="step===0" :src="wink" alt="안전 안내자 루" width="92" height="92" /><div><small v-if="step===0">ROUTEL GUIDE</small><h2 id="ru-guide-heading" ref="heading" tabindex="-1">{{current.title}}</h2></div></div>
        <p id="ru-guide-copy">{{current.body}}</p>
        <p v-if="error" class="ru-guide-error" role="alert">{{error}}</p>
        <div class="ru-guide-progress" role="progressbar" aria-label="사용 안내 진행" :aria-valuenow="step+1" :aria-valuemax="steps.length" :aria-valuemin="1"><div v-if="manager" class="ru-guide-progress-track" aria-hidden="true"><i :style="{width:((step+1)/steps.length*100)+'%'}"></i></div><template v-else><span v-for="(_,index) in steps" :key="index" :class="{active:index===step,complete:index<step}" aria-hidden="true"></span></template><small>{{step+1}} / {{steps.length}}</small></div>
        <footer><button v-if="step>0" type="button" :disabled="moving" @click="go(step-1)">이전</button><button type="button" class="ru-guide-next" :disabled="moving" @click="step===steps.length-1?done():go(step+1)">{{moving?'이동 중…':step===0?'루와 둘러보기':step===steps.length-1?'안내 마치기':'다음'}}<span class="ru-guide-next-arrow" aria-hidden="true">→</span></button></footer>
      </section>
    </template>
  </dialog>
</template>
<style>
#app dialog.ru-guide-dialog{position:fixed;inset:0;box-sizing:border-box;width:100vw;max-width:none;height:100dvh;max-height:none;margin:0;padding:0;border:0;border-radius:0;box-shadow:none;background:transparent;color:var(--r-ink);overflow:hidden;font-family:var(--r-font);}
#app dialog.ru-guide-dialog::backdrop{background:transparent;backdrop-filter:none;animation:none;}
#app :is(.app-restored-body,.app-extra-body).ru-guide-scroll-space::after{content:'';display:block;height:100dvh;flex:0 0 100dvh;pointer-events:none;}
#app :is(.app-restored-body,.app-extra-body).ru-guide-scroll-space>*{flex-shrink:0;}
body:has(.ru-guide-dialog[open]) #public-chat-launcher{display:none!important;}
.ru-guide-dimmer{position:fixed;inset:0;background:#081b2d99;}
.ru-guide-spotlight{position:fixed;pointer-events:none;border-radius:12px;box-shadow:0 0 0 9999px #081b2d99;outline:3px solid #89bfff;outline-offset:1px;}
#app .ru-guide-card{position:fixed;left:50%;bottom:32px;transform:translateX(-50%);box-sizing:border-box;width:min(460px,calc(100% - 32px));max-height:calc(100dvh - 64px);overflow:auto;padding:22px;border:1px solid var(--r-line);border-radius:20px;background:var(--r-surface);box-shadow:0 16px 60px #081b2d45;}
#app .ru-guide-card.is-mobile{bottom:calc(84px + env(safe-area-inset-bottom,0px));width:min(398px,calc(100% - 32px));max-height:calc(100dvh - 108px);}
#app .ru-guide-actor{position:fixed;z-index:3;width:84px;height:92px;pointer-events:none;opacity:1;}
#app .ru-guide-actor.is-hidden{opacity:0;}
#app .ru-guide-actor img{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 5px 8px #07121c30);}
#app .ru-guide-card.is-coach{z-index:2;width:min(360px,calc(100% - 24px));padding:18px;border-radius:4px 18px 18px 18px;}
#app .ru-guide-card.is-coach header{margin-bottom:10px;}
#app .ru-guide-card.is-coach h2{margin:0;font-size:18px;line-height:26px;}
#app .ru-guide-card.is-coach #ru-guide-copy{margin:12px 0;font-size:13px;line-height:1.8;}
#app .ru-guide-card.is-coach .ru-guide-progress{margin:14px 0;}
#app .ru-guide-next-arrow{font-size:19px;line-height:1;font-weight:500;}
#app .ru-guide-card header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;font-size:11px;color:var(--r-muted);}
#app .ru-guide-card button{font:inherit;cursor:pointer;}
#app .ru-guide-card header button{display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:4px 0 4px 8px;border:0;background:transparent;color:var(--r-muted);font-size:12px;}
#app .ru-guide-card header button .ui-icon{width:16px;height:16px;}
#app .ru-guide-intro{display:flex;align-items:center;gap:14px;}
#app .ru-guide-intro img{display:block;flex:none;width:82px;height:92px;object-fit:contain;filter:drop-shadow(0 4px 6px #1736571a);}
#app .ru-guide-intro small{font-size:10px;letter-spacing:.08em;color:var(--r-accent);font-weight:600;}
#app .ru-guide-intro h2{margin:8px 0 0;font-size:21px;line-height:1.45;font-weight:700;letter-spacing:-.03em;word-break:keep-all;outline:none;color:var(--r-ink);}
#app #ru-guide-copy{margin:18px 0;font-size:14px;line-height:1.85;word-break:keep-all;color:var(--r-ink);}
#app .ru-guide-progress{display:flex;align-items:center;gap:4px;margin:20px 0 16px;min-width:0;}
#app .ru-guide-progress>span{flex:1 1 0;min-width:0;height:5px;border-radius:10px;background:var(--r-line);}
#app .ru-guide-progress>span.complete{background:#8bb4e1;}#app .ru-guide-progress>span.active{flex-grow:1.6;background:var(--r-accent);}
#app .ru-guide-progress small{flex:0 0 auto;margin-left:8px;white-space:nowrap;font-size:11px;line-height:18px;color:var(--r-muted);font-variant-numeric:tabular-nums;}
#app .manager-ru-guide .ru-guide-progress{gap:2px;}
#app .ru-guide-progress-track{flex:1;min-width:0;height:4px;border-radius:4px;background:var(--r-line);overflow:hidden;}
#app .ru-guide-progress-track>i{display:block;height:100%;border-radius:inherit;background:var(--r-accent);transition:width .2s ease;}
#app .ru-guide-card footer{display:flex;align-items:center;gap:8px;}
#app .ru-guide-card footer button{min-height:44px;padding:10px 18px;border:1px solid var(--r-line);border-radius:9px;background:var(--r-surface);color:var(--r-ink);font-size:14px;}
#app .ru-guide-card footer .ru-guide-next{display:flex;align-items:center;justify-content:center;gap:10px;flex:1;border-color:transparent;background:var(--r-primary);color:#fff;font-weight:600;}
#app .ru-guide-next .ui-icon{width:18px;height:18px;}
#app .ru-guide-card button:focus-visible{outline:2px solid var(--r-accent);outline-offset:3px;}#app .ru-guide-card button:disabled{opacity:.55;cursor:wait;}
#app .ru-guide-error{font-size:12px;color:var(--status-danger-ink,#a32446);}
@media(prefers-reduced-motion:no-preference){#app .ru-guide-intro img{animation:ru-guide-wave 2.8s ease-in-out infinite;}@keyframes ru-guide-wave{0%,100%{transform:rotate(-3deg)}50%{transform:translateY(-4px) rotate(4deg)}}}
@media(prefers-reduced-motion:no-preference){
  #app .ru-guide-actor{transition:left 600ms cubic-bezier(.22,.7,.3,1),top 600ms cubic-bezier(.22,.7,.3,1),opacity 150ms ease;}
  #app .ru-guide-card.is-coach{transition:left 600ms cubic-bezier(.22,.7,.3,1),top 600ms cubic-bezier(.22,.7,.3,1);}
  #app .ru-guide-actor.is-travelling img{animation:ru-guide-walk 260ms ease-in-out infinite;}
  #app .ru-guide-actor:not(.is-travelling) img{animation:ru-guide-wave 2.8s ease-in-out infinite;}
  @keyframes ru-guide-walk{0%,100%{transform:scaleX(var(--guide-facing,1)) translateY(0) rotate(-3deg)}50%{transform:scaleX(var(--guide-facing,1)) translateY(-5px) rotate(3deg)}}
}
@media(max-height:600px){#app .ru-guide-actor{width:60px;height:66px;}#app .ru-guide-card.is-coach{padding:14px;}#app .ru-guide-card.is-coach h2{font-size:16px;line-height:23px;}#app .ru-guide-card.is-coach #ru-guide-copy{font-size:12px;line-height:1.7;}}
@media(max-height:600px){#app .ru-guide-card{padding:16px;}#app .ru-guide-card header{margin-bottom:8px;}#app .ru-guide-intro img{width:60px;height:64px;}#app .ru-guide-intro h2{font-size:18px;}#app #ru-guide-copy{margin:12px 0;font-size:13px;line-height:1.7;}#app .ru-guide-progress{margin:12px 0;}}
</style>
