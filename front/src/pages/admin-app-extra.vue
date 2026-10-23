<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useApp } from '../stores/app'
import JurisdictionContactList from '../components/JurisdictionContactList.vue'
import { useAdminProfile } from '../stores/adminProfile'
import history from '../data/pm-history.json'
import '../styles/admin-app-14.css'
function printDocument() {
  window.print()
}
const route = useRoute(),
  app = useApp(),
  admin = useAdminProfile(),
  query = ref('')
const section = computed(() => route.path.split('/').at(-1)),
  title = computed(() =>
    section.value === 'history'
      ? '점검 이력'
      : section.value === 'contacts'
        ? '관할 담당자 연락처'
        : '통제 전달 문서',
  )
const rows = computed(() => history.H.filter((row) => row.join(' ').includes(query.value)))
</script>
<template>
  <div class="wire-page mobile-page page-admin-app-14">
    <div class="ph adm">
      <header class="ah">
        <RouterLink to="/admin-app/screen-14">‹</RouterLink>
        <span>{{title}}</span>
        <button
          type="button"
          class="ui-icon-button theme-toggle"
          aria-label="라이트·다크 전환"
          @click="app.themeToggle()"
        >
          <UiIcon name="theme" />
        </button>
      </header>
      <main class="bd app-extra-body">
        <template v-if="section==='history'">
          <p class="sub">구성 예시 · 실제 점검 기록 연동 전입니다.</p>
          <input
            v-model="query"
            type="search"
            placeholder="설비·시설·조치 내용 검색"
            aria-label="점검 이력 검색"
          />
          <article v-for="row in rows" :key="String(row[0])+row[1]" class="card">
            <small>{{row[0]}}</small>
            <h2>{{row[1]}} · {{row[2]}}</h2>
            <p>{{row[3]}}</p>
            <p>{{row[4]}} · {{row[5]}}</p>
            <p>{{row[7]}} · {{row[8]}} → {{row[9]}}점</p>
          </article>
          <p v-if="!rows.length">검색 결과가 없습니다.</p>
        </template>
        <template v-else-if="section==='contacts'">
          <JurisdictionContactList />
        </template>
        <template v-else>
          <p class="sub">구성 예시 · 실제 통제 문서가 아닙니다.</p>
          <article class="card">
            <h2>도로 통제 정보 전달서</h2>
            <dl>
              <dt>시설</dt>
              <dd>초량1지하차도</dd>
              <dt>구분</dt>
              <dd>통제 시작</dd>
              <dt>사유</dt>
              <dd>침수 위험</dd>
              <dt>통제 방식</dt>
              <dd>입구 차단 · 전광판 우회 안내</dd>
              <dt>담당 지역</dt>
              <dd>{{admin.region}}</dd>
            </dl>
          </article>
          <button type="button" class="btn" @click="printDocument">문서 인쇄 · PDF 저장</button>
        </template>
      </main>
      <nav class="tb">
        <RouterLink to="/admin-app/screen-3">현황</RouterLink>
        <RouterLink to="/admin-app/screen-4">통제</RouterLink>
        <RouterLink to="/admin-app/screen-9">예지보전</RouterLink>
        <RouterLink to="/admin-app/screen-13">알림</RouterLink>
        <RouterLink to="/admin-app/screen-14">더보기</RouterLink>
      </nav>
    </div>
  </div>
</template>
<style scoped src="../styles/pages/admin-app-extra.css"></style>
