<script setup lang="ts">
import EyeIcon from "./EyeIcon.vue";
import { ref } from 'vue'
defineOptions({inheritAttrs:false})
defineProps<{modelValue:string}>()
const emit=defineEmits<{ 'update:modelValue':[value:string] }>()
const visible=ref(false)
</script>
<template><span class="routel-password-input"><input v-bind="$attrs" :type="visible?'text':'password'" :value="modelValue" @input="emit('update:modelValue',($event.target as HTMLInputElement).value)"/><button type="button" :aria-label="visible?'비밀번호 숨기기':'비밀번호 표시'" :aria-pressed="visible" :disabled="Boolean($attrs.disabled)" @click="visible=!visible"><EyeIcon :hidden="visible" /></button></span></template>
<style src="../styles/password-input.css"></style>
