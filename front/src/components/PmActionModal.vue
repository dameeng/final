<script setup lang="ts">
// 예지보전 점검 처리 팝업 (설비 목록·상세·점검 대기에서 같이 쓴다).
//  - 점검 시작 : PATCH /api/pm/events/{id}/status  {status: IN_PROGRESS, content?}
//  - 기록 추가 : POST  /api/pm/events/{id}/actions {content}            (상태는 그대로)
//  - 조치 완료 : PATCH /api/pm/events/{id}/status  {status: RESOLVED|ETC, content}  (content 필수, 끝나면 다시 못 연다)
// 등록자는 서버가 로그인한 관리자로 기록하므로 입력받지 않는다.
import { computed, ref } from 'vue'
import { backend } from '../services/backend'
import { PM_EVENT_STATUS, PM_CLOSED_STATUS, pmLabel } from '../utils/pm-labels'

type Target = { eventId: number; name?: string; status?: string; underpassName?: string }
type Mode = 'start' | 'note' | 'resolve'

const emit = defineEmits<{ done: [] }>()
const dialog = ref<HTMLDialogElement>(),
  target = ref<Target | null>(null),
  mode = ref<Mode>('note'),
  endStatus = ref<'RESOLVED' | 'ETC'>('RESOLVED'),
  content = ref(''),
  busy = ref(false),
  error = ref('')

const closed = computed(() => PM_CLOSED_STATUS.includes(String(target.value?.status)))
const modes = computed<[Mode, string][]>(() => {
  const list: [Mode, string][] = []
  if (target.value?.status === 'CHECK_NEEDED') list.push(['start', '점검 시작'])
  list.push(['note', '기록 추가'], ['resolve', '점검 종료'])
  return list
})

function open(next: Target, first?: Mode) {
  target.value = next
  mode.value = first && (first !== 'start' || next.status === 'CHECK_NEEDED') ? first : modes.value[0]![0]
  endStatus.value = 'RESOLVED'
  content.value = ''
  error.value = ''
  dialog.value?.showModal()
}
defineExpose({ open })

async function submit() {
  if (!target.value) return
  const text = content.value.trim()
  if (mode.value !== 'start' && !text) {
    error.value = '조치 내용을 입력해 주세요.'
    return
  }
  busy.value = true
  error.value = ''
  const id = encodeURIComponent(String(target.value.eventId))
  try {
    if (mode.value === 'note')
      await backend(`/api/pm/events/${id}/actions`, { method: 'POST', body: { content: text } })
    else
      await backend(`/api/pm/events/${id}/status`, {
        method: 'PATCH',
        body: { status: mode.value === 'start' ? 'IN_PROGRESS' : endStatus.value, content: text || undefined },
      })
    dialog.value?.close()
    emit('done')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <WorkflowPage ref="dialog" class="service-modal pm-action-modal" aria-labelledby="pm-action-title">
    <form method="dialog" @submit.prevent="submit">
      <h2 id="pm-action-title">점검 처리 · {{target?.name}}</h2>
      <p class="pm-action-sub">
        {{target?.underpassName}} · 지금 상태 {{pmLabel(PM_EVENT_STATUS, target?.status)}}
      </p>
      <p v-if="closed" role="alert">이미 끝난 점검이에요. 다시 열 수 없어요.</p>
      <template v-else>
        <div class="pm-action-modes" role="radiogroup" aria-label="처리 종류">
          <label v-for="[value,label] in modes" :key="value">
            <input v-model="mode" type="radio" name="pm-action-mode" :value="value" /> {{label}}
          </label>
        </div>
        <div v-if="mode==='resolve'" class="pm-action-modes" role="radiogroup" aria-label="종료 결과">
          <label><input v-model="endStatus" type="radio" name="pm-action-end" value="RESOLVED" /> 조치 완료</label>
          <label><input v-model="endStatus" type="radio" name="pm-action-end" value="ETC" /> 기타 종료</label>
        </div>
        <label class="pm-action-field">
          조치 내용<span v-if="mode!=='start'"> (필수)</span>
          <textarea
            v-model="content"
            rows="4"
            maxlength="2000"
            :placeholder="mode==='start'?'현장 출동, 원격 점검 시작 등 (선택)':mode==='note'?'확인한 내용, 진행 상황':'한 조치와 결과 (부품 교체 후 정상 복귀 확인 등)'"
            @input="error=''"
          ></textarea>
        </label>
        <p class="pm-action-sub">등록자는 로그인한 관리자로 기록돼요.</p>
      </template>
      <p v-if="error" class="pm-action-error" role="alert">{{error}}</p>
      <div class="pm-action-buttons">
        <button class="btn" type="button" @click="dialog?.close()">취소</button>
        <button v-if="!closed" class="btn primary" type="submit" :disabled="busy">
          {{busy?'저장 중…':'저장'}}
        </button>
      </div>
    </form>
  </WorkflowPage>
</template>
<style scoped>
.pm-action-modal form { display: grid; gap: 12px; min-width: min(420px, 86vw); }
.pm-action-modal h2 { margin: 0; }
.pm-action-sub { margin: 0; font-size: 13px; color: var(--ink-sub, #5b6573); }
.pm-action-modes { display: flex; flex-wrap: wrap; gap: 14px; }
.pm-action-field { display: grid; gap: 6px; }
.pm-action-field textarea { width: 100%; box-sizing: border-box; }
.pm-action-error { margin: 0; color: var(--danger, #c0392b); font-size: 13px; }
.pm-action-buttons { display: flex; justify-content: flex-end; gap: 8px; }
</style>
