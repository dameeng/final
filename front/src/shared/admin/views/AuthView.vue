<script setup lang="ts">
import PageBack from "../../components/PageBack.vue"
import EyeIcon from "../../components/EyeIcon.vue";
import PasswordInput from "../../components/PasswordInput.vue";
import { inject, ref } from 'vue'
import '../styles/auth.css'
import { useRouter } from 'vue-router'
import { adminKey, refreshManagerProfile } from '../main'
const { state } = inject(adminKey)!
const loginBusy = ref(false)
const props = defineProps<{ mode: 'login' | 'signup' }>()
const router = useRouter()
const id = ref(''),
  password = ref(''),
  confirm = ref(''),
  showPassword = ref(false),
  showConfirm = ref(false),
  message = ref('')

async function api(path: string, body?: unknown) {
  const response = await fetch(`/api/managers${path}`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.success !== true) throw new Error(result?.message || '요청을 처리하지 못했습니다.')
  return result?.data
}

async function submit() {
  if (loginBusy.value) return
  loginBusy.value = true
  message.value = ''; state.authMessage = ''
  try {
    const result = await api('/login', { loginId: id.value.trim(), password: password.value })
    void result
    password.value = ''
    if (!await refreshManagerProfile()) throw new Error(state.authMessage || '관리자 정보를 확인하지 못했습니다.')
    await router.replace('/dashboard')
  } catch (error) {
    message.value = (error as Error).message
  } finally { loginBusy.value = false }
}

// ---- 회원가입 (MP-?? 직원확인 → 이메일 인증 → 계정 생성, 서버 세션에 employeeId를 들고 있는 3단계 흐름) ----
const signupStep = ref<1 | 2 | 3 | 4>(1)
const signupName = ref('')
const signupBirth = ref('')
const signupPhone = ref('')
const maskedEmail = ref('')
const signupCode = ref('')
const signupLoginId = ref('')
const signupPassword = ref('')
const signupPasswordConfirm = ref('')
const showSignupPassword = ref(false)
const showSignupConfirm = ref(false)
const signupBusy = ref(false)

async function checkEmployee() {
  if (signupBusy.value) return
  signupBusy.value = true; message.value = ''
  try {
    const data = await api('/signup/employee-check', { name: signupName.value.trim(), birthDate: signupBirth.value, phone: signupPhone.value.trim() })
    maskedEmail.value = data?.maskedEmail ?? ''
    signupStep.value = 2
    message.value = `인증코드를 ${maskedEmail.value}로 보냈습니다.`
  } catch (error) { message.value = (error as Error).message }
  finally { signupBusy.value = false }
}
async function resendCode() {
  if (signupBusy.value) return
  signupBusy.value = true; message.value = ''
  try { await api('/signup/email-code/resend'); message.value = '인증코드를 다시 보냈습니다.' }
  catch (error) { message.value = (error as Error).message }
  finally { signupBusy.value = false }
}
async function verifyCode() {
  if (signupBusy.value) return
  signupBusy.value = true; message.value = ''
  try {
    await api('/signup/email-code/verify', { code: signupCode.value.trim() })
    signupStep.value = 3
    message.value = '이메일 인증이 완료되었습니다. 계정 정보를 입력해 주세요.'
  } catch (error) { message.value = (error as Error).message }
  finally { signupBusy.value = false }
}
async function submitSignup() {
  if (signupBusy.value) return
  if (signupPassword.value !== signupPasswordConfirm.value) { message.value = '비밀번호가 일치하지 않습니다.'; return }
  signupBusy.value = true; message.value = ''
  try {
    await api('/signup', { loginId: signupLoginId.value.trim(), password: signupPassword.value, passwordConfirm: signupPasswordConfirm.value })
    signupStep.value = 4
    message.value = '가입 신청이 완료되었습니다. 최고관리자 승인 후 로그인할 수 있습니다.'
  } catch (error) { message.value = (error as Error).message }
  finally { signupBusy.value = false }
}

