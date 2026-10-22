<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
defineProps<{ required?: boolean; disabled?: boolean }>()
const value = defineModel<string>({ default: '' })
const listId = useId()
const todayParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).formatToParts(new Date())
const today = (part: string) => Number(todayParts.find((item) => item.type === part)?.value)
const currentYear = today('year'),
  currentMonth = today('month'),
  currentDay = today('day')
const year = ref(''),
  month = ref(''),
  day = ref('')
const years = Array.from({ length: 121 }, (_, i) => String(currentYear - i))
const monthCount = computed(() => (Number(year.value) === currentYear ? currentMonth : 12))
const dayCount = computed(() => {
  const y = Number(year.value),
    m = Number(month.value)
  if (!m) return 31
  const days = new Date(Date.UTC(y || 2000, m, 0)).getUTCDate()
  return y === currentYear && m === currentMonth ? Math.min(days, currentDay) : days
})
const pad = (part: string) => String(Number(part)).padStart(2, '0')
const yearPattern = years.join('|')
const monthPattern = computed(() => Array.from({length: monthCount.value}, (_, i) => `0?${i + 1}`).join('|'))
const dayPattern = computed(() => Array.from({length: dayCount.value}, (_, i) => `0?${i + 1}`).join('|'))
watch(
  value,
  (next) => {
    const parts = (next || '').split('-')
    if (next) {
      year.value = parts[0] || ''
      month.value = String(Number(parts[1]) || '')
      day.value = String(Number(parts[2]) || '')
    }
  },
  { immediate: true },
)
function update() {
  if (Number(month.value) > monthCount.value) month.value = ''
  if (Number(day.value) > dayCount.value) day.value = ''
  value.value =
    years.includes(year.value) && /^\d{1,2}$/.test(month.value) && Number(month.value) >= 1 && Number(month.value) <= monthCount.value && /^\d{1,2}$/.test(day.value) && Number(day.value) >= 1 && Number(day.value) <= dayCount.value
      ? `${year.value}-${pad(month.value)}-${pad(day.value)}`
      : ''
}
</script>
<template>
  <span class="birth-date-input" role="group" aria-label="생년월일">
    <input
      v-model="year"
      aria-label="생년월일 연도"
      placeholder="연도"
      autocomplete="bday-year"
      inputmode="numeric"
      maxlength="4"
      :list="`${listId}-years`"
      :pattern="yearPattern"
      :required="required"
      :disabled="disabled"
      @input="update"
    />
    <datalist :id="`${listId}-years`">
      <option v-for="item in years" :key="item" :value="item">{{item}}년</option>
    </datalist>
    <input
      v-model="month"
      aria-label="생년월일 월"
      placeholder="월"
      autocomplete="bday-month"
      inputmode="numeric"
      maxlength="2"
      :list="`${listId}-months`"
      :pattern="monthPattern"
      :required="required"
      :disabled="disabled"
      @input="update"
    />
    <datalist :id="`${listId}-months`">
      <option v-for="item in monthCount" :key="item" :value="String(item)">{{item}}월</option>
    </datalist>
    <input
      v-model="day"
      aria-label="생년월일 일"
      placeholder="일"
      autocomplete="bday-day"
      inputmode="numeric"
      maxlength="2"
      :list="`${listId}-days`"
      :pattern="dayPattern"
      :required="required"
      :disabled="disabled"
      @input="update"
    />
    <datalist :id="`${listId}-days`">
      <option v-for="item in dayCount" :key="item" :value="String(item)">{{item}}일</option>
    </datalist>
  </span>
</template>
<style scoped>
.birth-date-input {
  display: grid;
  grid-template-columns: minmax(0,1.4fr) repeat(2,minmax(0,1fr));
  gap: 8px;
  width: 100%;
  min-width: 0;
}
.birth-date-input input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid var(--line,#c9ced6);
  border-radius: 6px;
  background: var(--surface,#fff);
  color: inherit;
  font: inherit;
  font-size: 14px;
}
@media (max-width:400px) {
  .birth-date-input {
    gap: 6px;
  }
  .birth-date-input input {
    padding: 8px 5px;
    font-size: 13px;
  }
}
</style>
