<script setup lang="ts">
import UnifiedLogPanel from '../../shared/admin/components/UnifiedLogPanel.vue'
defineProps<{facilityId?:string;compact?:boolean}>()
</script>
<template><UnifiedLogPanel :facility-id="facilityId" :compact="compact"/></template>
