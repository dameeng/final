<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

const props = defineProps<{ text: string }>()
const router = useRouter()
const pageLabels: Record<string, string> = {
  '/c-map': '지하차도 현황 보기',
  '/info/faq': '자주 묻는 질문 보기',
  '/c-notice': '공지사항 보기',
  '/my-inquiries': '문의하기',
}
// Render supported formatting as Vue text nodes; never interpret AI output as HTML.
const lines = computed(() => props.text.split(/\r?\n/).map(line => {
  const bullet = /^\s*(?:[-*•]|\d+\.)\s+/.test(line)
  const source = line.replace(/^\s*(?:[-*•]|\d+\.)\s+/, '').replace(/^#{1,6}\s+/, '')
    // Accept the misplaced closing bracket sometimes returned by the model.
    .replace(/\[([^\]\n]+?)\((\/[^\s)]+)\)\]/g, '[$1]($2)')
  const tokens: { text: string; kind?: string; href?: string }[] = []
  const pattern = /\*\*([^*\n]+)\*\*|`([^`\n]+)`|\[([^\]\n]+)\]\(([^\s)]+)\)|\/(?:c-map|info\/faq|c-notice|my-inquiries)(?![a-zA-Z0-9/_?=&%#.-])/g
  let end = 0
  for (const match of source.matchAll(pattern)) {
    tokens.push({ text: source.slice(end, match.index) })
    if (match[1]) tokens.push({ text: match[1], kind: 'strong' })
    else if (match[2]) tokens.push({ text: pageLabels[match[2]] || match[2], href: pageLabels[match[2]] ? match[2] : undefined })
    else {
      const path = match[4] || match[0]
      const safe = /^\/(?!\/)[a-zA-Z0-9/_?=&%#.-]*$/.test(path) && router.resolve(path).matched.length > 0
      tokens.push({ text: pageLabels[path] || match[3] || path, href: safe ? path : undefined })
    }
    end = match.index! + match[0].length
  }
  tokens.push({ text: source.slice(end) })
  return { bullet, tokens, empty: !source.trim() }
}))
</script>

<template>
  <div class="chat-answer">
    <div v-for="(line, index) in lines" :key="index" class="chat-answer-line"
      :class="{ 'is-bullet': line.bullet, 'is-empty': line.empty }">
      <span v-if="line.bullet" class="chat-answer-bullet" aria-hidden="true">•</span>
      <span><template v-for="(token, n) in line.tokens" :key="n"><RouterLink v-if="token.href" :to="token.href">{{ token.text }}</RouterLink><strong v-else-if="token.kind === 'strong'">{{ token.text }}</strong><template v-else>{{ token.text }}</template></template></span>
    </div>
  </div>
</template>
