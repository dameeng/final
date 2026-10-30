<script setup lang="ts">
import DisasterReportPreview from '../components/DisasterReportPreview.vue'
import { adminPageTitle } from '../data/adminTitles'
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
    adminPageTitle(route.path, section.value === 'history'
      ? '점검 이력'
      : section.value === 'contacts'
        ? '관할 담당자 연락처'
        : '통제 전달 문서'),
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
          <div class="inspection-history-list" role="list" aria-label="점검 이력 목록">
          <article v-for="row in rows" :key="String(row[0])+row[1]" class="history-record" role="listitem">
            <time>{{row[0]}}</time>
            <h2>{{row[1]}} · {{row[2]}}</h2>
            <p class="history-facility">{{row[3]}}</p>
            <p>{{row[4]}} · {{row[5]}}</p>
            <p class="history-result">{{row[7]}} · {{row[8]}} → {{row[9]}}점</p>
          </article>
          </div>
          <p v-if="!rows.length">검색 결과가 없습니다.</p>
        </template>
        <template v-else-if="section==='contacts'">
          <JurisdictionContactList />
        </template>
        <template v-else>
          <DisasterReportPreview :manager-region="admin.region" />
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
