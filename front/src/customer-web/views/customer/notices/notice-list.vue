<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import NoticePin from "../../../components/customer/notice-pin.vue";
import { displayDate } from "../../../utils/display-date";
import { RouterLink } from "vue-router";
type Row = { id: string; title: string; important: boolean; createdAt: string };
const PAGE_SIZE = 10;
const PINNED_MAX = 50;
const rows = ref<Row[]>([]);
const query = ref("");
const category = ref("전체");
const page = ref(1);
const totalPages = ref(1);
const error = ref("");
let poll: ReturnType<typeof setInterval> | undefined;
const columns = [
  { key: "title", label: "제목" },
  { key: "createdAt", label: "작성일" },
] as const;
const options = ["전체", "중요", "일반"];

// 검색어(keyword, 제목+내용)와 분류(important)는 서버 쿼리로 보낸다.
// 서버 정렬은 최신순뿐이라, '전체'에서는 중요 공지를 따로 받아 첫 페이지 맨 위에 고정하고 나머지는 일반 공지만 페이징한다.
async function fetchNotices(important: boolean, pageNo: number, size: number) {
  const params = new URLSearchParams({ page: String(pageNo), size: String(size), important: String(important) });
  if (query.value.trim()) params.set("keyword", query.value.trim());
  const response = await fetch(`/api/notices?${params}`, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || "공지사항을 불러오지 못했습니다.");
  const items: Row[] = (body.data?.items ?? []).map((item: Record<string, unknown>) => ({
    id: String(item.id), title: String(item.title ?? ""), important: item.important === true, createdAt: String(item.createdAt ?? ""),
  }));
  return { items, totalPages: Math.max(1, Number(body.data?.totalPages || 1)) };
}
async function load() {
  try {
    if (category.value === "중요") {
      const result = await fetchNotices(true, page.value, PAGE_SIZE);
      rows.value = result.items; totalPages.value = result.totalPages;
    } else if (category.value === "일반") {
      const result = await fetchNotices(false, page.value, PAGE_SIZE);
      rows.value = result.items; totalPages.value = result.totalPages;
    } else {
      const [pinned, regular] = await Promise.all([
        page.value === 1 ? fetchNotices(true, 1, PINNED_MAX) : Promise.resolve({ items: [] as Row[], totalPages: 1 }),
        fetchNotices(false, page.value, PAGE_SIZE),
      ]);
      rows.value = [...pinned.items, ...regular.items];
      totalPages.value = regular.totalPages;
    }
    error.value = "";
  } catch (e) { error.value = e instanceof Error ? e.message : "공지사항을 불러오지 못했습니다."; }
}
function search() { page.value = 1; void load(); }
function reset() { query.value = ""; category.value = "전체"; search(); }
function goTo(next: number) {
  if (next < 1 || next > totalPages.value || next === page.value) return;
  page.value = next;
  void load();
}
function move(step: number) { goTo(page.value + step); }
watch(category, search);
onMounted(() => { void load(); poll = setInterval(() => void load(), 30000); });
onBeforeUnmount(() => clearInterval(poll));
function cell(row: Row, key: (typeof columns)[number]["key"]) {
  if (key === "createdAt") return displayDate(row.createdAt, false, "정보 없음");
  return row[key] || "—";
}
</script>
<template>
  <main class="routel-content-page">
    <h1>공지사항</h1>
    <form @submit.prevent="search" class="notice-list-form">
      <label>검색 <input v-model.trim="query" type="search" placeholder="제목·내용" /></label
      ><label
        >분류
        <select v-model="category">
          <option v-for="option in options" :key="option">{{ option }}</option>
        </select></label
      ><button type="submit">검색</button><button type="button" @click="reset">초기화</button>
    </form>
    <p v-if="error" class="customer-feedback" role="alert">{{ error }}</p>
    <div class="notice-list-div">
      <table class="notice-list-table">
        <caption>
          공지사항
        </caption>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key" scope="col">
              {{ column.label }}
            </th>
            
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td v-for="column in columns" :key="column.key" :class="{ 'notice-date': column.key === 'createdAt' }">
              <RouterLink v-if="column.key === 'title'" class="notice-title" :to="`/info/notices/${row.id}`"><NoticePin v-if="row.important" /><span>{{ row.title }}</span></RouterLink>
              <span v-else :title="displayDate(row.createdAt, true, '정보 없음')" :aria-label="displayDate(row.createdAt, true, '정보 없음')">{{ cell(row, column.key) }}</span>
            </td>
            
          </tr>
          <tr v-if="!rows.length">
            <td :colspan="columns.length">
              조회할 수 있는 정보가 없습니다.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- 10개 단위 페이징. 건수가 적어도 항상 표시합니다. -->
    <nav class="routel-pagination routel-page-numbers" aria-label="공지사항 목록 페이지">
      <button type="button" :disabled="page <= 1" @click="move(-1)">이전</button>
      <button v-for="n in totalPages" :key="n" type="button" :aria-current="n === page ? 'page' : undefined" @click="goTo(n)">{{ n }}</button>
      <button type="button" :disabled="page >= totalPages" @click="move(1)">다음</button>
    </nav>
  </main>
</template>

<style
  scoped
  src="../../../styles/views/customer/notices/notice-list.css"
></style>