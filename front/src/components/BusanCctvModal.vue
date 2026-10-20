<script setup lang="ts">
import {nextTick,onBeforeUnmount,ref,watch} from 'vue'
import BusanCctvViewer from './BusanCctvViewer.vue'
const open=defineModel<boolean>({default:false}),props=defineProps<{facilityName:string;lat?:number|null;lng?:number|null}>(),dialog=ref<HTMLDialogElement>()
watch(open,async value=>{await nextTick();if(value&&!dialog.value?.open)dialog.value?.showModal();if(!value&&dialog.value?.open)dialog.value.close()})
function outside(event:MouseEvent){if(event.target!==dialog.value)return;const rect=dialog.value.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)open.value=false}
onBeforeUnmount(()=>dialog.value?.close())
</script>
<template><dialog ref="dialog" class="busan-cctv-modal" :aria-label="props.facilityName+' CCTV'" @close="open=false" @cancel.prevent="open=false" @click="outside"><header><h2>{{props.facilityName}} · CCTV</h2><button type="button" aria-label="CCTV 닫기" @click="open=false">닫기 ×</button></header><BusanCctvViewer v-if="open" :facility-name="props.facilityName" :lat="props.lat" :lng="props.lng"/><footer class="cctv-confirm-footer"><button type="button" @click="open=false">확인</button></footer></dialog></template>
