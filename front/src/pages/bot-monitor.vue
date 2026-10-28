<script setup lang="ts">
import AppPagination from '../components/AppPagination.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BackendLayout from '../components/BackendLayout.vue'
import ChatAnswer from '../components/ChatAnswer.vue'
import { backend, queryString } from '../services/backend'
import '../styles/chat-monitor.css'
type Turn = { id: string; sessionId: string; createdAt: string; question: string; answer?: string; result: string; durationMs: number }
type Stats = { total: number; answered: number; unanswered: number; successRate: number; sessions: number; daily: { date: string; count: number }[]; topQuestions: { question: string; count: number }[] }
const route = useRoute(), statistics = computed(() => route.path === '/bot-stats')
const days = ref(7), query = ref(''), result = ref(''), page = ref(1)
const logs = ref<{ items: Turn[]; totalItems: number; totalPages: number; page: number }>()
const stats = ref<Stats>(), busy = ref(false), error = ref(''), detailError = ref('')
const dialog = ref<HTMLDialogElement>(), conversation = ref<Turn[]>([]), detailBusy = ref(false)
let timer: ReturnType<typeof setInterval>, searchTimer: ReturnType<typeof setTimeout>, version = 0, detailVersion = 0, disposed = false
const time = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
const maxDaily = computed(() => Math.max(1, ...stats.value?.daily.map(d => d.count) || []))
async function load() {
  const request = ++version
  busy.value = true; error.value = ''
  try {
    if (statistics.value) {
      const data = await backend<Stats>('/api/assistant/admin/stats' + queryString({ days: days.value }))
      if (!disposed && request === version) stats.value = data
    } else {
      const data = await backend<NonNullable<typeof logs.value>>('/api/assistant/admin/logs' + queryString({ page: page.value, size:route.path.startsWith('/admin-app/')?5:undefined, q: query.value, result: result.value }))
      if (!disposed && request === version) { logs.value = data; page.value = data.page }
    }
  } catch (e) { if (!disposed && request === version) error.value = (e as Error).message }
  finally { if (!disposed && request === version) busy.value = false }
}
async function openDetail(row: Turn) {
  const request = ++detailVersion
  conversation.value = []; detailError.value = ''; detailBusy.value = true
  dialog.value?.showModal()
  try {
    const data = await backend<{ messages: Turn[] }>('/api/assistant/admin/logs/' + row.id)
    if (!disposed && request === detailVersion) conversation.value = data.messages
  } catch (e) { if (!disposed && request === detailVersion) detailError.value = (e as Error).message }
  finally { if (!disposed && request === detailVersion) detailBusy.value = false }
}
function closeDetail() { detailVersion++; dialog.value?.close() }
function outside(event: MouseEvent) {
  if (event.target !== dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDetail()
}
function movePage(next: number) { page.value = next; void load() }
watch(days, () => { stats.value = undefined; void load() })
watch([query, result], () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; void load() }, 300)
})
onMounted(() => { void load(); timer = setInterval(() => { if (!document.hidden && !busy.value && !dialog.value?.open) void load() }, 30000) })
onBeforeUnmount(() => { disposed = true; version++; detailVersion++; clearInterval(timer); clearTimeout(searchTimer) })
</script>
<template>
  <BackendLayout>
    <section class="chat-monitor" :aria-busy="busy">
      
      <header class="chat-monitor-heading service-heading"><h1><AdminPageIcon />챗봇</h1><button type="button" :disabled="busy" @click="load">새로고침</button></header>
      <nav class="chat-monitor-tabs" aria-label="챗봇 탭"><RouterLink to="/bot-logs" :aria-current="!statistics?'page':undefined">대화 로그</RouterLink><RouterLink to="/bot-stats" :aria-current="statistics?'page':undefined">통계</RouterLink></nav>
      <p v-if="error" role="alert" class="service-error">{{error}}</p>
      <p v-if="busy&&!stats&&!logs" role="status">대화 기록을 불러오는 중입니다…</p>
      <template v-if="statistics">
        <div class="chat-monitor-period" role="group" aria-label="조회 기간"><button v-for="n in [1,7,30]" :key="n" type="button" :aria-pressed="days===n" @click="days=n">{{n===1?'오늘':`최근 ${n}일`}}</button></div>
        <template v-if="stats">
          <div class="chat-monitor-kpis"><article v-for="card in [['질문 수',stats.total],['답변 성공률',stats.successRate+'%'],['답변 못 한 질문',stats.unanswered],['대화 세션 수',stats.sessions]]" :key="card[0]"><small>{{card[0]}}</small><strong>{{card[1]}}</strong></article></div>
          <div class="chat-monitor-split">
            <article class="chat-monitor-card"><h2>일별 질문 수</h2><div class="chat-monitor-chart" :style="{'--days':stats.daily.length}"><div v-for="day in stats.daily" :key="day.date"><span>{{day.count}}</span><div class="chat-monitor-bar-track"><i :style="{height:(day.count/maxDaily*100)+'%'}"></i></div><small>{{day.date.slice(5)}}</small></div></div><p v-if="!stats.total" class="chat-monitor-empty">이 기간에 저장된 대화가 없습니다.</p></article>
            <article class="chat-monitor-card"><h2>많이 물어본 질문 Top 5</h2><ol class="chat-monitor-top"><li v-for="row in stats.topQuestions" :key="row.question"><span>{{row.question}}</span><b>{{row.count}}회</b></li></ol><p v-if="!stats.topQuestions.length" class="chat-monitor-empty">질문이 저장되면 순위가 표시됩니다.</p></article>
          </div>
        </template>
      </template>
      <template v-else>
        <form class="chat-monitor-filters" @submit.prevent="page=1;load()"><label>결과<select v-model="result"><option value="">전체</option><option value="answered">답변함</option><option value="unanswered">답변 못 함</option></select></label><label>질문·답변 검색<input v-model="query" type="search" placeholder="검색어를 입력하세요" maxlength="200" /></label></form>
        <p v-if="logs">총 {{logs.totalItems}}건</p>
        <div class="chat-monitor-table"><table><thead><tr><th>시각</th><th>대화 세션</th><th>질문</th><th>결과</th><th>상세</th></tr></thead><tbody><tr v-for="row in logs?.items" :key="row.id"><td>{{time(row.createdAt)}}</td><td>이용자 {{row.sessionId.slice(0,8)}}</td><td>{{row.question}}</td><td><span class="chat-log-state" :class="{'is-failed':row.result!=='answered'}">{{row.result==='answered'?'답변함':'답변 못 함'}}</span></td><td><button type="button" @click="openDetail(row)">대화 보기</button></td></tr><tr v-if="logs&&!logs.items.length"><td colspan="5" class="chat-monitor-empty">저장된 대화가 없습니다.</td></tr></tbody></table></div>
        <AppPagination v-if="logs&&route.path.startsWith('/admin-app/')" :page="page" :pages="logs.totalPages" :disabled="busy" @change="movePage" />
        <nav v-else-if="logs" class="chat-monitor-pagination" aria-label="대화 로그 페이지"><button type="button" :disabled="page<=1||busy" @click="movePage(page-1)">이전</button><span>{{page}} / {{logs.totalPages}} 페이지</span><button type="button" :disabled="page>=logs.totalPages||busy" @click="movePage(page+1)">다음</button></nav>
      </template>
      <p class="chat-monitor-note">AI 연결 후 저장된 실제 질문·답변만 표시합니다. 개인정보는 입력하지 않도록 안내하며, 이메일·휴대전화 번호·API 키 형식은 저장 시 가립니다.</p>
    </section>
    <WorkflowPage ref="dialog" class="chat-log-dialog" aria-labelledby="chat-log-title" @click="outside" @cancel.prevent="closeDetail"><header><h2 id="chat-log-title">대화 기록</h2><button type="button" @click="closeDetail">닫기</button></header><div class="chat-log-dialog-body"><p v-if="detailBusy" role="status">대화를 불러오는 중입니다…</p><p v-if="detailError" role="alert">{{detailError}}</p><article v-for="turn in conversation" :key="turn.id"><small>{{time(turn.createdAt)}} · {{turn.result==='answered'?'답변함':'답변 못 함'}}</small><div class="chat-log-question"><b>이용자</b><p>{{turn.question}}</p></div><div class="chat-log-answer"><b>{{turn.result==='answered'?'ROUTEL AI':'안내'}}</b><ChatAnswer :text="turn.answer||'답변을 완료하지 못했습니다.'" /></div></article></div></WorkflowPage>
  </BackendLayout>
</template>
