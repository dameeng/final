<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import BirthDateInput from './BirthDateInput.vue'
const open = defineModel<boolean>({ default: false }),
  props = defineProps<{ phone: string; name?: string; birthDate?: string }>(),
  emit = defineEmits<{ complete: [identity: { name: string; birthDate: string }] }>()
const dialog = ref<HTMLDialogElement>(),
  stage = ref(0),
  carrier = ref(''),
  name = ref(''),
  birthDate = ref(''),
  terms = ref([false, false, false, false]),
  remaining = ref(180)
const allAgreed = computed({
  get: () => terms.value.every(Boolean),
  set: (value) => (terms.value = terms.value.map(() => value)),
})
const phone = computed(() => props.phone)
let timer: ReturnType<typeof setInterval> | undefined
function stop() {
  clearInterval(timer)
  timer = undefined
}
watch(open, async (value) => {
  stop()
  if (value) {
    stage.value = 0
    carrier.value = ''
    terms.value = [false, false, false, false]
    name.value = props.name || ''
    birthDate.value = props.birthDate || ''
    remaining.value = 180
    await nextTick()
    dialog.value?.showModal()
  } else dialog.value?.close()
})
function request() {
  if (!carrier.value || !name.value.trim() || !birthDate.value || !allAgreed.value) return
  stage.value = 1
  remaining.value = 180
  stop()
  timer = setInterval(() => {
    remaining.value = Math.max(0, remaining.value - 1)
    if (!remaining.value) stop()
  }, 1000)
}
function finish() {
  stop()
  emit('complete', { name: name.value.trim(), birthDate: birthDate.value })
  open.value = false
}
onBeforeUnmount(() => {
  stop()
  dialog.value?.close()
})
</script>
<template>
  <dialog
    ref="dialog"
    class="pass-signup-dialog"
    aria-label="PASS 회원가입 본인인증"
    @cancel.prevent="open=false"
    @close="open=false"
  >
    <header>
      <strong class="pass-wordmark">PASS</strong>
      <span class="pass-demo-label">본인확인</span>
      <button class="ui-icon-button" type="button" aria-label="PASS 인증 닫기" @click="open=false">
          <UiIcon name="close" />
        </button>
    </header>
    <section v-if="stage===0">
      <p class="pass-eyebrow">ROUTEL 회원가입 · 휴대폰 본인확인</p>
      <h2>이용 중인 통신사를<br />선택해 주세요</h2>
      <div class="pass-carriers" role="group" aria-label="통신사 선택">
        <button
          v-for="item in ['SKT','KT','LG U+','SKT 알뜰폰','KT 알뜰폰','LG U+ 알뜰폰']"
          :key="item"
          type="button"
          :aria-pressed="carrier===item"
          @click="carrier=item"
        >
          {{item}}
        </button>
      </div>
      <form @submit.prevent="request">
        <label>이름<input v-model="name" aria-label="PASS 이름" autocomplete="name" required />
        </label>
        <label>생년월일<BirthDateInput v-model="birthDate" required />
        </label>
        <div class="pass-phone">
          <span>인증할 휴대전화</span>
          <input :value="phone" type="text" aria-label="인증할 휴대전화" readonly />
        </div>
        <div class="pass-agreements">
          <label class="pass-agree-all">
            <input v-model="allAgreed" type="checkbox" />필수 항목 전체 동의</label>
          <label
            v-for="(text,index) in ['본인확인 서비스 이용약관','개인정보 수집 및 이용','고유식별정보 처리','통신사 이용약관']"
            :key="text"
          >
            <input v-model="terms[index]" type="checkbox" />[필수] {{text}}
          </label>
        </div>
        <button
          class="pass-primary"
          type="submit"
          :disabled="!carrier||!name.trim()||!birthDate||!allAgreed"
        >PASS 인증 요청</button>
      </form>
    </section>
    <section v-else-if="stage===1" class="pass-waiting">
      <div class="pass-phone-icon" aria-hidden="true">
        <span>PASS</span>
        <b>✓</b>
      </div>
      <h2>PASS 앱에서<br />인증을 진행해 주세요</h2>
      <p>{{carrier}} · {{phone}}</p>
      <ol>
        <li>휴대전화로 전달된 인증 요청 확인</li>
        <li>PASS 앱에서 비밀번호 또는 생체인증</li>
        <li>인증 후 아래 완료 확인 선택</li>
      </ol>
      <p class="pass-time">남은 시간 <strong role="timer" aria-live="off">
          {{Math.floor(remaining/60)}}:{{String(remaining%60).padStart(2,'0')}}
        </strong>
      </p>
      <p v-if="!remaining" role="status">요청 시간이 만료되었습니다. 다시 요청해 주세요.</p>
      <button class="pass-primary" type="button" :disabled="!remaining" @click="stage=2;stop()">인증 완료 확인</button>
      <button class="pass-text-button" type="button" @click="request">인증 다시 요청</button>
      <button class="pass-text-button" type="button" @click="stage=0;stop()">통신사 다시 선택</button>
    </section>
    <section v-else class="pass-waiting">
      <div class="pass-complete" aria-hidden="true">✓</div>
      <h2>본인인증 화면 확인이<br />완료되었습니다</h2>
      <p>{{name}}님, 회원정보 입력을 계속해 주세요.</p>
      <button class="pass-primary" type="button" @click="finish">회원가입 계속하기</button>
    </section>
    <footer>PASS 연동 전 화면입니다. 실제 인증 요청·본인확인·회원가입은 진행되지 않습니다.</footer>
  </dialog>
