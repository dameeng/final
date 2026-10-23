<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { backend, asPage, queryString } from '../services/backend'
import FacilityCctvViewer from './FacilityCctvViewer.vue'
const facilities=ref<any[]>([]), cameras=ref<any[]>([]), selected=ref(''), page=ref(1), more=ref(false), busy=ref(false), error=ref('')
const controller=new AbortController()
let cameraRequest:AbortController|undefined
async function load() {
  if(busy.value)return
  busy.value=true;error.value=''
  try {
    const result=asPage<any>(await backend('/api/underpasses'+queryString({page:page.value,size:10}),{signal:controller.signal}),page.value,10)
    facilities.value.push(...result.items);more.value=page.value<result.totalPages;page.value++
  } catch(cause) {if(!controller.signal.aborted)error.value=(cause as Error).message}
  finally {busy.value=false}
}
watch(selected,async id=>{
  cameraRequest?.abort();cameras.value=[];error.value=''
  if(!id)return
  const request=new AbortController();cameraRequest=request
  try {
    const result=await backend(`/api/underpasses/${encodeURIComponent(id)}/cameras`,{signal:request.signal})
    if(!request.signal.aborted)cameras.value=asPage<any>(result).items
  } catch(cause) {if(!request.signal.aborted)error.value=(cause as Error).message}
})
onMounted(load)
onBeforeUnmount(()=>{controller.abort();cameraRequest?.abort()})
</script>
<template>
  <label>영상 시설<select v-model="selected" aria-label="OCR 위젯 시설"><option value="">시설 선택</option><option v-for="facility in facilities" :key="facility.id" :value="String(facility.id)">{{facility.name}}</option></select></label>
  <button v-if="more" :disabled="busy" @click="load">시설 더 보기</button>
  <p v-if="error" role="alert">{{error}}</p>
  <FacilityCctvViewer v-if="selected" :key="selected" :cameras="cameras" :underpass-id="selected" compact />
  <p v-else>등록된 시설·카메라를 선택하면 영상이 표시됩니다.</p>
  <RouterLink :to="{path:'/admin-data/ocr',query:selected?{underpassId:selected}:{}}">OCR 인식 페이지 →</RouterLink>
</template>
