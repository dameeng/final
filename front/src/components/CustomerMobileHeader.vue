<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '../stores/app'
import NotificationBell from './NotificationBell.vue'
import {workflowPageState} from '../utils/workflow-page-state'
withDefaults(defineProps<{title:string;back?:boolean;notifications?:boolean}>(),{notifications:true})
const route=useRoute(),router=useRouter(),app=useApp()
function goBack(){
  const previous=router.options.history.state.back
  if(typeof previous==='string'&&previous.startsWith('/customer-app/')&&previous!==route.fullPath&&!/\/screen-[1234](?:[?#]|$)/.test(previous)){router.back();return}
  const accountPage=/^\/customer-app\/(account\/|notices(?:\/|$)|faq(?:\/|$)|screen-12$)/.test(route.path)
  void router.push(accountPage?'/customer-app/screen-13':'/customer-app/screen-5')
}
</script>
<template>
  <header class="ah customer-mobile-header">
    <button v-if="back||workflowPageState.title" type="button" class="customer-header-back" aria-label="이전 화면으로" @click="goBack"><UiIcon name="back" /></button><span v-else class="customer-header-back-space" aria-hidden="true"></span>
    <strong class="customer-header-title">{{workflowPageState.title||title}}</strong>
    <NotificationBell v-if="notifications!==false" /><span v-else class="customer-header-bell-space" aria-hidden="true"></span>
    <button type="button" class="ui-icon-button theme-toggle" aria-label="라이트·다크 전환" @click="app.themeToggle()"><UiIcon name="theme" /></button>
  </header>
</template>
