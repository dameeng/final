<script setup lang="ts">
import {ref} from 'vue'
defineOptions({inheritAttrs:false})
const value=defineModel<string>()
const visible=ref(false)
</script>

<template>
 <span class="password-input">
  <input v-bind="$attrs" v-model="value" :type="visible?'text':'password'">
  <button class="password-visibility" type="button" :disabled="!!$attrs.disabled" :aria-label="visible?'비밀번호 숨기기':'비밀번호 보기'" :aria-pressed="visible" @click="visible=!visible">
   <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>
    <circle cx="12" cy="12" r="3"/>
    <path v-if="!visible" d="m3 3 18 18" stroke-width="2.2"/>
   </svg>
  </button>
 </span>
</template>

<style>
.password-input{position:relative;display:block;min-width:0;width:100%}
.password-input>input{box-sizing:border-box;width:100%;padding-right:48px!important}
.password-input>.password-visibility{position:absolute;right:2px;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;width:42px;height:40px;min-height:0;padding:0;margin:0;border:0;border-radius:6px;background:transparent;color:var(--ink-sub,#64748b);cursor:pointer;box-shadow:none}
.password-input>.password-visibility:focus-visible{outline:2px solid currentColor;outline-offset:-3px}
.password-input>.password-visibility:disabled{cursor:default;opacity:.5}
.password-input input::-ms-reveal{display:none}
</style>
