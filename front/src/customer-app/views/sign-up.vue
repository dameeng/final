<script setup lang="ts">
import DemoPhoneVerification from "../../shared/components/DemoPhoneVerification.vue";
import EyeIcon from "../../shared/components/EyeIcon.vue";
import { ref, watch, onBeforeUnmount } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../services/api";
import { useApp } from "../composables/use-app";
const { state } = useApp();
const loginId = ref(""),
  name = ref(""),
  birthDate = ref(""),
  email = ref(""),
  code = ref(""),
  phone = ref(""),
  emergency = ref(""),
  zipcode = ref(""),
  roadAddress = ref(""),
  detailAddress = ref(""),
  password = ref(""),
  confirm = ref(""),
  showPassword = ref(false),
  showConfirm = ref(false),
  message = ref(""),
  idMessage = ref(""),
  busy = ref(false),
  done = ref(false),
  codeSent = ref(false),
  emailVerified = ref(false),
  cooldown = ref(0);
const phoneVerified = ref(false);
watch(phone, () => { phoneVerified.value = false; }, { flush: "sync" });
let cooldownTimer: ReturnType<typeof setInterval> | undefined;
// 이메일을 바꾸면 인증을 다시 받아야 합니다.
watch(email, () => {
  codeSent.value = false;
  emailVerified.value = false;
  code.value = "";
});
// 서버가 인증코드 재발송을 60초 간격으로 제한합니다. 코드는 3분 동안 유효합니다.
function startCooldown() {
  cooldown.value = 60;
  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    cooldown.value--;
    if (cooldown.value <= 0) clearInterval(cooldownTimer);
  }, 1000);
}
async function step(task: () => Promise<void>) {
  busy.value = true;
  message.value = "";
  try {
    await task();
  } catch (e) {
    message.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
const sendCode = () =>
  step(async () => {
    await api.sendEmailCode(email.value.trim());
    codeSent.value = true;
    startCooldown();
    message.value = "인증코드를 발송했습니다. 3분 안에 입력해 주세요.";
  });
const verifyCode = () =>
  step(async () => {
    await api.verifyEmailCode(email.value.trim(), code.value.trim());
    emailVerified.value = true;
    message.value = "이메일 인증을 완료했습니다.";
  });
async function checkId() {
  idMessage.value = "";
  if (!loginId.value.trim()) return;
  try {
    idMessage.value = (await api.checkLoginId(loginId.value.trim()))
      ? "사용할 수 있는 아이디입니다."
      : "이미 사용 중인 아이디입니다.";
  } catch (e) {
    idMessage.value = (e as Error).message;
  }
}
async function signup() {
  message.value = "";
  if (!phoneVerified.value || !phone.value.trim()) {
    message.value = "전화번호 인증을 먼저 완료해 주세요.";
    return;
  }
  if (password.value !== confirm.value) {
    message.value = "비밀번호가 일치하지 않습니다.";
    return;
  }
  if (!state.demo && !emailVerified.value) {
    message.value = "이메일 인증을 먼저 완료해 주세요.";
    return;
  }
  busy.value = true;
  try {
    if (!state.demo)
      await api.signup({
        loginId: loginId.value.trim(),
        password: password.value,
        passwordConfirm: confirm.value,
        name: name.value.trim(),
        birthDate: birthDate.value,
        email: email.value.trim(),
        phone: phone.value.trim(),
        emergency: emergency.value.trim(),
        zipcode: zipcode.value.trim(),
        roadAddress: roadAddress.value.trim(),
        detailAddress: detailAddress.value.trim(),
      });
    done.value = true;
    password.value = "";
    confirm.value = "";
    message.value = state.demo
      ? "입력 확인을 완료했습니다. 시연 모드이므로 계정은 생성하지 않았습니다."
      : "회원가입을 완료했습니다. 로그인해 주세요.";
  } catch (e) {
    message.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(() => clearInterval(cooldownTimer));
</script>
<template>
  <main>
    <h1>회원가입</h1>
    <p v-if="state.demo">
      시연 모드에서는 실제 개인정보를 입력하지 마세요. 입력값은 저장하지
      않습니다.
    </p>
    <form v-if="!done" @submit.prevent="signup">
      <p>
        <label
          >아이디
          <input v-model="loginId" required minlength="6" maxlength="50" autocomplete="username" @input="idMessage = ''"
        /></label>
        <button v-if="!state.demo" type="button" :disabled="busy || !loginId.trim()" @click="checkId">중복 확인</button>
      </p>
      <p v-if="idMessage" role="status">{{ idMessage }}</p>
      <p>영문·숫자·특수문자 6~50자, 공백 없이 입력해 주세요.</p>
      <p>
        <label
          >이름
          <input v-model="name" required maxlength="50" autocomplete="name"
        /></label>
      </p>
      <p>
        <label
          >생년월일
          <input v-model="birthDate" type="date" required autocomplete="bday"
        /></label>
      </p>
      <p>
        <label
          >이메일
          <input v-model="email" type="email" required maxlength="100" autocomplete="email" :disabled="emailVerified"
        /></label>
        <button
          v-if="!state.demo && !emailVerified"
          type="button"
          :disabled="busy || cooldown > 0 || !email.trim()"
          @click="sendCode"
        >
          {{ cooldown > 0 ? "재발송 (" + cooldown + "초)" : codeSent ? "인증코드 재발송" : "인증코드 발송" }}
        </button>
      </p>
      <p v-if="!state.demo && codeSent && !emailVerified">
        <label
          >인증코드 (6자리)
          <input v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"
        /></label>
        <button type="button" :disabled="busy || code.trim().length !== 6" @click="verifyCode">인증 확인</button>
      </p>
      <p v-if="!state.demo && emailVerified" role="status">이메일 인증이 완료되었습니다.</p>
      <DemoPhoneVerification v-model="phone" v-model:verified="phoneVerified" input-id="app-signup-phone" :disabled="busy" />
      <p>
        <label
          >긴급 연락처 (선택)
          <input v-model="emergency" type="tel" placeholder="010-1234-5678"
        /></label>
      </p>
      <!-- 주소 검색 API 없음: 우편번호·도로명주소는 직접 입력합니다. -->
      <p>
        <label
          >우편번호
          <input v-model="zipcode" required maxlength="10" autocomplete="postal-code"
        /></label>
      </p>
      <p>
        <label
          >도로명주소
          <input v-model="roadAddress" required maxlength="255" autocomplete="street-address"
        /></label>
      </p>
      <p>
        <label
          >상세주소 (선택)
          <input v-model="detailAddress" maxlength="255"
        /></label>
      </p>
      <p>
        <label
          >비밀번호
          <span class="password-field"><input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            minlength="8"
            maxlength="64"
            required
            autocomplete="new-password"
        /><button type="button" :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 보기'" :aria-pressed="showPassword" @click="showPassword = !showPassword"><EyeIcon :hidden="showPassword" /></button></span></label>
      </p>
      <p>영문·숫자·특수문자 8~64자, 공백 없이 입력해 주세요.</p>
      <p>
        <label
          >비밀번호 확인
          <span class="password-field"><input
            v-model="confirm"
            :type="showConfirm ? 'text' : 'password'"
            minlength="8"
            maxlength="64"
            required
            autocomplete="new-password"
        /><button type="button" :aria-label="showConfirm ? '비밀번호 확인 숨기기' : '비밀번호 확인 보기'" :aria-pressed="showConfirm" @click="showConfirm = !showConfirm"><EyeIcon :hidden="showConfirm" /></button></span></label>
      </p>
      <button :disabled="busy || !phoneVerified">{{ busy ? "확인 중" : "회원가입" }}</button>
    </form>
    <p role="status">{{ message }}</p>
    <RouterLink to="/login">로그인으로</RouterLink>
  </main>
</template>