// ---- 비밀번호 재설정 (로그인 화면에서만) ----
const resetOpen = ref(false)
const resetStep = ref<1 | 2 | 3>(1)
const resetLoginId = ref('')
const resetCode = ref('')
const resetPassword = ref('')
const resetPasswordConfirm = ref('')
const showResetPassword = ref(false)
const resetBusy = ref(false)

function openReset() {
  resetOpen.value = true
  resetStep.value = 1
  resetLoginId.value = resetCode.value = resetPassword.value = resetPasswordConfirm.value = ''
  message.value = ''
}
async function requestReset() {
  if (resetBusy.value) return
  resetBusy.value = true; message.value = ''
  try {
    await api('/password-reset/request', { loginId: resetLoginId.value.trim() })
    resetStep.value = 2
    message.value = '가입 시 등록한 이메일로 인증코드를 보냈습니다.'
  } catch (error) { message.value = (error as Error).message }
  finally { resetBusy.value = false }
}
async function verifyReset() {
  if (resetBusy.value) return
  resetBusy.value = true; message.value = ''
  try {
    await api('/password-reset/verify', { code: resetCode.value.trim() })
    resetStep.value = 3
    message.value = '인증이 완료되었습니다. 새 비밀번호를 입력해 주세요.'
  } catch (error) { message.value = (error as Error).message }
  finally { resetBusy.value = false }
}
async function confirmReset() {
  if (resetBusy.value) return
  if (resetPassword.value !== resetPasswordConfirm.value) { message.value = '비밀번호가 일치하지 않습니다.'; return }
  resetBusy.value = true; message.value = ''
  try {
    await api('/password-reset/confirm', { newPassword: resetPassword.value, newPasswordConfirm: resetPasswordConfirm.value })
    resetOpen.value = false
    message.value = '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.'
  } catch (error) { message.value = (error as Error).message }
  finally { resetBusy.value = false }
}
</script>

