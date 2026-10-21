<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '../stores/app'
import '../styles/admin-app-9.css'
const router = useRouter(),
  store = useApp()
const weather = ref(false)
const clock = ref(Date.now())
let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(() => (clock.value = Date.now()), 1000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>
<template>
  <div class="wire-page mobile-page page-admin-app-9">
    <div class="ph adm">
      <div class="ah">
        <span>예지보전</span>
        <span class="inl-683edd9226"></span>
        <a class="app-bell" href="/admin-app/screen-13">알림</a>
        <button
          class="ui-icon-button theme-toggle"
          type="button"
          aria-label="라이트·다크 전환"
          @click="store.themeToggle()"
        >
          <UiIcon name="theme" />
        </button>
      </div>
      <div
        v-if="store.bannerAt > 0 &amp;&amp; clock-store.bannerAt&lt;300000"
        class="urgent-app-banner"
        role="alert"
      >초량1지하차도 위험 · 통제 상태를 확인하세요.</div>
      <div class="bd">
        <label>시설<select aria-label="시설 선택">
            <option>전체</option>
            <option>초량1지하차도</option>
            <option>초량2지하차도</option>
            <option>우장춘지하차도</option>
          </select>
        </label>
        <div class="chips">
          <button class="chip on" type="button">전체</button>
          <button class="chip" type="button">배수펌프</button>
          <button class="chip" type="button">전광판</button>
          <button class="chip" type="button">CCTV</button>
        </div>
        <div
          class="row"
          @click="router.push('/admin-app/screen-10')"
          role="button"
          tabindex="0"
          @keydown.enter="router.push('/admin-app/screen-10')"
        >
          <div class="g">
            <b>P-01 배수펌프</b>
            <small>초량1지하차도 · ▲34</small>
          </div>
          <b>82</b>
          <span class="lv d">위험</span>
        </div>
        <div
          class="row"
          @click="router.push('/admin-app/screen-10')"
          role="button"
          tabindex="0"
          @keydown.enter="router.push('/admin-app/screen-10')"
        >
          <div class="g">
            <b>C-02 CCTV</b>
            <small>초량2지하차도 · ▲12</small>
          </div>
          <b>61</b>
          <span class="lv w">주의</span>
        </div>
        <div
          class="row"
          @click="router.push('/admin-app/screen-10')"
          role="button"
          tabindex="0"
          @keydown.enter="router.push('/admin-app/screen-10')"
        >
          <div class="g">
            <b>D-03 전광판</b>
            <small>우장춘지하차도 · ▲9</small>
          </div>
          <b>55</b>
          <span class="lv w">주의</span>
        </div>
        <div
          class="row"
          @click="router.push('/admin-app/screen-10')"
          role="button"
          tabindex="0"
          @keydown.enter="router.push('/admin-app/screen-10')"
        >
          <div class="g">
            <b>P-04 배수펌프</b>
            <small>범천지하차도 · ▲15</small>
          </div>
          <b>48</b>
          <span class="lv w">주의</span>
        </div>
        <div
          class="row"
          @click="router.push('/admin-app/screen-10')"
          role="button"
          tabindex="0"
          @keydown.enter="router.push('/admin-app/screen-10')"
        >
          <div class="g">
            <b>C-05 CCTV</b>
            <small>문현지하차도 · ▲1</small>
          </div>
          <b>31</b>
          <span class="lv s">안전</span>
        </div>
        <button
          class="btn inl-26d3d1951d"
          type="button"
          @click="router.push('/admin-app/screen-11')"
        >점검 대상·알림 3건 ›</button>
      </div>
      <div class="tb">
        <a class="" href="/admin-app/screen-3">
          <b>▦</b>현황</a>
        <a class="" href="/admin-app/screen-4">
          <b>◼</b>통제</a>
        <a class="on" href="/admin-app/screen-9">
          <b>⚙</b>예지보전</a>
        <a class="" href="/admin-app/screen-13">
          <b>◔</b>알림</a>
        <a class="" href="/admin-app/screen-14">
          <b>☰</b>더보기</a>
      </div>
    </div>
  </div>
</template>
