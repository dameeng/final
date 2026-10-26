<script setup lang="ts">
import { computed, ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { backend } from '../services/backend'
import { useApp } from '../stores/app'
import ChatAnswer from './ChatAnswer.vue'
import '../styles/public-chatbot.css'
const app = useApp(),
  dialog = ref<HTMLDialogElement>(),
  entry = ref(''),
  messages = ref<{ role: string; text: string }[]>([]),
  launcher = ref<HTMLButtonElement>()
const route = useRoute(),
  panelWidth = ref(560),
  messageList = ref<HTMLOListElement>()
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
let drag: { id: number; x: number; y: number; left: number; top: number } | undefined,
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
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
  launcher.value!.setPointerCapture(event.pointerId)
}
function moveDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.id) return
  const dx = event.clientX - drag.x,
    dy = event.clientY - drag.y
  if (!dragging.value && Math.hypot(dx, dy) < 6) return
  dragging.value = true
  suppressClick = true
  place(drag.left + dx, drag.top + dy)
}
function endDrag() {
  drag = undefined
  dragging.value = false
}
function launch() {
  if (suppressClick) {
    suppressClick = false
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
  chatOpen.value = false
  saveHistory()
  dialog.value?.close()
  window.removeEventListener('resize', fitPanel)
  launcher.value?.focus({ preventScroll: true })
}
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
watch(() => route.fullPath, () => { close(); cancelAnswer() })
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
    ref="launcher"
    class="public-chat-launcher"
    type="button"
    aria-haspopup="dialog"
    title="끌어서 위치 이동 · 방향키로 이동"
    :class="{'is-dragging':dragging}"
    :style="position?{position:'fixed',left:position.x+'px',top:position.y+'px',right:'auto',bottom:'auto',margin:'0'}:undefined"
    @pointerdown="startDrag"
    @pointermove="moveDrag"
    @pointerup="endDrag"
    @pointercancel="endDrag"
    @lostpointercapture="endDrag"
    @keydown="moveWithKey"
    @click="launch"
  >챗봇 문의</button>
  <dialog
    ref="dialog"
    class="drawer-dialog public-chat-dialog"
    :style="{width:panelWidth+'px'}"
    aria-labelledby="public-chat-title"
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
        <RouterLink class="chat-welcome-faq" to="/info/faq">자주 묻는 질문 확인 <span aria-hidden="true">↗</span></RouterLink>
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
        <RouterLink to="/c-notice">공지사항</RouterLink>
        <RouterLink to="/info/faq">FAQ</RouterLink>
        <RouterLink to="/my-inquiries">문의하기</RouterLink>
      </nav>
      <small class="public-chat-privacy">외부 AI 전송 · 대화 저장 · 개인정보 입력 주의</small>
    </form>
  </dialog>
</template>
