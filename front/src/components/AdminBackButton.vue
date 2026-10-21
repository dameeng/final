<script setup lang="ts">
import {useRouter} from 'vue-router'
const props=withDefaults(defineProps<{fallback?:string}>(),{fallback:'/admin-app/screen-3'}),router=useRouter()
function back(){const previous=router.options.history.state.back;if(typeof previous==='string'&&previous.startsWith('/admin-app/'))router.back();else void router.replace(props.fallback)}
</script>
<template><button type="button" class="admin-back-button" aria-label="이전 화면으로" @click="back"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></template>
<style scoped>.admin-back-button{display:inline-flex;align-items:center;justify-content:center;flex:0 0 32px;width:32px;height:36px;min-width:32px;min-height:36px;margin:0;padding:0;border:0;background:transparent;color:inherit;line-height:1;vertical-align:middle;cursor:pointer}.admin-back-button svg{display:block;position:static;width:20px;height:20px;flex:none}</style>
