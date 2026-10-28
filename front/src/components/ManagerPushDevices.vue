<script setup lang="ts">
import {onMounted,onBeforeUnmount,ref} from 'vue'
import {backend} from '../services/backend'
const devices=ref<{id:number;platform:string;active:boolean}[]>([]),loading=ref(false),error=ref('')
const controller=new AbortController()
async function load(){loading.value=true;error.value='';try{const rows=await backend('/api/managers/me/device-tokens',{signal:controller.signal});if(!controller.signal.aborted)devices.value=Array.isArray(rows)?rows:[]}catch(e){if(!controller.signal.aborted)error.value=(e as Error).message}finally{if(!controller.signal.aborted)loading.value=false}}
function updated(){void load()}
function failed(){error.value='이 기기의 알림 연결을 완료하지 못했습니다. 다시 연결해 주세요.'}
onMounted(()=>{void load();window.addEventListener('routel:push-device-updated',updated);window.addEventListener('routel:push-device-error',failed)})
onBeforeUnmount(()=>{controller.abort();window.removeEventListener('routel:push-device-updated',updated);window.removeEventListener('routel:push-device-error',failed)})
</script>
<template><section class="manager-push-devices"><header><h2>알림 기기</h2><button type="button" :disabled="loading" @click="load">새로고침</button></header><p v-if="loading" role="status">알림 기기를 확인하고 있습니다.</p><p v-else-if="error" role="alert">{{error}}</p><ul v-else-if="devices.length"><li v-for="(device,index) in devices" :key="device.id">{{device.platform==='APP'?'모바일 앱':'웹 브라우저'}} {{index+1}} · {{device.active?'연결됨':'수신 중지'}}</li></ul><p v-else>연결된 알림 기기가 없습니다.</p></section></template>
<style scoped>.manager-push-devices{margin:16px 0;padding:18px 16px;border:1px solid var(--r-line);border-radius:14px;background:var(--r-surface);}header{display:flex;justify-content:space-between;align-items:center;gap:12px;}h2{margin:0;font-size:15px;}button{padding:6px 10px;min-height:34px;border:1px solid var(--r-line);border-radius:8px;background:var(--r-surface);color:inherit;}p,li{font-size:13px;line-height:1.7;}ul{padding-left:18px;}</style>
