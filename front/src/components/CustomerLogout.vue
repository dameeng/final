<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '../stores/app'
import { logoutCustomer } from '../services/customerSession'
const app = useApp(),
  route = useRoute(),
  router = useRouter(),
  busy = ref(false),
  error = ref('')
async function logout() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (app.account) await logoutCustomer()
    else app.clearAccount()
    await router.push(route.path.startsWith('/customer-app/') ? '/customer-app/screen-1' : '/login')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <span v-if="app.account" class="customer-logout">
    <button type="button" :disabled="busy" @click="logout">
      {{busy?'로그아웃 중…':'로그아웃'}}
    </button>
    <span v-if="error" role="alert">{{error}}</span>
  </span>
</template>
<style scoped>
.customer-logout button {
  font: inherit;
  color: inherit;
  background: var(--surface,#fff);
  border: 1px solid var(--line,#c9ced6);
  padding: 8px 12px;
  border-radius: 6px;
  white-space: nowrap;
  cursor: pointer;
}
.customer-logout>[role=alert] {
  display: block;
  color: #b42318;
  font-size: 12px;
}
</style>
