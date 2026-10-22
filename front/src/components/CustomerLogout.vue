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
<style scoped src="../styles/components/customer-logout.css"></style>
