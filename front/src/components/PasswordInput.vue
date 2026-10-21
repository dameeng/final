<script setup lang="ts">
import { ref } from 'vue'
defineOptions({ inheritAttrs: false })
const value = defineModel<string>()
const visible = ref(false)
</script>

<template>
  <span class="password-input">
    <input v-bind="$attrs" v-model="value" :type="visible?'text':'password'" />
  <button
      class="password-visibility"
      type="button"
      :disabled="!!$attrs.disabled"
      :aria-label="visible?'비밀번호 숨기기':'비밀번호 보기'"
      :aria-pressed="visible"
      @click="visible=!visible"
    >
      <UiIcon :name="visible?'eye':'eyeOff'" />
    </button>
  </span>
</template>

<style>
.password-input {
  position: relative;
  display: block;
  min-width: 0;
  width: 100%;
}
.password-input>input {
  box-sizing: border-box;
  width: 100%;
  padding-right: 48px!important;
}
.password-input>.password-visibility {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--ui-control-size, 40px);
  height: var(--ui-control-size, 40px);
  min-height: 0;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-sub,#64748b);
  cursor: pointer;
  box-shadow: none;
}
.password-input>.password-visibility:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -3px;
}
.password-input>.password-visibility:disabled {
  cursor: default;
  opacity: .5;
}
.password-input input::-ms-reveal {
  display: none;
}
</style>
