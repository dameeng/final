<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { loginCustomer, customerRequest } from '../services/customerSession'
import NationalitySelect from '../components/NationalitySelect.vue'
import CarrierSelect from '../components/CarrierSelect.vue'
import VerificationCodeInput from '../components/VerificationCodeInput.vue'
import { useApp } from '../stores/app'
const app = useApp()
const route = useRoute(),
  router = useRouter()
const mode = computed(() => String(route.meta.auth || 'login'))
const form = reactive({
  loginId: '',
  phone: '',
  name: '',
  email: '',
  password: '',
  confirm: '',
  code: '',
})
const loading = ref(false),
  message = ref(
    route.query.reset === 'done' ? '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.' : '',
  ),
  resetStep = ref('request')
const title = computed(
  () =>
    ({ login: '로그인', signup: '회원가입', reset: '비밀번호 찾기', find: '아이디 찾기' })[
      mode.value
    ] || '로그인',
)
const phoneParts = reactive(['010', '', '']),
  country = ref('+82'),
  emailLocal = ref(''),
  emailDomain = ref(''),
  domainChoice = ref('naver.com')
const phoneInputs = ref<HTMLInputElement[]>([]),
  phoneRequested = ref(false),
  phoneMessage = ref(''),
  idMessage = ref('')
