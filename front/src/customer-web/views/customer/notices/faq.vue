<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

type Row = { id: string; question: string; createdAt: string };
const PAGE_SIZE = 10;
const opened = ref<string | null>(null);
const answers = ref<Record<string, string>>({});
const answerErrors = ref<Record<string, string>>({});
const pendingAnswers = new Set<string>();
const loadingAnswer = ref<Record<string, boolean>>({});
async function toggleAnswer(id: string) {
  opened.value = opened.value === id ? null : id;
  if (opened.value !== id || id in answers.value || pendingAnswers.has(id)) return;
  pendingAnswers.add(id); loadingAnswer.value[id] = true; answerErrors.value[id] = '';
  try {
    const response = await fetch(`/api/faqs/${encodeURIComponent(id)}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok || body.success === false || !body.data) throw new Error(body.message || '답변을 불러오지 못했습니다.');
    answers.value[id] = String(body.data.answer ?? '');
  } catch (e) { answerErrors.value[id] = e instanceof Error ? e.message : '답변 조회 실패'; }
  finally { loadingAnswer.value[id] = false; pendingAnswers.delete(id); }
}
const rows = ref<Row[]>([]);
const query = ref("");
const page = ref(1);
const totalPages = ref(1);
const error = ref("");
let poll: ReturnType<typeof setInterval> | undefined;

// 검색어(keyword)는 서버 쿼리로 보내고, 목록은 페이지 단위로 받는다.
async function load() {
  try {
    const params = new URLSearchParams({ page: String(page.value), size: String(PAGE_SIZE) });
    if (query.value.trim()) params.set("keyword", query.value.trim());
    const response = await fetch(`/api/faqs?${params}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok || !Array.isArray(body.data?.items)) throw new Error(body?.message || "FAQ를 불러오지 못했습니다.");
    rows.value = body.data.items.map((item: Record<string, unknown>) => ({
      id: String(item.id), question: String(item.question ?? ""), createdAt: String(item.createdAt ?? ""),
    }));
    totalPages.value = Math.max(1, Number(body.data?.totalPages || 1));
    error.value = "";
  } catch (e) { error.value = e instanceof Error ? e.message : "FAQ를 불러오지 못했습니다."; }
}
function search() { page.value = 1; void load(); }
function reset() { query.value = ""; search(); }
function goTo(next: number) {
  if (next < 1 || next > totalPages.value || next === page.value) return;
  page.value = next;
  void load();
}
function move(step: number) { goTo(page.value + step); }
onMounted(() => { void load(); poll = setInterval(() => void load(), 30000); });
onBeforeUnmount(() => clearInterval(poll));
</script>
<template>
  <main class="routel-content-page">
    <h1>자주 묻는 질문</h1>
    <form @submit.prevent="search" class="faq-form">
      <label>검색 <input v-model.trim="query" type="search" placeholder="질문·답변" /></label
      ><button type="submit">검색</button><button type="button" @click="reset">초기화</button>
    </form>
    <p v-if="error" class="customer-feedback" role="alert">{{ error }}</p>
    <div class="faq-accordion">
      <section v-for="row in rows" :key="row.id" class="faq-item">
        <h2><button type="button" :aria-expanded="opened === row.id" :aria-controls="`faq-answer-${row.id}`" @click="toggleAnswer(row.id)"><span>{{ row.question || '질문' }}</span><span aria-hidden="true">{{ opened === row.id ? '−' : '+' }}</span></button></h2>
        <div v-if="opened === row.id" :id="`faq-answer-${row.id}`" class="faq-answer">
          <p v-if="loadingAnswer[row.id]" role="status">답변을 불러오는 중입니다.</p>
          <p v-else-if="answerErrors[row.id]" role="alert">{{ answerErrors[row.id] }} <button type="button" @click="opened=null; toggleAnswer(row.id)">다시 시도</button></p>
          <p v-else>{{ answers[row.id] || '등록된 답변이 없습니다.' }}</p>
        </div>
      </section>
      <p v-if="!rows.length">조회할 수 있는 정보가 없습니다.</p>
    </div>
    <!-- 10개 단위 페이징. 건수가 적어도 항상 표시합니다. -->
    <nav class="routel-pagination routel-page-numbers" aria-label="자주 묻는 질문 목록 페이지">
      <button type="button" :disabled="page <= 1" @click="move(-1)">이전</button>
      <button v-for="n in totalPages" :key="n" type="button" :aria-current="n === page ? 'page' : undefined" @click="goTo(n)">{{ n }}</button>
      <button type="button" :disabled="page >= totalPages" @click="move(1)">다음</button>
    </nav>
  </main>
</template>

<style scoped src="../../../styles/views/customer/notices/faq.css"></style>