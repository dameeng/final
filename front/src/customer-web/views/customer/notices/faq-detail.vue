<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import '../../../styles/views/customer/notices/detail.css'
const route = useRoute()
const item = ref<Record<string, unknown> | null>(null)
const error = ref('')
const id = String(route.params.id)
const base = `/api/faqs/${encodeURIComponent(id)}`
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
    <h1>자주 묻는 질문</h1>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!item">불러오는 중...</p>
    <article v-else>
      <h2>{{ item.question }}</h2>
      <p v-if="item.createdAt">{{ String(item.createdAt).slice(0, 16).replace('T', ' ') }}</p>
      <div class="board-detail-content">{{ item.answer }}</div>
    </article>
    <RouterLink to="/info/faq">목록으로</RouterLink>
  </main>
</template>