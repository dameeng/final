<script setup lang="ts">
import {ref} from 'vue'
import {useRouter,RouterLink} from 'vue-router'
import {useApp} from '../stores/app'
import '../styles/customer-app-1.css'
const router=useRouter(),store=useApp();const weather=ref(false)
function previewApp(){store.setMemberPreview(false);router.push('/customer-app/screen-5')}
</script>
<template><div class="wire-page mobile-page page-customer-app-1"><div class="ph"><div class="ah">ROUTEL<button class="theme-toggle" type="button" aria-label="라이트·다크 전환" @click="store.themeToggle()">◐</button></div><div class="bd"><div class="inl-e6f641e7d8"><div class="inl-0d0267131b">R</div><div class="inl-36662b6b14">ROUTEL</div><div class="sub inl-7a21c6ac49">지하차도 침수 알림 · 통제 확인</div></div><div class="inl-946a990a1e"></div><input class="inp" placeholder="아이디" aria-label="아이디" type="text" /><input class="inp" placeholder="비밀번호" aria-label="비밀번호" type="password" /><button class="btn p" type="button" @click="router.push('/customer-app/screen-5')">로그인</button><div class="customer-app-auth-footer"><div class="customer-app-signup"><RouterLink class="btn" to="/customer-app/screen-2">회원가입</RouterLink></div><button v-if="store.previewAvailable" class="customer-app-preview-entry" type="button" @click="previewApp">로그인 없이 고객앱 둘러보기 →</button><nav class="customer-app-find-links" aria-label="계정 찾기"><RouterLink to="/customer-app/find-id">아이디 찾기</RouterLink><span aria-hidden="true">|</span><RouterLink to="/customer-app/screen-4">비밀번호 찾기</RouterLink></nav><nav class="customer-app-help-links" aria-label="이용 안내"><RouterLink to="/customer-app/faq">FAQ</RouterLink></nav></div></div></div></div></template>
