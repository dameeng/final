<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import TrafficVideo from './TrafficVideo.vue'
const cameras = ref<{ CCTV_ID: string }[]>([]), selected = ref(''), source = ref(''), title = ref(''), loading = ref(false), error = ref('')
let request: AbortController | undefined
async function query(path: string, body: Record<string,string>, signal: AbortSignal) {
  const response = await fetch('/tunnel-source/'+path, { method:'POST', body:new URLSearchParams(body), signal })
  if (!response.ok) throw Error('참고 CCTV 제공처에 연결하지 못했습니다.')
  return response.json()
}
async function load(reloadList = false) {
  request?.abort()
  const controller = new AbortController(); request = controller
  const timeout = setTimeout(() => controller.abort(),15000)
  loading.value = true; error.value = ''; source.value = ''
  try {
    if (reloadList || !cameras.value.length) {
      const data = await query('getCctv-data.do',{lvl:'2'},controller.signal)
      if (!Array.isArray(data.list) || !data.list.length) throw Error('참고 CCTV 목록이 없습니다.')
      cameras.value = data.list.filter((row: any) => typeof row.CCTV_ID==='string')
      selected.value = cameras.value.find(row => row.CCTV_ID==='0121CTE02052')?.CCTV_ID || cameras.value[0]?.CCTV_ID || ''
    }
    const data = await query('getCctvInfo-data.do',{cctvId:selected.value},controller.signal)
    const url = String(data.info?.STREAMING2_ADRES || '').replace('http://211.61.148.68:1935','https://www.seoultunnel.co.kr')
    if (!/^https:\/\/(www\.)?seoultunnel\.co\.kr\/.*\.m3u8(?:\?|$)/i.test(url)) throw Error('재생 가능한 참고 영상 주소가 없습니다.')
    if (controller.signal.aborted) return
    source.value = url
    title.value = [data.info?.CCTV_NM,data.info?.DRC].filter(Boolean).join(' · ')
  } catch (e) {
    if (request===controller) error.value = controller.signal.aborted ? '영상 조회 시간이 초과되었습니다. 다시 시도해 주세요.' : (e as Error).message
  } finally {
    clearTimeout(timeout)
    if (request===controller) loading.value = false
  }
}
onMounted(() => void load())
onBeforeUnmount(() => { request?.abort(); request=undefined })
</script>
<template>
  <section class="tunnel-reference-video" aria-label="내부 CCTV 참고 영상">
    <h3>내부 CCTV · 참고 영상</h3>
    <p class="reference-notice">서울 신월여의지하도로 제공 영상입니다. 실제 초량 지하차도 내부 영상과 다릅니다.</p>
    <label v-if="cameras.length">영상 지점<select v-model="selected" :disabled="loading" @change="load()"><option v-for="(camera,index) in cameras" :key="camera.CCTV_ID" :value="camera.CCTV_ID">{{index+1}}번 지점 · {{camera.CCTV_ID}}</option></select></label>
    <p v-if="loading" role="status">내부 참고 영상을 불러오는 중입니다.</p>
    <p v-if="error" role="alert">{{error}} <button type="button" @click="load(true)">다시 시도</button></p>
    <template v-if="source"><p>{{title}}</p><TrafficVideo :key="source" :src="source" hls /></template>
    <a href="https://seoultunnel.co.kr/usage/traffic.do" target="_blank" rel="noopener noreferrer">영상 제공처에서 보기 ↗</a>
  </section>
</template>
<style scoped src="../styles/components/tunnel-reference-video.css"></style>
