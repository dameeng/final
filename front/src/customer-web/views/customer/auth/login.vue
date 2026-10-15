<script setup lang="ts">
import EyeIcon from "../../../../shared/components/EyeIcon.vue";
import PasswordInput from "../../../../shared/components/PasswordInput.vue";
import { reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { setCustomerSession } from '../../../services/session';

const router = useRouter();

const form = reactive({
  username: "",
  password: "",
});

const loading = ref(false);
const showPassword = ref(false);
const message = ref("");

// 비밀번호 찾기: request(아이디로 인증코드 발송) → verify(코드 확인) → confirm(새 비밀번호). 세 단계가 같은 세션을 쓴다.
type ResetStep = "login" | "request" | "verify" | "confirm";
const step = ref<ResetStep>("login");
const reset = reactive({ loginId: "", code: "", newPassword: "", newPasswordConfirm: "" });

async function resetCall(path: string, body: unknown) {
  const response = await fetch(`/api/customers/password-reset/${path}`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) throw new Error(data?.message || "요청을 처리하지 못했습니다.");
}
async function submitReset() {
  if (loading.value) return;
  if (step.value === "confirm" && reset.newPassword !== reset.newPasswordConfirm) { message.value = "새 비밀번호 확인이 일치하지 않습니다."; return; }
  loading.value = true;
  message.value = "";
  try {
    if (step.value === "request") {
      await resetCall("request", { loginId: reset.loginId });
      message.value = "가입한 이메일로 인증코드를 보냈습니다.";
      step.value = "verify";
    } else if (step.value === "verify") {
      await resetCall("verify", { code: reset.code });
      message.value = "인증되었습니다. 새 비밀번호를 입력해 주세요.";
      step.value = "confirm";
    } else if (step.value === "confirm") {
      await resetCall("confirm", { newPassword: reset.newPassword, newPasswordConfirm: reset.newPasswordConfirm });
      Object.assign(reset, { loginId: "", code: "", newPassword: "", newPasswordConfirm: "" });
      step.value = "login";
      message.value = "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.";
    }
  } catch (error) {
    message.value = error instanceof Error ? error.message : "서버 응답을 확인할 수 없습니다.";
  } finally {
    loading.value = false;
  }
}
function openReset() { step.value = "request"; message.value = ""; }
function cancelReset() { step.value = "login"; message.value = ""; }

async function login() {
  if (loading.value) return;

  loading.value = true;
  message.value = "";

  try {
    const response = await fetch("/api/customers/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        loginId: form.username,
        password: form.password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      message.value =
        data.message || "아이디와 비밀번호를 확인해 주세요.";
      return;
    }

    if (data.data?.id == null) throw new Error('로그인 응답을 확인해 주세요.');
    setCustomerSession(data.data.id, data.data.name || '');
    form.password = "";
    await router.push('/');
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : "서버 응답을 확인할 수 없습니다. 백엔드 실행과 연결 설정을 확인해 주세요.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="routel-content-page login-main">
    <section class="login-section">
      <h1 class="login-h1">{{ step === "login" ? "로그인" : "비밀번호 찾기" }}</h1>

      <form v-if="step !== 'login'" class="login-form" @submit.prevent="submitReset">
        <label v-if="step === 'request'" class="login-label">
          아이디
          <input v-model.trim="reset.loginId" autocomplete="username" required />
        </label>
        <label v-else-if="step === 'verify'" class="login-label">
          인증코드 (숫자 6자리)
          <input v-model.trim="reset.code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required />
        </label>
        <template v-else>
          <label class="login-label">
            새 비밀번호
            <PasswordInput v-model="reset.newPassword" autocomplete="new-password" minlength="8" maxlength="64" required />
          </label>
          <label class="login-label-2">
            새 비밀번호 확인
            <PasswordInput v-model="reset.newPasswordConfirm" autocomplete="new-password" minlength="8" maxlength="64" required />
          </label>
        </template>

        <button type="submit" :disabled="loading">
          {{ loading ? "처리 중..." : step === "request" ? "인증코드 받기" : step === "verify" ? "인증코드 확인" : "비밀번호 변경" }}
        </button>
        <button type="button" @click="cancelReset">로그인으로 돌아가기</button>

        <p v-if="message" role="status">{{ message }}</p>
      </form>

      <form v-else class="login-form" @submit.prevent="login">
        <label class="login-label">
          아이디
          <input
            v-model.trim="form.username"
            autocomplete="username"
            required
          />
        </label>

        <label class="login-label-2">
          비밀번호
          <span class="password-field">
          <input
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            required
          />
          <button type="button" :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 보기'" :aria-pressed="showPassword" @click="showPassword = !showPassword"><EyeIcon :hidden="showPassword" /></button>
          </span>
        </label>

        <button type="submit" :disabled="loading">
          {{ loading ? "로그인 중..." : "로그인" }}
        </button>

        <p v-if="message" role="status">{{ message }}</p>
      </form>

      <nav class="login-nav">
        <RouterLink to="/signup">회원가입</RouterLink>
        <a href="#" @click.prevent="openReset">비밀번호 찾기</a>
        <RouterLink to="/">고객 홈</RouterLink>
      </nav>
    </section>
  </main>
</template>

<style scoped src="../../../styles/views/customer/auth/login.css"></style>