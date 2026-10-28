<script setup lang="ts">
import {computed} from 'vue'
import {useRoute} from 'vue-router'
import UiIcon from './UiIcon.vue'
import type {UiIconName} from '../utils/ui-icons'
import {resourceRoutes} from '../data/backendResources'
const route=useRoute()
const icon=computed<UiIconName|null>(()=>{
  const path=route.path
  if(path.startsWith('/admin-app/')||path.startsWith('/customer-app/'))return null
  if(/^\/(?:c-|info\/|my-|login|signup|password-reset|find-id)/.test(path))return null
  if(path==='/admin-dashboard')return 'dashboard'
  if(path==='/admin-profile')return 'user'
  if(path.startsWith('/bot-'))return 'chat'
  if(path==='/admin-reports'||path==='/pm-daily')return 'chart'
  if(path==='/pm-history'||path==='/logs')return 'history'
  if(path==='/pm-settings')return 'settings'
  if(path.startsWith('/pm-'))return 'tool'
  if(path==='/jurisdiction-contacts')return 'user'
  const resource=path.startsWith('/admin-data/')?path.split('/').at(-1):resourceRoutes[path]
  const icons:Record<string,UiIconName>={facilities:'map',cameras:'camera',thresholds:'settings',display:'dashboard',presets:'document',reasons:'document',ocr:'camera',reviews:'eye',transits:'route',events:'history',transfers:'document',customers:'user',managers:'user',regions:'location',shifts:'history',alerts:'bell','manager-notifications':'bell',notices:'document',faqs:'help',inquiries:'chat'}
  return resource?icons[resource]||'document':null
})
</script>
<template><span v-if="icon" class="admin-page-icon" aria-hidden="true"><UiIcon :name="icon" /></span></template>
