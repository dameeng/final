<script setup lang="ts">
import {RouterLink} from 'vue-router'
import {useApp} from '../stores/app'
import CustomerAppNav from './CustomerAppNav.vue'
import '../styles/customer-app-account.css'
defineProps<{title:string}>()
const app=useApp()
</script>
<template><div class="wire-page mobile-page page-customer-app-account"><div class="ph"><header class="ah"><RouterLink to="/customer-app/screen-13" aria-label="마이페이지로 돌아가기">‹ {{title}}</RouterLink><RouterLink class="app-bell" to="/customer-app/screen-12" aria-label="알림"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15L6 17z M10 21h4"/></svg><span v-if="app.unread">{{app.unread}}</span></RouterLink><button class="theme-toggle" aria-label="라이트·다크 전환" @click="app.themeToggle()">◐</button></header><main class="bd app-account-body"><slot/></main><CustomerAppNav/></div></div></template>
