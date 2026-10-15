<script setup lang="ts">
import DemoPhoneVerification from "../../../../shared/components/DemoPhoneVerification.vue";
import EyeIcon from "../../../../shared/components/EyeIcon.vue";
import { reactive, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { openPostcode } from '../../../services/postcode';
const router = useRouter();
function findPostcode() {
  void openPostcode((data) => { form.zipcode = data.zonecode; form.roadAddress = data.roadAddress || data.address; document.getElementById('signup-detail')?.focus(); }).catch((error) => { message.value = (error as Error).message; });
}

const form = reactive({
  username: "",
  password: "",
  confirm: "",
  name: "",
  email: "",
  birth: "",
  phone: "",
  zipcode: "",
  roadAddress: "",
  detailAddress: "",
});

const today = new Date().toLocaleDateString("sv-SE");
const loading = ref(false);
const showPassword = ref(false);
const showConfirm = ref(false);
const message = ref("");
const signupComplete = ref(false);
const usernameChecked = ref(false);
const emailChecked = ref(false);
const emailVerified = ref(false);
const phoneVerified = ref(false);
watch(() => form.phone, () => { phoneVerified.value = false; }, { flush: "sync" });
const verificationCode = ref("");
const usernameMessage = ref("");
const emailMessage = ref("");
const verificationMessage = ref("");
const checking = ref(false);
const emailLocal = ref("");
const emailDomain = ref("");
const emailDomainChoice = ref("custom");
const emailDomains = ["naver.com", "gmail.com", "daum.net", "kakao.com", "outlook.com"];

watch([emailLocal, emailDomain], () => {
  form.email = emailLocal.value.trim() && emailDomain.value.trim()
    ? `${emailLocal.value.trim()}@${emailDomain.value.trim()}` : "";
});
watch(emailDomainChoice, (choice) => {
  emailDomain.value = choice === "custom" ? "" : choice;
});

watch(() => form.username, () => { usernameChecked.value = false; usernameMessage.value = ""; });
watch(() => form.email, () => {
  emailChecked.value = false;
  emailVerified.value = false;
  verificationCode.value = "";
  emailMessage.value = "";
  verificationMessage.value = "";
});

async function checkAvailability(field: "username" | "email") {
  const value = form[field].trim();
  if (!value || checking.value) return;
  checking.value = true;
  try {
    const url = field === "username"
      ? `/api/customers/check-login-id?loginId=${encodeURIComponent(value)}`
      : `/api/customers/check-email?email=${encodeURIComponent(value)}`;
    const response = await fetch(url, { credentials: "include" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || "중복 확인을 완료하지 못했습니다.");
    const available = body?.data?.available ?? body?.available;
    if (typeof available !== "boolean") throw new Error("확인 결과를 받을 수 없습니다.");
    if (field === "username") {
      usernameChecked.value = available;
      usernameMessage.value = available ? "사용할 수 있는 아이디입니다." : "이미 사용 중인 아이디입니다.";
    } else {
      emailChecked.value = available;
      emailMessage.value = available ? "사용할 수 있는 이메일입니다." : "이미 사용 중인 이메일입니다.";
    }
  } catch (error) {
    if (field === "username") usernameMessage.value = (error as Error).message;
    else emailMessage.value = (error as Error).message;
  } finally {
    checking.value = false;
  }
}

async function emailCode(action: "send" | "verify") {
  if (checking.value || !emailChecked.value) return;
  checking.value = true;
  verificationMessage.value = "";
  try {
    const response = await fetch(action === "send" ? "/api/customers/email-code/send" : "/api/customers/email-code/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email, ...(action === "verify" ? { code: verificationCode.value.trim() } : {}) }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.success === false) throw new Error(body?.message || "인증을 완료하지 못했습니다.");
    if (action === "verify") emailVerified.value = true;
    verificationMessage.value = action === "send" ? "인증코드를 이메일로 보냈습니다." : "이메일 인증이 완료되었습니다.";
  } catch (error) {
    verificationMessage.value = (error as Error).message;
  } finally {
    checking.value = false;
  }
}

async function signup() {
  if (loading.value || signupComplete.value) return;

  message.value = "";

  if (!phoneVerified.value || !form.phone.trim()) {
    message.value = "전화번호 인증을 먼저 완료해 주세요.";
    return;
  }
  if (form.password !== form.confirm) {
    message.value = "비밀번호와 비밀번호 확인이 일치하지 않습니다.";
    return;
  }
  if (!usernameChecked.value || !emailChecked.value || !emailVerified.value) {
    message.value = "아이디 중복 확인과 이메일 인증을 완료해 주세요.";
    return;
  }

  loading.value = true;

  try {
    const response = await fetch("/api/customers/signup", {
      credentials: "include",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        loginId: form.username,
        password: form.password,
        passwordConfirm: form.confirm,
        name: form.name,
        email: form.email,
        birthDate: form.birth,
        phone: form.phone,
        zipcode: form.zipcode,
        roadAddress: form.roadAddress,
        detailAddress: form.detailAddress,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      message.value =
        typeof data?.message === "string"
          ? data.message
          : `회원가입에 실패했습니다. (오류 코드: ${response.status})`;
      return;
    }

    signupComplete.value = true;
    form.password = "";
    form.confirm = "";
    // 가입만 완료, 자동 로그인은 안 시키고 로그인 화면으로 보낸다
    await router.push("/login");
  } catch {
    message.value =
      "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="routel-content-page sign-up-main">
    <section class="sign-up-section">
      <h1 class="sign-up-h1">회원가입</h1>

      <form class="sign-up-form" @submit.prevent="signup">
        <fieldset class="sign-up-group">
          <legend>계정 정보</legend>
          <div class="sign-up-fields">
            <div class="sign-up-full">
              <label for="signup-id">아이디</label>
              <div class="sign-up-inline">
                <input id="signup-id" v-model.trim="form.username" autocomplete="username" required />
                <button type="button" :disabled="checking || !form.username" @click="checkAvailability('username')">중복 확인</button>
              </div>
              <p v-if="usernameMessage" class="sign-up-feedback" role="status">{{ usernameMessage }}</p>
            </div>
            <div>
              <label for="signup-password">비밀번호</label>
              <div class="password-field"><input id="signup-password" v-model="form.password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required />
              <button type="button" :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 보기'" :aria-pressed="showPassword" @click="showPassword = !showPassword"><EyeIcon :hidden="showPassword" /></button></div>
            </div>
            <div>
              <label for="signup-confirm">비밀번호 확인</label>
              <div class="password-field"><input id="signup-confirm" v-model="form.confirm" :type="showConfirm ? 'text' : 'password'" autocomplete="new-password" required />
              <button type="button" :aria-label="showConfirm ? '비밀번호 확인 숨기기' : '비밀번호 확인 보기'" :aria-pressed="showConfirm" @click="showConfirm = !showConfirm"><EyeIcon :hidden="showConfirm" /></button></div>
            </div>
          </div>
        </fieldset>

        <fieldset class="sign-up-group">
          <legend>이메일 인증</legend>
          <div class="sign-up-fields">
            <div class="sign-up-full">
              <label for="signup-email-local">이메일 주소</label>
              <div class="sign-up-email">
                <input id="signup-email-local" v-model.trim="emailLocal" autocomplete="email" placeholder="이메일 아이디" required />
                <span aria-hidden="true">@</span>
                <input v-if="emailDomainChoice === 'custom'" v-model.trim="emailDomain" aria-label="이메일 도메인 직접 입력" placeholder="도메인 입력" required />
                <span v-else class="sign-up-domain">{{ emailDomainChoice }}</span>
                <select id="signup-domain-choice" v-model="emailDomainChoice" aria-label="이메일 도메인 선택">
                  <option value="custom">직접 입력</option>
                  <option v-for="domain in emailDomains" :key="domain" :value="domain">{{ domain }}</option>
                </select>
              </div>
              <div class="sign-up-actions">
                <button type="button" :disabled="checking || !form.email" @click="checkAvailability('email')">이메일 중복 확인</button>
                <button type="button" :disabled="checking || !emailChecked || emailVerified" @click="emailCode('send')">인증코드 보내기</button>
              </div>
              <p v-if="emailMessage" class="sign-up-feedback" role="status">{{ emailMessage }}</p>
            </div>
            <div class="sign-up-full">
              <label for="signup-code">인증코드</label>
              <div class="sign-up-inline">
                <input id="signup-code" v-model.trim="verificationCode" inputmode="numeric" autocomplete="one-time-code" placeholder="메일로 받은 코드" />
                <button type="button" :disabled="checking || !emailChecked || !verificationCode || emailVerified" @click="emailCode('verify')">코드 확인</button>
              </div>
              <p v-if="verificationMessage" class="sign-up-feedback" role="status">{{ verificationMessage }}</p>
            </div>
          </div>
        </fieldset>

        <fieldset class="sign-up-group">
          <legend>기본 정보</legend>
          <div class="sign-up-fields">
            <div><label for="signup-name">이름</label><input id="signup-name" v-model.trim="form.name" autocomplete="name" required /></div>
            <div><label for="signup-birth">생년월일</label><input id="signup-birth" v-model="form.birth" type="date" :max="today" required /></div>
            <DemoPhoneVerification class="sign-up-full" v-model="form.phone" v-model:verified="phoneVerified" input-id="signup-phone" :disabled="loading" />
            <div class="sign-up-full"><label for="signup-zipcode">우편번호</label><div class="sign-up-inline"><input id="signup-zipcode" v-model.trim="form.zipcode" inputmode="numeric" required /><button type="button" @click="findPostcode">주소 검색</button></div></div>
            <div class="sign-up-full"><label for="signup-road">도로명주소</label><input id="signup-road" v-model.trim="form.roadAddress" autocomplete="street-address" required /></div>
            <div class="sign-up-full"><label for="signup-detail">상세주소 <span class="sign-up-optional">선택</span></label><input id="signup-detail" v-model.trim="form.detailAddress" /></div>
          </div>
        </fieldset>

        <button
          type="submit"
          :disabled="loading || signupComplete || !usernameChecked || !emailVerified || !phoneVerified"
        >
          {{
            signupComplete
              ? "가입 완료"
              : loading
                ? "가입 중..."
                : "회원가입"
          }}
        </button>

        <p v-if="message" class="sign-up-result" role="status">{{ message }}</p>
      </form>

      <nav class="sign-up-nav">
        <RouterLink to="/login">로그인</RouterLink>
        <RouterLink to="/">고객 홈</RouterLink>
      </nav>
    </section>
  </main>
</template>

<style scoped src="../../../styles/views/customer/auth/sign-up.css"></style>