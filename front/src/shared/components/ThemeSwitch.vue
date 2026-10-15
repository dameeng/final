<script setup lang="ts">
import {useTheme} from '../composables/theme'
const props=defineProps<{storageKey:string}>()
const mode=useTheme(props.storageKey)
</script>
<template><label class="routel-theme-switch"><span>화면 모드</span><select v-model="mode"><option value="light">라이트</option><option value="dark">다크</option></select></label></template>
<style src="../styles/customer-theme.css"></style>
