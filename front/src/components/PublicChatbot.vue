<script setup lang="ts">
import { computed, ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { backend } from '../services/backend'
import { useApp } from '../stores/app'
import ChatAnswer from './ChatAnswer.vue'
import mascotIcon from '../assets/mascot/routel-ru-transparent.png'
import mascotReactionIcon from '../assets/mascot/routel-ru-reaction.png'
import mascotWinkIcon from '../assets/mascot/routel-ru-wink.png'
import mascotDizzyIcon from '../assets/mascot/routel-ru-dizzy.png'
import mascotWalkIcon from '../assets/mascot/routel-ru-walk.png'
import mascotSulkIcon from '../assets/mascot/routel-ru-sulk.png'
import { mascotActions, mascotReactions, type MascotAction, type MascotExpression } from '../utils/mascot-reactions'
import '../styles/public-chatbot.css'
const app = useApp(),
  dialog = ref<HTMLDialogElement>(),
  entry = ref(''),
  messages = ref<{ role: string; text: string }[]>([]),
  launcher = ref<HTMLButtonElement>()
const route = useRoute(),
  panelWidth = ref(560),
  messageList = ref<HTMLOListElement>()
const appMode=computed(()=>route.path.startsWith('/customer-app/'))
const mascotReaction = ref('')
const mascotExpression=ref<MascotExpression|'sulk'>('normal')
const mascotSources={normal:mascotIcon,ouch:mascotReactionIcon,wink:mascotWinkIcon,dizzy:mascotDizzyIcon,sulk:mascotSulkIcon,walk:mascotWalkIcon}
const mascotSource=computed(()=>dragging.value?mascotWalkIcon:mascotSources[mascotExpression.value])
const mascotAction=ref<MascotAction>()
const mascotMark=computed(()=>mascotAction.value?mascotReactions[mascotAction.value].mark:'')
let holdTimer: ReturnType<typeof setTimeout> | undefined
let reactionTimer: ReturnType<typeof setTimeout> | undefined
let reactionAnimation: Animation | undefined
let pokeCount = 0
let lastPokeAt = 0
let pokeIntensity = 0
function playMascot(action:MascotAction, direction=1) {
  clearTimeout(reactionTimer)
  const reaction=mascotReactions[action]
  mascotAction.value=action
  mascotExpression.value=reaction.expression
  mascotReaction.value=reaction.text
  reactionAnimation?.cancel()
  const image=launcher.value?.querySelector('img')
  if(image&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const neutral='translate(0,0) rotate(0) scale(1)'
    const motions=direction<0?reaction.motion.map(value=>value.replace(/(translateX|rotate)\((-?[\d.]+)(px|deg)\)/g,(_,fn,n,unit)=>`${fn}(${-Number(n)}${unit})`)):reaction.motion
    reactionAnimation=image.animate([neutral,...motions,neutral].map(transform=>({transform})),{duration:action==='spin'?1100:850,easing:'ease-in-out'})
  }
  reactionTimer=setTimeout(()=>{mascotReaction.value='';mascotExpression.value='normal';mascotAction.value=undefined},action==='cuddle'?2300:1800)
}
function reactMascot(beingDragged=false,direction=1) {
  const now=performance.now()
  if(beingDragged) { playMascot('sway',direction);return }
  if(mascotExpression.value==='sulk') return
  pokeIntensity=now-lastPokeAt<700?Math.min(7,pokeIntensity+1):0
  lastPokeAt=now
  if(pokeIntensity>=5) {
    clearTimeout(reactionTimer)
    reactionAnimation?.cancel()
    mascotAction.value=undefined
    mascotExpression.value='sulk'
    mascotReaction.value='흥… 루 삐졌어요. 잠깐 쉬게 해 주세요.'
    reactionTimer=setTimeout(()=>{mascotExpression.value='normal';mascotReaction.value='';pokeIntensity=0},6500)
    return
  }
  const action=pokeIntensity>=3?'dizzy':mascotActions[pokeCount%mascotActions.length]!
  pokeCount++
  playMascot(action,direction)
}
const appPanelLeft=ref(0)
let returnFocus:HTMLElement|undefined
const popular = ref<{ id: number; question: string }[]>([]),
  answerBusy = ref(false),
  chatOpen = ref(false)
const historyKey = 'routel-public-chat-session-v1'
const conversationId = ref(crypto.randomUUID())
const owner = () => `${app.account?.role || 'guest'}:${app.account?.id || ''}`
const isPrivateQuestion = (text: string) => /(내\s*(차량|문의|계정|정보|연락처)|개인정보|전화번호)/.test(text)
const suggestions = computed(() => {
  const asked = new Set(messages.value.filter(m => m.role === '이용자').map(m => m.text))
  return [...new Set([
    ...popular.value.map(item => item.question).filter(q => typeof q === 'string' && q.length <= 100),
    '지금 통제 중인 지하차도를 알려줘',
    '위험 단계는 어떤 의미인가요?',
    '안전 알림은 어디에서 확인하나요?',
    'ROUTEL은 어떻게 이용하나요?',
  ])].filter(q => !asked.has(q)).slice(0, 3)
})
function saveHistory() {
  try {
    sessionStorage.setItem(historyKey, JSON.stringify({ owner: owner(), sessionId: conversationId.value, messages: messages.value
      .filter(m => !isPrivateQuestion(m.text)).slice(-40).map(m => ({ role: m.role, text: m.text.slice(0, 6000) })) }))
  } catch { /* Storage may be unavailable; the current conversation still stays in memory. */ }
}
onMounted(() => {
  for(const src of Object.values(mascotSources)) { const image=new Image();image.src=src }
  try {
    const stored = JSON.parse(sessionStorage.getItem(historyKey) || 'null')
    if (stored?.owner === owner() && Array.isArray(stored.messages)) {
      if (/^[0-9a-f-]{36}$/i.test(stored.sessionId || '')) conversationId.value = stored.sessionId
      messages.value = stored.messages.filter((m: { role?: unknown; text?: unknown }) =>
        ['이용자', 'ROUTEL AI', '안내'].includes(String(m?.role)) && typeof m?.text === 'string' && m.text.length <= 6000,
      ).slice(-40)
    }
  } catch { /* Ignore an invalid or unavailable session history. */ }
})
watch(messages, saveHistory, { deep: true })
function askSuggestion(question: string) {
  entry.value = question
  void send()
}
let answerController: AbortController | undefined
function cancelAnswer() {
  answerController?.abort()
  answerController = undefined
  answerBusy.value = false
}
const position = ref<{ x: number; y: number }>(),
  dragging = ref(false)
const walkDirection=ref(1)
let drag: { id: number; x: number; y: number; left: number; top: number; lastX:number; lastReactionAt:number } | undefined,
  suppressClick = false
function place(x: number, y: number) {
  const rect = launcher.value?.getBoundingClientRect()
  if (!rect) return
  position.value = {
    x: Math.max(8, Math.min(x, innerWidth - rect.width - 8)),
    y: Math.max(8, Math.min(y, innerHeight - rect.height - 8)),
  }
}
function startDrag(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) return
  const rect = launcher.value!.getBoundingClientRect()
  suppressClick = false
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, lastX:event.clientX, lastReactionAt:0 }
  const caption = launcher.value?.querySelector('.chat-launcher-caption')?.getBoundingClientRect()
  if (caption && event.clientY < caption.top) {
    reactMascot()
    clearTimeout(holdTimer)
    holdTimer=setTimeout(()=>{if(drag&&!dragging.value&&mascotExpression.value!=='sulk')playMascot('cuddle')},650)
  }
  launcher.value!.setPointerCapture(event.pointerId)
}
function moveDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.id) return
  const dx = event.clientX - drag.x,
    dy = event.clientY - drag.y
  if (!dragging.value && Math.hypot(dx, dy) < 6) return
  clearTimeout(holdTimer)
  const horizontalStep = event.clientX - drag.lastX
  if(Math.abs(horizontalStep)>1)walkDirection.value=horizontalStep<0?-1:1
  if(!dragging.value) {
    clearTimeout(reactionTimer)
    reactionAnimation?.cancel()
    mascotAction.value=undefined
    mascotExpression.value='normal'
    mascotReaction.value='같이 걸어요~'
  }
  drag.lastX = event.clientX
  dragging.value = true
  suppressClick = true
  place(drag.left + dx, drag.top + dy)
}
function endDrag() {
  clearTimeout(holdTimer)
  if(dragging.value){mascotExpression.value='normal';mascotReaction.value='';pokeIntensity=0}
  drag = undefined
  dragging.value = false
}
function launch(event: MouseEvent) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  const caption = launcher.value?.querySelector('.chat-launcher-caption')?.getBoundingClientRect()
  if (event.detail > 0 && caption && event.clientY < caption.top) {
    return
  }
  void open()
}
function fitLauncher() {
  if (position.value) place(position.value.x, position.value.y)
}
function moveWithKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 40 : 10,
    deltas: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
  const delta = deltas[event.key]
  if (!delta) return
  event.preventDefault()
  const rect = launcher.value!.getBoundingClientRect()
  place(rect.left + delta[0], rect.top + delta[1])
}
onMounted(() => window.addEventListener('resize', fitLauncher))
function fitPanel() {
  if(appMode.value) {
    const shell=document.querySelector<HTMLElement>('.page-customer-app-account .ph,.service-app-layout')
    const rect=shell?.getBoundingClientRect()
    panelWidth.value=Math.min(rect?.width || window.innerWidth,window.innerWidth)
    appPanelLeft.value=Math.max(0,Math.min(rect?.left || 0,window.innerWidth-panelWidth.value))
    return
  }
  const pane = document.querySelector<HTMLElement>(
    '.page-c-map .app>aside:not([hidden]),.page-c-live-map .map-sidebar',
  )
  const rect = pane?.getBoundingClientRect()
  panelWidth.value =
    window.innerWidth <= 700
      ? Math.min(
          window.innerWidth,
          dialog.value?.open
            ? dialog.value.getBoundingClientRect().right
            : document.documentElement.clientWidth,
        )
      : rect && rect.left > window.innerWidth * 0.45
        ? Math.min(
            window.innerWidth,
            Math.max(
              340,
              (dialog.value?.open
                ? dialog.value.getBoundingClientRect().right
                : document.documentElement.clientWidth) - rect.left,
            ),
          )
        : Math.min(600, window.innerWidth)
}
async function open() {
  if(dialog.value?.open)return
  returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:undefined
  void backend('/api/faqs/popular?limit=5')
    .then((rows) => {
      popular.value = Array.isArray(rows) ? rows : []
    })
    .catch(() => {
      popular.value = []
    })
  fitPanel()
  dialog.value?.showModal()
  chatOpen.value = true
  window.addEventListener('resize', fitPanel)
  await nextTick()
  fitPanel()
  await nextTick()
  dialog.value?.querySelector('input')?.focus({ preventScroll: true })
}
function close() {
  const wasOpen=chatOpen.value
  chatOpen.value = false
  saveHistory()
  dialog.value?.close()
  window.removeEventListener('resize', fitPanel)
  if(wasOpen) {
    if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true})
    else launcher.value?.focus({ preventScroll: true })
  }
}
function openFromAccount() {if(appMode.value)void open()}
onMounted(()=>window.addEventListener('routel-public-chat-open',openFromAccount))
function outside(event: MouseEvent) {
  if (event.target !== dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    close()
}
watch(() => route.path+JSON.stringify(Object.entries(route.query).filter(([key])=>key!=='__view')), () => { close(); cancelAnswer() })
watch(() => `${app.account?.role}:${app.account?.id}`, () => {
  cancelAnswer()
  messages.value = []
  conversationId.value = crypto.randomUUID()
  entry.value = ''
  try { sessionStorage.removeItem(historyKey) } catch { /* Storage is optional. */ }
})
watch(
  () => [messages.value.length, answerBusy.value],
  async () => {
    await nextTick()
    messageList.value?.scrollTo({ top: messageList.value.scrollHeight })
  },
)
onBeforeUnmount(() => {
  clearTimeout(holdTimer)
  clearTimeout(reactionTimer)
  reactionAnimation?.cancel()
  window.removeEventListener('routel-public-chat-open',openFromAccount)
  cancelAnswer()
  window.removeEventListener('resize', fitPanel)
  window.removeEventListener('resize', fitLauncher)
})
async function send() {
  const question = entry.value.trim()
  if (!question || answerBusy.value) return
  messages.value.push({ role: '이용자', text: question })
  entry.value = ''
  answerBusy.value = true
  const controller = new AbortController()
  answerController = controller
  try {
    const privateQuestion = isPrivateQuestion(question)
    if (privateQuestion) {
      messages.value.push({
        role: '안내',
        text:
          app.account?.role === 'customer'
            ? '개인정보는 마이페이지에서 확인해 주세요.'
            : '먼저 로그인해 주세요.',
      })
      return
    }
    const history = messages.value
      .filter(message => message.role === 'ROUTEL AI' ||
        (message.role === '이용자' && !isPrivateQuestion(message.text)))
      .slice(-9)
      .map(message => ({ role: message.role === '이용자' ? 'user' : 'assistant', content: message.text.slice(0, 2000) }))
    const result = await backend<{ answer: string }>('/api/assistant/chat', {
      method: 'POST', body: { messages: history, sessionId: conversationId.value }, signal: controller.signal,
    })
    if (answerController === controller)
      messages.value.push({ role: 'ROUTEL AI', text: result.answer })
  } catch (e) {
    if (controller.signal.aborted || answerController !== controller) return
    messages.value.push({
      role: '안내',
      text: e instanceof Error ? e.message : 'AI 답변을 불러오지 못했습니다.',
    })
  } finally {
    if (answerController === controller) {
      answerBusy.value = false
      answerController = undefined
    }
  }
}
</script>
<template>
  <button
    v-if="!appMode"
    ref="launcher"
    id="public-chat-launcher"
    class="public-chat-launcher public-chat-mascot"
    type="button"
    aria-label="챗봇 문의"
    aria-haspopup="dialog"
    title="루를 눌러 놀아 주세요 · 챗봇 문의 글자를 누르면 상담 · 끌어서 이동"
    :class="{'is-dragging':dragging,'is-reacting':!!mascotReaction,'is-walking':dragging,'faces-left':dragging&&walkDirection<0}"
    :data-reaction="mascotAction"
    :data-expression="mascotExpression"
    :style="position?{position:'fixed',left:position.x+'px',top:position.y+'px',right:'auto',bottom:'auto',margin:'0'}:undefined"
    @pointerdown="startDrag"
    @pointermove="moveDrag"
    @pointerup="endDrag"
    @pointercancel="endDrag"
    @lostpointercapture="endDrag"
    @keydown="moveWithKey"
    @click="launch"
  ><span v-if="!chatOpen" class="chat-mascot-reaction" :class="{'is-idle':!mascotReaction}" :role="mascotReaction?'status':undefined" :aria-hidden="!mascotReaction?true:undefined">{{mascotReaction||'…'}}</span><span v-if="mascotReaction" class="chat-mascot-mark" aria-hidden="true">{{mascotMark}}</span><img class="chat-launcher-mascot" :src="mascotSource" width="84" height="84" alt="" draggable="false" aria-hidden="true" /><span class="chat-launcher-caption">챗봇 문의</span></button>
  <WorkflowPage
    ref="dialog"
    class="drawer-dialog public-chat-dialog"
    :style="{width:panelWidth+'px',...(appMode?{left:appPanelLeft+'px',right:'auto',top:'0px',margin:'0',height:'100dvh'}:{})}"
    aria-labelledby="public-chat-title"
    @close="close"
    @cancel.prevent="close"
    @click="outside"
  >
    <header class="public-chat-header">
      <div>
        <small>ROUTEL HELP</small>
        <h2 id="public-chat-title">ROUTEL AI 도우미</h2>
      </div>
      <button class="ui-icon-button" type="button" aria-label="챗봇 닫기" @click="close">
          <UiIcon name="close" />
        </button>
    </header>
    <p class="public-chat-description">ROUTEL 이용 방법과 지하차도 정보를 AI에게 물어보세요. 중요한 통제 정보는 현황 화면에서 다시 확인해주세요.</p>
    <ol ref="messageList" class="chat-messages" aria-live="polite">
      <li v-if="!messages.length" class="public-chat-welcome">
        <div class="chat-welcome-intro">
          <img src="/brand/routel-ru-welcome-clean-v2-poster.png" width="56" height="56" alt="" />
          <div><b>무엇을 도와드릴까요?</b><p>궁금한 내용을 편하게 물어보세요.</p></div>
        </div>
        <RouterLink class="chat-welcome-faq" :to="appMode?'/customer-app/faq':'/info/faq'">자주 묻는 질문 확인 <span aria-hidden="true">↗</span></RouterLink>
        <div v-if="popular.length" class="chat-welcome-questions" aria-label="인기 질문">
          <button
            v-for="item in popular"
            :key="item.id"
            type="button"
            :disabled="answerBusy"
            @click="askSuggestion(item.question)"
          >
            <span>{{item.question}}</span><span class="chat-question-arrow" aria-hidden="true">↗</span>
          </button>
        </div>
      </li>
      <li v-for="(m,i) in messages" :key="i" :class="{'is-user':m.role==='이용자'}">
        <b>{{m.role}}</b>
        <ChatAnswer v-if="m.role==='ROUTEL AI'" :text="m.text" />
        <p v-else>{{m.text}}</p>
      </li>
      <li v-if="answerBusy" class="public-chat-thinking" role="status">
        <video v-if="chatOpen" src="/brand/routel-chat-mascot-transparent.webm" poster="/brand/routel-chat-mascot-transparent-poster.png" autoplay muted loop playsinline preload="metadata" aria-hidden="true"></video>
        <div><b>잠시만 기다려 주세요</b><p>루가 필요한 정보를 확인하고 있어요<span class="chat-thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span></p></div>
      </li>
      <li v-else-if="messages.at(-1)?.role==='ROUTEL AI'&&suggestions.length" class="public-chat-suggestions">
        <b>이런 내용도 물어보세요</b>
        <div><button v-for="question in suggestions" :key="question" type="button" @click="askSuggestion(question)">{{question}} <span aria-hidden="true">↗</span></button></div>
      </li>
    </ol>
    <form class="public-chat-form" @submit.prevent="send">
      <label for="public-chat-input">질문</label>
      <div class="public-chat-compose">
        <input
          id="public-chat-input"
          v-model="entry"
          placeholder="궁금한 내용을 입력하세요"
          autocomplete="off"
          required
          maxlength="2000"
        />
        <button type="submit" :disabled="answerBusy">{{answerBusy?'답변 중…':'보내기'}}</button>
      </div>
      <nav aria-label="챗봇 이용 안내">
        <RouterLink :to="appMode?'/customer-app/notices':'/c-notice'">공지사항</RouterLink>
        <RouterLink :to="appMode?'/customer-app/faq':'/info/faq'">FAQ</RouterLink>
        <RouterLink :to="appMode?'/customer-app/account/inquiries':'/my-inquiries'">문의하기</RouterLink>
      </nav>
      <small class="public-chat-privacy">외부 AI 전송 · 대화 저장 · 개인정보 입력 주의</small>
    </form>
  </WorkflowPage>
</template>
