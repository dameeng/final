<script setup lang="ts">
defineProps<{ name: string }>();
const paths: Record<string, string> = {
 menu: 'M4 6h16M4 12h16M4 18h16', close: 'M6 6l12 12M18 6L6 18',
 home: 'M3 10l9-7 9 7M5 9v12h5v-7h4v7h5V9',
 map: 'M9 4L3 6v15l6-2 6 2 6-2V4l-6 2-6-2zm0 0v15m6-13v15',
 bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
 user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2',
 weather: 'M7 17a4 4 0 1 1 1-8 6 6 0 0 1 11 3 3 3 0 0 1-1 6H7',
 arrow: 'M9 5l7 7-7 7', refresh: 'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3'
};
</script>
<template><svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.map" /></svg></template>
