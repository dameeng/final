<script setup lang="ts">
import MenuIcon from '../components/MenuIcon.vue'
import AdminPageDirectory from '../components/AdminPageDirectory.vue'
import AdminSidebarNav from '../components/AdminSidebarNav.vue'
import AccountActions from '../components/AccountActions.vue'
import { reactive, ref } from 'vue'
import AdminIdentity from '../components/AdminIdentity.vue'
import { useAdminProfile, busanDistricts } from '../stores/adminProfile'
import { useApp } from '../stores/app'
const admin = useAdminProfile(),
  app = useApp(),
  draft = reactive({ ...admin.profile }),
  menu = ref(false),
  message = ref('')
function save() {
  try {
    admin.save({ ...draft, name: draft.name.trim() || '○○○' })
    message.value = '관리자 정보를 저장했습니다.'
  } catch {
    message.value = '저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'
  }
}
</script>
<template>
  <div class="wire-page page-admin-profile">
    <header class="profile-header">
      <button type="button" aria-label="관리자 메뉴 열기" :aria-expanded="menu" @click="menu=true">
        <MenuIcon />
      </button>
      <RouterLink to="/admin-dashboard">ROUTEL</RouterLink>
      <span>{{admin.region}} · {{admin.profile.name}}님</span>
      <button class="ui-icon-button" type="button" aria-label="라이트·다크 모드 전환" @click="app.themeToggle()">
          <UiIcon name="theme" />
        </button>
    </header>
 <div v-if="menu" class="profile-scrim" @click="menu=false"></div>
 <aside v-if="menu" class="profile-menu" aria-label="관리자 메뉴" @keydown.esc="menu=false">
      <div>
        <strong>관리자 메뉴</strong>
        <button type="button" @click="menu=false">닫기</button>
      </div>
      <AdminIdentity />
      <AdminSidebarNav />
    </aside>
 <main class="profile-main">
      <nav class="profile-crumb">
        <RouterLink to="/admin-dashboard">종합 현황</RouterLink>
        <span>›</span>
        <span>관리자 마이페이지</span>
      </nav>
      <div class="profile-title">
        <div>
          <h1>관리자 마이페이지</h1>
          <p>담당 지역과 관리자 정보를 관리합니다.</p>
        </div>
        <RouterLink to="/admin-dashboard">종합 현황으로 →</RouterLink>
      </div>
 <div class="profile-columns">
        <aside class="profile-summary">
          <span class="profile-avatar" aria-hidden="true">{{admin.profile.name.slice(0,1)}}</span>
          <h2>{{admin.profile.name}}님</h2>
          <p>{{admin.region}} · 지역 관리자</p>
          <dl>
            <dt>담당 지역</dt>
            <dd>{{admin.region}}</dd>
            <dt>부서</dt>
            <dd>{{admin.profile.department||'미등록'}}</dd>
            <dt>권한</dt>
            <dd>지역 관리자</dd>
          </dl>
        </aside>
 <form class="profile-form" @submit.prevent="save">
          <h2>기본 정보</h2>
          <p class="profile-note">현재 정보는 이 브라우저에 저장됩니다. 실제 계정 권한은 변경되지 않습니다.</p>
          <div class="profile-fields">
            <label>이름<input v-model="draft.name" required maxlength="30" autocomplete="name" />
            </label>
            <label>담당 지역<select v-model="draft.district" aria-label="담당 지역">
                <option v-for="district in busanDistricts" :key="district" :value="district">부산 {{district}}
                </option>
              </select>
            </label>
            <label>부서<input v-model="draft.department" maxlength="80" placeholder="예: 재난안전과" />
            </label>
            <label>연락처<input
                v-model="draft.phone"
                type="tel"
                maxlength="30"
                autocomplete="tel"
                placeholder="연락처 입력"
              />
            </label>
            <label class="profile-wide">이메일<input
                v-model="draft.email"
                type="email"
                maxlength="100"
                autocomplete="email"
                placeholder="이메일 입력"
              />
            </label>
          </div>
          <div class="profile-actions">
            <p role="status">{{message}}</p>
            <button type="submit">변경 사항 저장</button>
          </div>
        </form>
      </div>
 <AdminPageDirectory />
      <AccountActions />
    </main>
  </div>
</template>
<style scoped src="../styles/pages/admin-profile.css"></style>