</template>
<style scoped>
.pass-signup-dialog {
  width: min(430px,calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  padding: 0;
  border: 0;
  border-radius: 16px;
  background: #fff;
  color: #20252b;
  font:
    14px/1.6 Arial,'Malgun Gothic',sans-serif;
  overflow: auto;
}
.pass-signup-dialog::backdrop {
  background: #14243699;
}
.pass-signup-dialog header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 64px 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}
.pass-wordmark {
  color: #e52b3b;
  font-size: 28px;
  font-style: italic;
  font-weight: 900;
  letter-spacing: -1px;
}
.pass-demo-label {
  font-size: 11px;
  color: #64748b;
  background: #f2f4f7;
  padding: 3px 7px;
  border-radius: 4px;
}
.pass-signup-dialog header button {
  position: absolute;
  top: 16px;
  right: 16px;
  margin-left: auto;
  border: 0;
  background: transparent;
  font-size: 28px;
  line-height: 1;
  padding: 4px 8px;
  color: #475569;
  cursor: pointer;
}
.pass-signup-dialog section {
  padding: 24px 20px;
}
.pass-eyebrow {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 8px;
}
.pass-signup-dialog h2 {
  font-size: 24px;
  line-height: 1.45;
  margin: 0 0 24px;
  letter-spacing: -.6px;
}
.pass-carriers {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 8px;
  margin-bottom: 24px;
}
.pass-carriers button {
  min-height: 52px;
  padding: 8px 4px;
  background: #fff;
  border: 1px solid #d5dce3;
  border-radius: 8px;
  font: inherit;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}
.pass-carriers button[aria-pressed=true] {
  color: #d62034;
  border: 2px solid #e52b3b;
  background: #fff4f5;
}
.pass-signup-dialog form>label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}
.pass-signup-dialog input:not([type=checkbox]) {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #d5dce3;
  border-radius: 6px;
  font: inherit;
  color: #20252b;
  background: white;
}
.pass-phone {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #e5e7eb;
  font-size: 13px;
}
.pass-phone span {
  color: #64748b;
}
.pass-agreements {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 16px 0 24px;
}
.pass-agreements label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.pass-agreements input {
  width: 18px;
  height: 18px;
  flex: none;
  accent-color: #e52b3b;
}
.pass-agree-all {
  font-size: 14px!important;
  font-weight: 700;
  padding-bottom: 8px;
}
.pass-primary {
  display: block;
  width: 100%;
  min-height: 48px;
  padding: 12px;
  border: 0;
  border-radius: 8px;
  background: #e52b3b;
  color: white;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.pass-primary:disabled {
  background: #e5e7eb;
  color: #94a3b8;
  cursor: default;
}
.pass-waiting {
  text-align: center;
}
.pass-phone-icon {
  width: 92px;
  height: 136px;
  margin: 8px auto 24px;
  border: 3px solid #20252b;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #fff4f5;
}
.pass-phone-icon span {
  color: #e52b3b;
  font-size: 20px;
  font-weight: 900;
}
.pass-phone-icon b,.pass-complete {
  color: #e52b3b;
  font-size: 36px;
}
.pass-waiting ol {
  text-align: left;
  padding: 16px 16px 16px 36px;
  background: #f6f7f9;
  border-radius: 8px;
  font-size: 12px;
  line-height: 2;
}
.pass-time {
  color: #64748b;
  font-size: 13px;
}
.pass-time strong {
  color: #e52b3b;
  font-variant-numeric: tabular-nums;
}
.pass-text-button {
  display: block;
  margin: 16px auto 0;
  border: 0;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.pass-complete {
  width: 80px;
  height: 80px;
  margin: 16px auto 24px;
  border-radius: 50%;
  background: #fff0f2;
  display: grid;
  place-items: center;
}
.pass-signup-dialog footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  color: #64748b;
  font-size: 11px;
  text-align: center;
}
</style>
