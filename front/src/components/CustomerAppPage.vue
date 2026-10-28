<script setup lang="ts">
import CustomerAppNav from './CustomerAppNav.vue'
import CustomerMobileHeader from './CustomerMobileHeader.vue'
import { useRoute } from 'vue-router'
import '../styles/customer-app-account.css'
defineProps<{ title: string }>()
const route=useRoute()
</script>
<template>
  <div class="wire-page mobile-page page-customer-app-account">
    <div class="ph">
      <CustomerMobileHeader :title="title" :back="route.path!=='/customer-app/screen-13'" />
      <main class="bd app-account-body"><slot /></main>
      <CustomerAppNav />
    </div>
  </div>
</template>
