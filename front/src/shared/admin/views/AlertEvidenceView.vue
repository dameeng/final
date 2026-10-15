<script setup lang="ts">
import { plateImageUrl } from "../services/plate-image"
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { adminApi } from '../services/admin-api'

// imagePath: FastAPI가 감지 순간 캡처 이미지를 같이 보냈을 때만 값이 있음(upload-dir 기준 상대경로).
// WebConfigurer가 /uploads/** 를 file.upload-dir 로 서빙하도록 리소스 핸들러를 열어줘야 아래 img가 뜬다.
type PlateLog = { id: number; cameraId: number; underpassId: number; detectedNum: string; confidence: number; imagePath: string | null; detectedAt: string }
const pending = ref<PlateLog[]>([])
const selectedId = ref<number | null>(null)
const selectedRow = computed(() => pending.value.find((row) => row.id === selectedId.value) ?? null)
const localImage = ref('')
const message = ref('')
const correctedNum = ref('')
const reviewing = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

async function load() {
  try { pending.value = await adminApi<PlateLog[]>('/plate-logs/pending'); if(!pending.value.some(row=>row.id===selectedId.value)) selectedId.value=pending.value[0]?.id ?? null }
  catch (e) { pending.value = []; message.value = (e as Error).message }
}
function choose(event: Event) {
  if (localImage.value) URL.revokeObjectURL(localImage.value)
  const file = (event.target as HTMLInputElement).files?.[0]
  localImage.value = file ? URL.createObjectURL(file) : ''
}
// 관리자가 번호판을 수동으로 고쳐서 재매칭(PUT /plate-logs/{id}/review). 성공하면 CONFIRMED로 바뀌어
// 판별대기 목록에서 빠지므로, 다시 불러와 선택을 해제한다.
async function submitReview() {
  if (!selectedRow.value || !correctedNum.value.trim() || reviewing.value) { message.value = '수정할 번호판을 입력해 주세요.'; return }
  reviewing.value = true
  try {
    const result = await adminApi<{ carId: number | null }>(`/plate-logs/${selectedRow.value.id}/review`, {
      method: 'PUT', body: JSON.stringify({ correctedNum: correctedNum.value.trim() }),
    })
    message.value = result?.carId != null ? '판별 완료: 등록된 차량과 매칭되었습니다.' : '판별 완료: 등록된 차량과 매칭되지 않았습니다.'
    selectedId.value = null
    await load()
  } catch (e) { message.value = (e as Error).message }
  finally { reviewing.value = false }
}
watch(selectedId, (id) => {
  if (localImage.value) { URL.revokeObjectURL(localImage.value); localImage.value = '' }
  correctedNum.value = pending.value.find((row) => row.id === id)?.detectedNum ?? ''
})
onMounted(() => { void load(); timer = setInterval(() => void load(), 30000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer); if (localImage.value) URL.revokeObjectURL(localImage.value) })
</script>

<template>
<div class="routel-admin-page">
  <main>
    <h1>알림·번호판 스냅샷</h1>

    <h2>번호판 판별 대기</h2>
    <p>알림 발송 내역이 아닌 판별 대기 기록입니다.</p>
    <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table"><thead><tr><th>기록 ID</th><th>시설 ID</th><th>카메라 ID</th><th>번호판</th><th>인식 시각</th><th>이미지</th><th>선택</th></tr></thead><tbody>
      <tr v-for="row in pending" :key="row.id"><td>{{ row.id }}</td><td>{{ row.underpassId }}</td><td>{{ row.cameraId }}</td><td>{{ row.detectedNum }}</td><td>{{ row.detectedAt }}</td><td><img v-if="row.imagePath" class="qa-plate-thumb" :src="plateImageUrl(row.imagePath)" :alt="`${row.detectedNum} 인식 사진`" /><span v-else>없음</span></td><td><button type="button" @click="selectedId = row.id">선택</button></td></tr>
      <tr v-if="!pending.length"><td colspan="7">판별 대기 기록이 없습니다.</td></tr>
    </tbody></table></div>
    <section v-if="selectedRow">
      <button type="button" :disabled="reviewing" @click="selectedId = null">미리보기 닫기</button>
      <h2>사진 미리보기 · 기록 {{ selectedRow.id }}</h2>
      <p v-if="selectedRow.imagePath">
        <img :src="plateImageUrl(selectedRow.imagePath)" alt="저장된 번호판 스냅샷" width="640" />
      </p>
      <p v-else>이 기록에는 저장된 이미지가 없습니다(FastAPI가 감지 시 이미지를 같이 보내지 않은 경우입니다).</p>
      <label>직접 파일 선택해서 확인 <input type="file" accept="image/*" @change="choose" /></label>
      <p v-if="localImage"><img :src="localImage" alt="선택한 파일 미리보기" width="640" /></p>
      <p>이 파일 선택 미리보기는 서버에 저장되지 않으며, 이 화면에서만 잠시 볼 수 있습니다.</p>

      <h2>수동 판별</h2>
      <p>OCR이 낮은 확신도로 인식한 번호판입니다({{ selectedRow.detectedNum }}). 맞으면 그대로, 틀리면 고쳐서 제출해 주세요.</p>
      <form @submit.prevent="submitReview">
        <label>번호판 <input v-model="correctedNum" required maxlength="20" /></label>
        <button type="submit" :disabled="reviewing">{{ reviewing ? '처리 중...' : '판별 완료' }}</button>
      </form>
    </section>
    <p role="status">{{ message }}</p>
  </main>
</div>
</template>