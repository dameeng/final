<script setup lang="ts">
import '../styles/index.css'
import {adminSections} from '../data/adminNavigation'
</script>
<template>
  <main class="wire-page page-index">
    <header class="index-head"><div><p>ROUTEL · 관리자</p><h1>관리자 페이지 바로가기</h1><span>관리자 화면을 선택해 이동하세요.</span></div><RouterLink class="dashboard-link" to="/admin-dashboard">대시보드 열기 →</RouterLink></header>
    <section class="admin-grid" aria-label="관리자 메뉴">
      <article v-for="section in adminSections" :key="section.title" class="admin-section"><h2>{{ section.title }}</h2><nav><RouterLink v-for="link in section.links" :key="link[1]" :to="link[1]">{{ link[0] }}<span aria-hidden="true">→</span></RouterLink></nav></article>
    </section>
    <details class="other-pages"><summary>고객·앱 화면 미리보기</summary>
      <h2>고객 웹</h2><ul><li><RouterLink to="/c-map">지하차도 현황</RouterLink></li><li><RouterLink to="/c-app">서비스·앱 소개</RouterLink></li><li><RouterLink to="/c-notice">알림마당</RouterLink></li><li><RouterLink to="/c-auth">로그인·회원가입</RouterLink></li><li><RouterLink to="/my-home">마이페이지</RouterLink></li></ul>
      <h2>앱 화면</h2><ul><li><RouterLink to="/c-app-screens">고객 앱 화면</RouterLink></li><li><RouterLink to="/m-app-screens">관리자 앱 화면</RouterLink></li></ul>
    </details>
  </main>
</template>
<style scoped>
.page-index{max-width:1320px;margin:0 auto;padding:40px 28px;color:#1f2937}.index-head{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:28px 32px;border-radius:20px;background:#102a43;color:white}.index-head p{margin:0 0 8px;color:#a9c4dd;font-size:13px;font-weight:700;letter-spacing:.08em}.index-head h1{margin:0 0 8px;font-size:30px}.index-head span{color:#d3e0eb}.dashboard-link{flex:none;padding:14px 18px;border-radius:10px;background:#fff;color:#102a43;font-weight:700;text-decoration:none}.admin-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:20px}.admin-section{padding:20px;border:1px solid #dbe3eb;border-radius:16px;background:white}.admin-section h2{margin:0 0 14px;font-size:17px}.admin-section nav{display:grid;gap:8px}.admin-section nav a{display:flex;align-items:center;justify-content:space-between;min-height:44px;padding:10px 12px;border-radius:9px;background:#f5f8fb;color:#243b53;text-decoration:none}.admin-section nav a:hover,.admin-section nav a:focus-visible{background:#e4eef7;outline:2px solid #527da3}.other-pages{margin-top:28px;padding:16px 20px;border:1px solid #dbe3eb;border-radius:12px}.other-pages h2{font-size:15px}.other-pages ul{display:flex;flex-wrap:wrap;gap:12px 24px}.other-pages a{color:#315d82}@media(max-width:850px){.admin-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.page-index{padding:20px 14px}.index-head{align-items:flex-start;flex-direction:column;padding:22px}.index-head h1{font-size:24px}.admin-grid{grid-template-columns:1fr}}
</style>
