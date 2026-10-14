<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { adminKey } from '../../shared/admin/main'
import { adminApi, regionsApi, type Region } from '../../shared/admin/services/admin-api'

type Pending = { id: number; loginId: string; name: string; email: string; phone: string; createdAt: string }
const { state } = inject(adminKey)!
const items = ref<Pending[]>([])
const regions = ref<Region[]>([])
const choices = ref<Record<number, number>>({})
const message = ref('')
const busy = ref(false)
const page = ref(1)
const totalPages = ref(1)
const isSuperAdmin = computed(() => state.profile?.role === 'SUPER_ADMIN')
async function load() {
  if (!isSuperAdmin.value) return
  try {
    const [pending, places] = await Promise.all([
      adminApi<{ items: Pending[]; totalPages: number }>(`/managers/pending?page=${page.value}&size=20`),
      regionsApi(),
    ])
    items.value = pending.items || []
    totalPages.value = pending.totalPages || 1
    regions.value = places
    for (const item of items.value) if (!choices.value[item.id] && places.length) choices.value[item.id] = places[0].id
  } catch (e) { message.value = (e as Error).message }
}
async function decide(id: number, action: 'approve' | 'reject') {
  if (busy.value) return
  if (action === 'reject' && !window.confirm('가입 신청을 거절할까요?')) return
  if (action === 'approve' && !choices.value[id]) { message.value = '담당 지역을 선택해 주세요.'; return }
  busy.value = true; message.value = ''
  try {
    await adminApi(`/managers/${id}/${action}`, { method: 'POST', ...(action === 'approve' ? { body: JSON.stringify({ regionId: choices.value[id] }) } : {}) })
    message.value = action === 'approve' ? '승인했습니다.' : '거절했습니다.'
    await load()
  } catch (e) { message.value = (e as Error).message }
  finally { busy.value = false }
}
watch(isSuperAdmin, (allowed) => { if (allowed) void load() }, { immediate: true })
</script>
<template>
<div class="routel-admin-page manager-approvals-page">
  <main>
    <h1>관리자 가입 승인</h1>
    <p v-if="!isSuperAdmin">최고관리자 계정에서 가입 신청을 확인할 수 있습니다.</p>
    <template v-else>
      <p v-if="message" role="status">{{ message }}</p>
      <button type="button" @click="load">새로고침</button>
      <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table">
        <thead><tr><th>신청자</th><th>아이디</th><th>이메일</th><th>신청일</th><th>담당 지역</th><th>처리</th></tr></thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>{{ item.name }}</td><td>{{ item.loginId }}</td><td>{{ item.email }}</td><td>{{ item.createdAt?.slice(0, 16).replace('T', ' ') }}</td>
            <td class="manager-approvals-region-cell"><select v-model.number="choices[item.id]" :aria-label="`${item.name} 담당 지역`"><option v-for="region in regions" :key="region.id" :value="region.id">{{ region.name }}</option></select></td>
            <td><button :disabled="busy" @click="decide(item.id, 'approve')">승인</button> <button :disabled="busy" @click="decide(item.id, 'reject')">거절</button></td>
          </tr>
          <tr v-if="!items.length"><td colspan="6">대기 중인 신청이 없습니다.</td></tr>
        </tbody>
      </table></div>
      <p class="admin-pagination"><button :disabled="page <= 1" @click="page--; load()">이전</button> {{ page }} / {{ totalPages }} <button :disabled="page >= totalPages" @click="page++; load()">다음</button></p>
    </template>
  </main>
</div>
</template>
