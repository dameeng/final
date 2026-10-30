<script setup lang="ts">
import ListResultCount from '../components/ListResultCount.vue'
import { onBeforeUnmount, ref } from 'vue'
import BackendLayout from '../components/BackendLayout.vue'
import UiIcon from '../components/UiIcon.vue'
import { jurisdictionContacts } from '../data/jurisdictionContacts'
import type { UiIconName } from '../utils/ui-icons'
const details: Record<string, { icon: UiIconName; category: string; description: string; tags: string[] }> = {
  road: { icon: 'route', category: '시설 관리', description: '도로 및 지하차도 시설 관련 사항을 확인하고 관리 기관과 협의하세요.', tags: ['도로 시설', '시설물 점검', '유지보수'] },
  community: { icon: 'map', category: '행정 지원', description: '지역 상황 공유와 주민 안내 등 관할 행정기관의 협조가 필요할 때 확인하세요.', tags: ['주민 안내', '지역 상황 공유', '행정 협조'] },
  police: { icon: 'user', category: '현장 협조', description: '현장 교통 상황과 차량 통제 등 경찰 협조가 필요한 사항을 전달하세요.', tags: ['교통 통제', '현장 질서', '안전 협조'] },
  civilian: { icon: 'tool', category: '민간 협력', description: '현장 지원 및 시설 복구와 관련해 민간 협력 기관과 소통하세요.', tags: ['현장 지원', '장비 협조', '복구 지원'] },
}
const copyStates = ref<Record<string, string>>({})
const copyTimers = new Map<string, ReturnType<typeof setTimeout>>()
async function copyPhone(id: string, phone: string) {
  try {
    await navigator.clipboard.writeText(phone)
    copyStates.value[id] = '복사 완료'
  } catch {
    copyStates.value[id] = '복사 실패'
  }
  clearTimeout(copyTimers.get(id))
  copyTimers.set(id, setTimeout(() => {
    delete copyStates.value[id]
    copyTimers.delete(id)
  }, 2200))
}
onBeforeUnmount(() => copyTimers.forEach(timer => clearTimeout(timer)))
</script>
<template>
  <BackendLayout :standard-menu="true">
    <section class="contacts-page">
      <div class="service-heading"><h1><AdminPageIcon />관할 담당자 연락처</h1></div>
      <div class="contacts-intro">
        <div><span class="eyebrow">ROUTEL · CONTACT DIRECTORY</span><h2>현장과 기관을 잇는<br>빠른 소통의 시작</h2><p>시설 관리부터 현장 협조까지, 필요한 담당 기관의 연락처를 한곳에서 확인하세요.</p></div>
        <div class="intro-stat"><UiIcon name="user" /><div><strong>{{ jurisdictionContacts.length }}<span>개 기관</span></strong><small>분야별 협력 연락처</small></div></div>
      </div>
      <div class="directory-heading"><div><h2>기관별 연락처</h2><p>업무에 맞는 담당 기관을 확인하세요.</p></div><span class="directory-label">관할 협력 기관</span></div>
      <ListResultCount :count="jurisdictionContacts.length" />
      <ul class="contact-grid" aria-label="관할 담당자 전화번호 목록">
        <li v-for="contact in jurisdictionContacts" :key="contact.id" class="directory-card" :class="contact.id">
          <div class="card-top"><span class="institution-icon"><svg v-if="contact.id === 'road'" class="ui-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3 4 21M17 3l3 18M12 3v3m0 5v3m0 5v2" /></svg><UiIcon v-else :name="details[contact.id]!.icon" /></span><span class="category">{{ details[contact.id]!.category }}</span></div>
          <h3>{{ contact.name }}</h3><p class="organization">{{ contact.organization }}</p>
          <p class="description">{{ details[contact.id]!.description }}</p>
          <div class="tags"><span v-for="tag in details[contact.id]!.tags" :key="tag">{{ tag }}</span></div>
          <div class="phone-panel"><div><span class="phone-label">담당 기관 연락처</span><strong v-if="contact.placeholder">{{ contact.phone }}</strong><a v-else-if="contact.phone" :href="'tel:' + contact.phone.replace(/[^\d+]/g, '')">{{ contact.phone }}</a><strong v-else>연락처 미등록</strong></div><button v-if="contact.phone" type="button" :aria-label="contact.name + ' ' + (copyStates[contact.id] || '번호 복사')" :class="{ 'is-copied': copyStates[contact.id] === '복사 완료' }" @click="copyPhone(contact.id, contact.phone)"><svg class="ui-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-if="copyStates[contact.id] === '복사 완료'" d="m5 12 4 4L19 6" /><g v-else><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" /></g></svg><span aria-live="polite">{{ copyStates[contact.id] || '번호 복사' }}</span></button></div>
        </li>
      </ul>
      <aside class="contact-guide"><span class="guide-icon"><UiIcon name="chat" /></span><div><h2>연락 전, 아래 내용을 준비해 주세요</h2><p>현장 정보를 함께 전달하면 담당 기관과 더 원활하게 소통할 수 있습니다.</p><div class="guide-steps"><span><b>01</b>시설명 및 위치</span><span><b>02</b>발생 상황 및 확인 시각</span><span><b>03</b>요청 사항 및 회신 연락처</span></div></div></aside>
    </section>
  </BackendLayout>
</template>
<style scoped src="../styles/pages/jurisdiction-contacts.css"></style>
