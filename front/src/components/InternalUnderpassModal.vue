<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { asPage, backend } from '../services/backend'
import TrafficVideo from './TrafficVideo.vue'
import TunnelReferenceVideo from './TunnelReferenceVideo.vue'
const open = defineModel<boolean>({ default: false })
const props = defineProps<{ facilityId?: string | number; facilityName: string }>()
const dialog = ref<HTMLDialogElement>(), cameras = ref<any[]>([]), selected = ref(''), error = ref(''), loading = ref(false)
let request: AbortController | undefined
watch(() => [open.value, props.facilityId], async () => {
  request?.abort()
  await nextTick()
  if (!open.value) { dialog.value?.close(); return }
  if (!dialog.value?.open) dialog.value?.showModal()
  cameras.value = []; selected.value = ''; error.value = ''; loading.value = false
  if (!props.facilityId) { error.value = '지하차도를 먼저 선택해 주세요.'; return }
  const controller = new AbortController(); request = controller; loading.value = true
  try {
    const rows = asPage<any>(await backend(`/api/underpasses/${encodeURIComponent(props.facilityId)}/cameras`, { signal: controller.signal })).items
    if (controller.signal.aborted) return
    cameras.value = rows.filter(row => row.cameraRole === 'CCTV')
    selected.value = String(cameras.value[0]?.id ?? '')
  } catch (e) { if (!controller.signal.aborted) error.value = (e as Error).message }
  finally { if (!controller.signal.aborted) loading.value = false }
})
onBeforeUnmount(() => { request?.abort(); dialog.value?.close() })
</script>
<template>
  <dialog ref="dialog" class="internal-underpass-modal" aria-label="내부 지하차도 영상" @cancel.prevent="open=false" @close="open=false">
    <header><h2>{{facilityName}} · 내부 지하차도</h2><button type="button" @click="open=false" aria-label="닫기">✕</button></header>
    <TunnelReferenceVideo v-if="open && facilityName.includes('초량')" />
    <p v-if="loading" role="status">내부 영상을 불러오는 중입니다.</p>
    <p v-else-if="error" role="alert">{{error}}</p>
    <template v-else-if="cameras.length">
      <label>내부 카메라 <select v-model="selected"><option v-for="camera in cameras" :key="camera.id" :value="String(camera.id)">{{camera.name || '내부 CCTV'}} · {{camera.id}}</option></select></label>
      <template v-for="camera in cameras" :key="camera.id"><TrafficVideo v-if="open && String(camera.id)===selected && camera.streamUrl" :src="camera.streamUrl" /><p v-else-if="String(camera.id)===selected">등록된 내부 영상이 없습니다.</p></template>
    </template>
    <p v-else>등록된 내부 영상이 없습니다.</p>
  </dialog>
</template>
<style scoped src="../styles/components/internal-underpass-modal.css"></style>
