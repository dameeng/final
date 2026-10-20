<script setup lang="ts">
import {computed} from 'vue'
import {useRoute} from 'vue-router'
import ServiceAccount from './service-account.vue'
import ServiceResource from './backend-resource.vue'
const route=useRoute(),resource=computed(()=>['cars','inquiries'].includes(String(route.params.section)))
</script>
<template><ServiceResource v-if="resource"/><ServiceAccount v-else/></template>