const phoneComplete = computed(
  () =>
    /^\d{3}$/.test(phoneParts[0] || '') &&
    /^\d{4}$/.test(phoneParts[1] || '') &&
    /^\d{4}$/.test(phoneParts[2] || ''),
)
watch([() => phoneParts.join(''), country], () => {
  phoneRequested.value = false
  phoneMessage.value = ''
  form.code = ''
})
watch(
  () => form.loginId,
  () => (idMessage.value = ''),
)
watch([emailLocal, emailDomain, domainChoice], () => {
  form.email =
    emailLocal.value +
    '@' +
    (domainChoice.value === 'custom' ? emailDomain.value : domainChoice.value)
})
function phoneInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value.replace(/\D/g, '').slice(0, index === 0 ? 3 : 4)
  phoneParts[index] = value
  input.value = value
  if (value.length === (index === 0 ? 3 : 4)) phoneInputs.value[index + 1]?.focus()
}
function pastePhone(event: ClipboardEvent) {
  const digits = (event.clipboardData?.getData('text') || '').replace(/\D/g, '')
  const local = digits.startsWith('82') && digits.length === 12 ? '0' + digits.slice(2) : digits
  if (local.length !== 11) return
  event.preventDefault()
  phoneParts.splice(0, 3, local.slice(0, 3), local.slice(3, 7), local.slice(7))
  phoneInputs.value[2]?.focus()
}
function requestPhone() {
  if (!phoneComplete.value) return
  form.phone = country.value + ' ' + phoneParts.join('-')
  phoneRequested.value = true
  phoneMessage.value = '문자 인증 서비스 연결 전입니다. 인증번호가 발송되지 않았습니다.'
}
function checkId() {
  idMessage.value = /^[a-zA-Z0-9_]{4,20}$/.test(form.loginId)
    ? '중복 확인 API 연결 후 사용 가능 여부를 확인할 수 있습니다.'
    : '아이디는 영문, 숫자, 밑줄로 4~20자 입력해 주세요.'
}
async function submit() {
  if (loading.value) return
  message.value = ''
  if (mode.value === 'signup' && form.password !== form.confirm) {
    message.value = '비밀번호 확인이 일치하지 않습니다.'
    return
  }
  if (mode.value === 'reset' && resetStep.value === 'confirm' && form.password !== form.confirm) {
    message.value = '새 비밀번호 확인이 일치하지 않습니다.'
    return
  }
  loading.value = true
  try {
    if (mode.value === 'login') {
      await loginCustomer(form.loginId, form.password)
      form.password = ''
      const next = String(route.query.next || '/')
      await router.replace(next.startsWith('/') && !next.startsWith('//') ? next : '/')
    } else if (mode.value === 'reset') {
      const body =
        resetStep.value === 'request'
          ? { loginId: form.loginId }
          : resetStep.value === 'verify'
            ? { code: form.code }
            : { newPassword: form.password, newPasswordConfirm: form.confirm }
      await customerRequest('/api/customers/password-reset/' + resetStep.value, body)
      if (resetStep.value === 'request') {
        resetStep.value = 'verify'
        message.value = '가입한 이메일로 인증코드를 요청했습니다.'
      } else if (resetStep.value === 'verify') {
        resetStep.value = 'confirm'
        message.value = '새 비밀번호를 입력해 주세요.'
      } else {
        await router.push('/login?reset=done')
      }
    } else
      message.value = '휴대폰 인증 서비스를 연결한 뒤 이용할 수 있습니다. 입력 내용은 유지됩니다.'
  } catch (e) {
    message.value = e instanceof Error ? e.message : '요청을 완료하지 못했습니다.'
  } finally {
    loading.value = false
  }
}
</script>
<template>
  <main class="wire-page customer-content auth-page">
    <h1>{{title}}</h1>
 <form @submit.prevent="submit">
      <template v-if="mode==='login'">
        <label>아이디<input v-model.trim="form.loginId" autocomplete="username" required />
        </label>
        <label>비밀번호<PasswordInput v-model="form.password" autocomplete="current-password" required />
        </label>
      </template>
  <template v-else-if="mode==='signup'">
        <p class="signup-progress">계정 정보 → 본인 정보·휴대폰 인증 → 가입 신청</p>
   <fieldset>
          <legend>계정 정보</legend>
    <label for="signup-id">아이디</label>
          <div class="auth-input-row">
            <input
              id="signup-id"
              v-model.trim="form.loginId"
              autocomplete="username"
              placeholder="영문·숫자 4~20자"
              pattern="[a-zA-Z0-9_]{4,20}"
              required
            />
            <button type="button" :disabled="!form.loginId" @click="checkId">중복 확인</button>
          </div>
          <p v-if="idMessage" role="status">{{idMessage}}</p>
    <label>비밀번호<PasswordInput
              v-model="form.password"
              autocomplete="new-password"
              placeholder="8자 이상 입력"
              minlength="8"
              required
            />
          </label>
    <label>비밀번호 확인<PasswordInput
              v-model="form.confirm"
              autocomplete="new-password"
              minlength="8"
              required
            />
          </label>
        </fieldset>
   <fieldset>
          <legend>본인 정보</legend>
          <NationalitySelect v-model="app.signupNationality" name="web-nationality" />
          <label>이름<input v-model.trim="form.name" autocomplete="name" required />
          </label>
    <div>
            <span id="email-label">이메일</span>
            <div class="auth-email-row" role="group" aria-labelledby="email-label">
              <input
                v-model.trim="emailLocal"
                aria-label="이메일 아이디"
                placeholder="이메일 아이디"
                autocomplete="off"
                pattern="[^\s@]+"
                required
              />
              <span>@</span>
              <input
                :value="domainChoice==='custom'?emailDomain:domainChoice"
                @input="emailDomain=($event.target as HTMLInputElement).value"
                :readonly="domainChoice!=='custom'"
                aria-label="이메일 도메인"
                placeholder="도메인 입력"
                pattern="[^\s@]+\.[^\s@]+"
                required
              />
              <select v-model="domainChoice" aria-label="이메일 도메인 선택">
                <option value="naver.com">naver.com</option>
                <option value="gmail.com">gmail.com</option>
                <option value="daum.net">daum.net</option>
                <option value="hanmail.net">hanmail.net</option>
                <option value="nate.com">nate.com</option>
                <option value="custom">직접 입력</option>
              </select>
            </div>
          </div>

    <CarrierSelect v-model="app.signupCarrier" />
          <div>
            <span id="phone-label">휴대폰 번호</span>
            <div
              class="auth-phone-row"
              role="group"
              aria-labelledby="phone-label"
              @paste="pastePhone"
            >
              <select
                class="auth-country-code"
                aria-label="국가번호"
                v-model="country"
                autocomplete="tel-country-code"
              >
                <option value="+82">+82 대한민국</option>
                <option value="+1">+1 미국·캐나다</option>
                <option value="+81">+81 일본</option>
                <option value="+86">+86 중국</option>
                <option value="+44">+44 영국</option>
                <option value="+61">+61 호주</option>
                <option value="+84">+84 베트남</option>
              </select>
              <template v-for="(_,index) in phoneParts" :key="index">
                <span v-if="index" aria-hidden="true">-</span>
                <input
                  :ref="el=>{if(el)phoneInputs[index]=el as HTMLInputElement}"
                  :value="phoneParts[index]"
                  @input="phoneInput(index,$event)"
                  @keydown.backspace="!phoneParts[index]&&phoneInputs[index-1]?.focus()"
                  :aria-label="['휴대폰 앞자리','휴대폰 가운데 4자리','휴대폰 마지막 4자리'][index]"
                  :placeholder="index===0?'010':index===1?'1234':'5678'"
                  type="tel"
                  inputmode="numeric"
                  :maxlength="index===0?3:4"
                  :pattern="index===0?'[0-9]{3}':'[0-9]{4}'"
                  required
                />
              </template>
            </div>
          </div>
    <div v-if="phoneComplete" class="phone-verification">
            <button type="button" @click="requestPhone">
              {{phoneRequested?'인증번호 다시 받기':'인증번호 받기'}}
            </button>
            <template v-if="phoneRequested">
              <label>인증번호<VerificationCodeInput
                  v-model="form.code"
                />
              </label>
              <button
                type="button"
                @click="phoneMessage='문자 인증 서비스 연결 후 인증번호를 확인할 수 있습니다.'"
              >인증 확인</button>
            </template>
            <p v-if="phoneMessage" role="status">{{phoneMessage}}</p>
          </div>
        </fieldset>
      </template>
  <template v-else-if="mode==='reset'">
        <label v-if="resetStep==='request'">아이디<input v-model.trim="form.loginId" autocomplete="username" required />
        </label>
        <label v-else-if="resetStep==='verify'">인증코드<input
            v-model.trim="form.code"
            inputmode="numeric"
            maxlength="6"
            pattern="[0-9]{6}"
            autocomplete="one-time-code"
            required
          />
        </label>
        <template v-else>
          <label>새 비밀번호<PasswordInput
              v-model="form.password"
              minlength="8"
              autocomplete="new-password"
              required
            />
          </label>
          <label>새 비밀번호 확인<PasswordInput
              v-model="form.confirm"
              minlength="8"
              autocomplete="new-password"
              required
            />
          </label>
        </template>
      </template>
  <template v-else>
        <label>휴대폰 번호<input v-model.trim="form.phone" type="tel" autocomplete="tel" required />
        </label>
        <label>이름<input v-model.trim="form.name" autocomplete="name" required />
        </label>
      </template>
  <button type="submit" :disabled="loading">
        {{loading?'처리 중…':mode==='reset'?(resetStep==='request'?'인증코드 받기':resetStep==='verify'?'인증 확인':'비밀번호 변경'):title}}
      </button>
  <p v-if="message" role="status">{{message}}</p>
    </form>
 <nav class="auth-links">
      <RouterLink to="/login">로그인</RouterLink>
      <RouterLink to="/signup">회원가입</RouterLink>
      <RouterLink to="/password-reset">비밀번호 찾기</RouterLink>
      <RouterLink to="/find-id">아이디 찾기</RouterLink>
      <RouterLink to="/">고객 홈</RouterLink>
    </nav>
  </main>
</template>
