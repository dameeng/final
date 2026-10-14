<script setup lang="ts">
import { computed, ref, watch } from 'vue';
const props = defineProps<{ modelValue: string; verified: boolean; inputId: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; 'update:verified': [value: boolean] }>();
const requested = ref(false), code = ref(''), message = ref('');
const validCode = computed(() => /^[0-9]+$/.test(code.value));
// This is a local demonstration only. No SMS API or server verification flag is used.
watch(() => props.modelValue, () => {
  requested.value = false; code.value = ''; message.value = '';
  emit('update:verified', false);
}, { flush: 'sync' });
watch(code, () => { emit('update:verified', false); message.value = ''; }, { flush: 'sync' });
function requestCode() {
  if (props.disabled || !props.modelValue.trim()) return;
  emit('update:verified', false); code.value = ''; requested.value = true;
  message.value = '인증번호를 입력한 뒤 인증 확인을 눌러 주세요.';
}
function verifyCode() {
  if (props.disabled || !requested.value || !props.modelValue.trim()) return;
  if (!validCode.value) { message.value = '인증번호에 숫자를 한 자리 이상 입력해 주세요.'; return; }
  emit('update:verified', true);
  message.value = '전화번호 인증이 완료되었습니다.';
}
</script>
<template>
  <div class="demo-phone-verification">
    <div class="demo-phone-field">
      <label :for="inputId">전화번호</label>
      <input :id="inputId" :value="modelValue" type="tel" autocomplete="tel" required :disabled="disabled" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
    </div>
    <div class="demo-phone-actions">
      <button type="button" :disabled="disabled || !modelValue.trim()" @click="requestCode">{{ requested ? '인증번호 다시 받기' : '인증번호 받기' }}</button>
    </div>
    <div v-if="requested" class="demo-phone-code">
      <label :for="inputId + '-code'">인증번호</label>
      <div class="demo-phone-row">
        <input :id="inputId + '-code'" v-model="code" type="text" inputmode="numeric" pattern="[0-9]+" autocomplete="one-time-code" required :readonly="verified" :disabled="disabled" placeholder="숫자 입력" />
        <button type="button" :disabled="disabled || !validCode || verified" @click="verifyCode">{{ verified ? '인증 완료' : '인증 확인' }}</button>
      </div>
    </div>
    <p v-if="message" class="demo-phone-message" role="status">{{ message }}</p>
  </div>
</template>
<style src="../styles/demo-phone-verification.css"></style>
