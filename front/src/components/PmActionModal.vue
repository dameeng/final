<script setup lang="ts">
// 예지보전 점검 처리 팝업 (설비 목록·상세·점검 대기에서 같이 쓴다).
//  - 점검 시작 : PATCH /api/pm/events/{id}/status  {status: IN_PROGRESS, content?}
//  - 기록 추가 : POST  /api/pm/events/{id}/actions {content}            (상태는 그대로)
//  - 조치 완료 : PATCH /api/pm/events/{id}/status  {status: RESOLVED|ETC, content}  (content 필수, 끝나면 다시 못 연다)
//  - 점검 등록 : POST  /api/pm/events {equipId, reason, priority, content}   (openRegister, 쿨다운과 상관없이 등록. 처리 중인 점검이 있으면 409)
// 등록자는 서버가 로그인한 관리자로 기록하므로 입력받지 않는다.
import { computed, ref } from 'vue'
import { backend } from '../services/backend'
import { PM_EVENT_STATUS, PM_CLOSED_STATUS, pmLabel } from '../utils/pm-labels'

type Target = { eventId: number; name?: string; status?: string; underpassName?: string }
type Mode = 'start' | 'note' | 'resolve'
type RegEquip = { equipId: number; name: string; underpassName?: string }
const REASONS = ['현장 이상 발견', '정기 점검', '민원·제보', '기타']
const PRIORITIES = ['보통', '높음']

const emit = defineEmits<{ done: [] }>()
const dialog = ref<HTMLDialogElement>(),
  target = ref<Target | null>(null),
  mode = ref<Mode>('note'),
  endStatus = ref<'RESOLVED' | 'ETC'>('RESOLVED'),
  content = ref(''),
  busy = ref(false),
  error = ref(''),
  registering = ref(false),
  regEquips = ref<RegEquip[]>([]),
  regEquipId = ref(''),
  regFixed = ref(false),
  regReason = ref(REASONS[0]!),
  regPriority = ref(PRIORITIES[0]!)

const closed = computed(() => PM_CLOSED_STATUS.includes(String(target.value?.status)))
const modes = computed<[Mode, string][]>(() => {
  const list: [Mode, string][] = []
  if (target.value?.status === 'CHECK_NEEDED') list.push(['start', '점검 시작'])
  list.push(['note', '기록 추가'], ['resolve', '점검 종료'])
  return list
})

function open(next: Target, first?: Mode) {
  registering.value = false
  target.value = next
  mode.value = first && (first !== 'start' || next.status === 'CHECK_NEEDED') ? first : modes.value[0]![0]
  endStatus.value = 'RESOLVED'
  content.value = ''
  error.value = ''
  dialog.value?.showModal()
}
// 점검 수동 등록. equipment 하나면 설비 고정(설비 상세), 여러 개면 고르게 한다(점검 이력)
function openRegister(equipment: RegEquip | RegEquip[]) {
  const list = Array.isArray(equipment) ? equipment : [equipment]
  regEquips.value = list
  regFixed.value = !Array.isArray(equipment)
  regEquipId.value = list.length === 1 ? String(list[0]!.equipId) : ''
  regReason.value = REASONS[0]!
  regPriority.value = PRIORITIES[0]!
  content.value = ''
  error.value = ''
  registering.value = true
  dialog.value?.showModal()
}
defineExpose({ open, openRegister, close:()=>dialog.value?.close() })

async function submitRegister() {
  const text = content.value.trim()
  if (!regEquipId.value) { error.value = '설비를 선택해 주세요.'; return }
  if (!text) { error.value = '점검 내용을 입력해 주세요.'; return }
  busy.value = true
  error.value = ''
  try {
    await backend('/api/pm/events', {
      method: 'POST',
      body: { equipId: Number(regEquipId.value), reason: regReason.value, priority: regPriority.value, content: text },
    })
    dialog.value?.close()
    emit('done')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function submit() {
  if (registering.value) return submitRegister()
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
        body: { status: mode.value === 'start' ? 'IN_PROGRESS' : endStatus.value, content: text || (mode.value === 'start' ? '점검을 시작했습니다.' : undefined) },
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
      <h2 id="pm-action-title">{{registering?'점검 등록':`점검 처리 · ${target?.name??''}`}}</h2>
      <p v-if="!registering" class="pm-action-sub">
        {{target?.underpassName}} · 지금 상태 {{pmLabel(PM_EVENT_STATUS, target?.status)}}
      </p>
      <template v-if="registering">
        <label class="pm-action-field">
          설비
          <select v-model="regEquipId" :disabled="regFixed" @change="error=''">
            <option v-if="!regFixed" value="">설비를 선택해 주세요</option>
            <option v-for="e in regEquips" :key="e.equipId" :value="String(e.equipId)">{{e.name}}<template v-if="e.underpassName"> · {{e.underpassName}}</template></option>
          </select>
        </label>
        <div class="pm-action-row">
          <label class="pm-action-field">점검 사유
            <select v-model="regReason"><option v-for="r in REASONS" :key="r" :value="r">{{r}}</option></select>
          </label>
          <label class="pm-action-field">우선순위
            <select v-model="regPriority"><option v-for="p in PRIORITIES" :key="p" :value="p">{{p}}</option></select>
          </label>
        </div>
        <label class="pm-action-field">
          점검 내용 (필수)
          <textarea v-model="content" rows="4" maxlength="1900" placeholder="예) 화면 하단 깜빡임 확인, 현장 점검 필요" @input="error=''"></textarea>
        </label>
        <p class="pm-action-sub">등록하면 '확인 필요' 상태의 점검 대기가 만들어지고, 등록자는 로그인한 관리자로 기록돼요.</p>
      </template>
      <p v-else-if="closed" role="alert">이미 끝난 점검이에요. 다시 열 수 없어요.</p>
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
        <button v-if="registering||!closed" class="btn primary" type="submit" :disabled="busy">
          {{busy?(registering?'등록 중…':'저장 중…'):(registering?'등록':'저장')}}
        </button>
        <button class="btn" type="button" @click="dialog?.close()">취소</button>
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
.pm-action-field textarea, .pm-action-field select { width: 100%; box-sizing: border-box; }
.pm-action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pm-action-error { margin: 0; color: var(--danger, #c0392b); font-size: 13px; }
.pm-action-buttons { display: flex; justify-content: flex-end; gap: 8px; }
</style>