<template>
  <section class="routel-admin-auth">
  <header>
    <h1>ROUTEL 관리자</h1>
    <p v-if="mode === 'login'">지하차도 침수 안전 관제</p>
  </header>

  <div class="routel-admin-auth-body">
        <PageBack v-if="mode === 'signup'" area="admin" />
        <h2>{{ mode === 'login' ? '로그인' : '회원가입' }}</h2>

        <form v-if="mode === 'login'" @submit.prevent="submit">
          <p>
            <label
              >아이디<br />
              <input v-model="id" autocomplete="username" :disabled="loginBusy" required />
            </label>
          </p>
          <p>
            <label
              >비밀번호<br />
              <span class="password-field"><input v-model="password" autocomplete="current-password" :disabled="loginBusy" :type="showPassword ? 'text' : 'password'" required />
              <button type="button" :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 보기'" :aria-pressed="showPassword" @click="showPassword = !showPassword"><EyeIcon :hidden="showPassword" /></button></span>
            </label>
          </p>
          <p v-if="message || state.authMessage" role="alert">{{ message || state.authMessage }}</p>
          <button type="submit" :disabled="loginBusy">{{ loginBusy ? '로그인 중…' : '로그인' }}</button>
        </form>

        <template v-else>
          <form v-if="signupStep === 1" @submit.prevent="checkEmployee">
            <p>직원 확인 후 등록된 이메일로 인증코드를 보내드립니다.</p>
            <p><label>이름<br /><input v-model="signupName" required /></label></p>
            <p><label>생년월일<br /><input v-model="signupBirth" type="date" required /></label></p>
            <p><label>전화번호<br /><input v-model="signupPhone" type="tel" placeholder="010-1234-5678" required /></label></p>
            <button :disabled="signupBusy">{{ signupBusy ? '확인 중...' : '직원 확인' }}</button>
          </form>
          <form v-else-if="signupStep === 2" @submit.prevent="verifyCode">
            <p>{{ maskedEmail }}로 보낸 인증코드를 입력해 주세요.</p>
            <p><label>인증코드(6자리)<br /><input v-model="signupCode" inputmode="numeric" maxlength="6" required /></label></p>
            <button :disabled="signupBusy">{{ signupBusy ? '확인 중...' : '인증코드 확인' }}</button>
            <button type="button" :disabled="signupBusy" @click="resendCode">인증코드 재발송</button>
          </form>
          <form v-else-if="signupStep === 3" @submit.prevent="submitSignup">
            <p><label>아이디<br /><input v-model="signupLoginId" required /></label></p>
            <p>
              <label
                >비밀번호<br />
                <span class="password-field"><input v-model="signupPassword" :type="showSignupPassword ? 'text' : 'password'" required />
                <button type="button" :aria-label="showSignupPassword ? '비밀번호 숨기기' : '비밀번호 보기'" :aria-pressed="showSignupPassword" @click="showSignupPassword = !showSignupPassword"><EyeIcon :hidden="showSignupPassword" /></button></span>
              </label>
            </p>
            <p>
              <label
                >비밀번호 확인<br />
                <span class="password-field"><input v-model="signupPasswordConfirm" :type="showSignupConfirm ? 'text' : 'password'" required />
                <button type="button" :aria-label="showSignupConfirm ? '비밀번호 확인 숨기기' : '비밀번호 확인 보기'" :aria-pressed="showSignupConfirm" @click="showSignupConfirm = !showSignupConfirm"><EyeIcon :hidden="showSignupConfirm" /></button></span>
              </label>
            </p>
            <button :disabled="signupBusy">{{ signupBusy ? '가입 신청 중...' : '가입 신청' }}</button>
          </form>
          <p v-else>가입 신청이 완료되었습니다. 최고관리자 승인 후 로그인할 수 있습니다.</p>
        </template>

        <p v-if="mode !== 'login'" role="status">{{ message }}</p>
        <p>
          <router-link :to="mode === 'login' ? '/signup' : '/login'">{{
            mode === 'login' ? '관리자 회원가입' : '로그인으로'
          }}</router-link>
        </p>
        <template v-if="mode === 'login'">
          <p v-if="!resetOpen"><button type="button" @click="openReset">비밀번호 재설정</button></p>
          <form v-else-if="resetStep === 1" @submit.prevent="requestReset">
            <p><label>아이디<br /><input v-model="resetLoginId" required /></label></p>
            <button :disabled="resetBusy">{{ resetBusy ? '전송 중...' : '인증코드 받기' }}</button>
            <button type="button" @click="resetOpen = false">취소</button>
          </form>
          <form v-else-if="resetStep === 2" @submit.prevent="verifyReset">
            <p><label>인증코드(6자리)<br /><input v-model="resetCode" inputmode="numeric" maxlength="6" required /></label></p>
            <button :disabled="resetBusy">{{ resetBusy ? '확인 중...' : '인증코드 확인' }}</button>
            <button type="button" @click="resetOpen = false">취소</button>
          </form>
          <form v-else @submit.prevent="confirmReset">
            <p>
              <label
                >새 비밀번호<br />
                <span class="password-field"><input v-model="resetPassword" :type="showResetPassword ? 'text' : 'password'" required />
                <button type="button" :aria-label="showResetPassword ? '비밀번호 숨기기' : '비밀번호 보기'" :aria-pressed="showResetPassword" @click="showResetPassword = !showResetPassword"><EyeIcon :hidden="showResetPassword" /></button></span>
              </label>
            </p>
            <p><label>새 비밀번호 확인<br /><PasswordInput v-model="resetPasswordConfirm" autocomplete="new-password" required /></label></p>
            <button :disabled="resetBusy">{{ resetBusy ? '변경 중...' : '비밀번호 변경' }}</button>
            <button type="button" @click="resetOpen = false">취소</button>
          </form>
        </template>
        <router-link to="/dashboard">대시보드</router-link>
  </div>
  </section>
</template>