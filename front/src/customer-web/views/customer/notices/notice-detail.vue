<script setup lang="ts">
import NoticePin from '../../../components/customer/notice-pin.vue'
import { displayDate } from '../../../utils/display-date'
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import '../../../styles/views/customer/notices/detail.css'
const route = useRoute()
const item = ref<Record<string, unknown> | null>(null)
const error = ref('')
const id = String(route.params.id)
const base = `/api/notices/${encodeURIComponent(id)}`
onMounted(async () => {
  try {
    const response = await fetch(base, { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok || !result.data) throw new Error(result.message || '내용을 불러오지 못했습니다.')
    item.value = result.data
  } catch (e) { error.value = (e as Error).message }
})
</script>
<template>
  <main class="routel-content-page board-detail">
    <h1>공지사항</h1>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!item">불러오는 중...</p>
    <article v-else>
      <h2><NoticePin v-if="item.important" /> {{ item.title }}</h2>
      <p>등록일 {{ displayDate(item.createdAt, true, "정보 없음") }}</p>
      <div class="board-detail-content">{{ item.content }}</div>
    </article>
    <RouterLink to="/info/notices">목록으로</RouterLink>
  </main>
</template>