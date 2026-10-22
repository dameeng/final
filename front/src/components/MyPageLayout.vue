<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useApp } from '../stores/app'
import CustomerLogout from './CustomerLogout.vue'
const app = useApp(),
  route = useRoute()
const menus = [
  ['내 정보', '/my-home'],
  ['알림 내역', '/my-alerts'],
  ['내 문의', '/my-inquiries'],
  ['회원 탈퇴', '/my-withdraw'],
]
</script>
<template>
  <div v-if="app.account?.role==='customer'" class="mypage-layout"
    ><aside class="mypage-sidebar" aria-label="마이페이지 메뉴"
      ><h2>마이페이지</h2
      ><nav
        ><RouterLink
          v-for="[label,to] in menus"
          :key="to"
          :to="to!"
          :aria-current="route.path===to?'page':undefined"
          >{{label
          }}<span
            v-if="to==='/my-alerts'&&app.unread"
            class="mypage-count"
            >{{app.unread}}</span
          ></RouterLink
        ></nav
      ><CustomerLogout /></aside
    ><div class="mypage-body"><slot /></div
  ></div>
</template>
<style scoped src="../styles/components/my-page-layout.css"></style>
