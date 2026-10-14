<script setup lang="ts">
import EyeIcon from "../../shared/components/EyeIcon.vue";
import { ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { useApp } from "../composables/use-app";
import { api } from "../services/api";
const { state, loadFavorites } = useApp(),
  router = useRouter();
// 백엔드 로그인은 이메일이 아니라 아이디(loginId)로 합니다.
const loginId = ref(""),
  password = ref(""),
  showPassword = ref(false),
  error = ref(""),
  busy = ref(false);
async function login() {
  busy.value = true;
  error.value = "";
  try {
    state.user = await api.login(loginId.value.trim(), password.value);
    password.value = "";
    loadFavorites();
    await router.replace("/notifications");
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
function demoLogin() {
  state.user = {
    id: "demo-user",
    name: "시연 사용자",
    email: "demo@example.com",
  };
  router.replace("/notifications");
}
</script>
<template>
  <main>
    <h1>로그인</h1>
    <template v-if="state.demo"
      ><p>실제 계정 없이 기능을 확인하는 시연 로그인입니다.</p>
      <button @click="demoLogin">시연 사용자로 로그인</button></template
    >
    <form v-else @submit.prevent="login">
      <p>
        <label
          >아이디
          <input v-model="loginId" type="text" autocomplete="username" maxlength="50" required
        /></label>
      </p>
      <p>
        <label
          >비밀번호
          <span class="password-field"><input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            maxlength="64"
            required
        /><button type="button" :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 보기'" :aria-pressed="showPassword" @click="showPassword = !showPassword"><EyeIcon :hidden="showPassword" /></button></span></label>
      </p>
      <button :disabled="busy">{{ busy ? "로그인 중" : "로그인" }}</button>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
    <RouterLink to="/signup">회원가입</RouterLink>
  </main>
</template>