<script setup lang="ts">
defineProps<{ enabled?: boolean }>()
</script>
<template><span v-if="enabled === true" class="early-block-badge">선제 차단 대상</span></template>
<style scoped>
.early-block-badge { display:inline-flex; align-items:center; align-self:center; flex-shrink:0; padding:3px 9px; border:1px solid #f0d5a6; border-radius:6px; background:#fff4e3; color:#996019; font-size:12px; font-weight:600; line-height:20px; white-space:nowrap; }
:global(:root[data-theme=dark] .early-block-badge) { border-color:#877046; background:#403722; color:#f3d28a; }
</style>
