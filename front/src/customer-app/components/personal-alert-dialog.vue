<script setup lang="ts">
import {computed,ref,watch,nextTick,onBeforeUnmount} from 'vue'
import {useApp} from '../composables/use-app'
import NotificationContent from './notification-content.vue'
const {state}=useApp(),dialog=ref<HTMLDialogElement|null>(null)
const current=computed(()=>state.personalBanners[0])
function close(){dialog.value?.close();state.personalBanners.shift()}
watch(()=>current.value?.id,async id=>{await nextTick();if(id&&!dialog.value?.open)dialog.value?.showModal();else if(!id)dialog.value?.close()},{immediate:true})
onBeforeUnmount(()=>dialog.value?.close())
</script>
<template><dialog ref="dialog" class="personal-alert-dialog" aria-label="새 고객 알림" @cancel.prevent="close"><template v-if="current"><NotificationContent :alert="current"/><div class="notification-actions"><span v-if="state.personalBanners.length>1">남은 알림 {{ state.personalBanners.length-1 }}개</span><button autofocus @click="close">확인 · 닫기</button></div></template></dialog></template>
