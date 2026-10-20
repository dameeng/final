<script setup lang="ts">
import {computed,ref,watch} from 'vue'
defineProps<{required?:boolean;disabled?:boolean}>()
const value=defineModel<string>({default:''})
const todayParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
const today=(part:string)=>Number(todayParts.find(item=>item.type===part)?.value)
const currentYear=today('year'),currentMonth=today('month'),currentDay=today('day')
const year=ref(''),month=ref(''),day=ref('')
const years=Array.from({length:121},(_,i)=>String(currentYear-i))
const monthCount=computed(()=>Number(year.value)===currentYear?currentMonth:12)
const dayCount=computed(()=>{
 const y=Number(year.value),m=Number(month.value)
 if(!m)return 31
 const days=new Date(Date.UTC(y||2000,m,0)).getUTCDate()
 return y===currentYear&&m===currentMonth?Math.min(days,currentDay):days
})
const pad=(part:string)=>part.padStart(2,'0')
watch(value,next=>{const parts=(next||'').split('-');if(next){year.value=parts[0]||'';month.value=String(Number(parts[1])||'');day.value=String(Number(parts[2])||'')}},{immediate:true})
function update(){
 if(Number(month.value)>monthCount.value)month.value=''
 if(Number(day.value)>dayCount.value)day.value=''
 value.value=year.value&&month.value&&day.value?`${year.value}-${pad(month.value)}-${pad(day.value)}`:''
}
</script>
<template><span class="birth-date-input" role="group" aria-label="생년월일"><select v-model="year" aria-label="생년월일 연도" autocomplete="bday-year" :required="required" :disabled="disabled" @change="update"><option value="" disabled>연도</option><option v-for="item in years" :key="item" :value="item">{{item}}년</option></select><select v-model="month" aria-label="생년월일 월" autocomplete="bday-month" :required="required" :disabled="disabled" @change="update"><option value="" disabled>월</option><option v-for="item in monthCount" :key="item" :value="String(item)">{{item}}월</option></select><select v-model="day" aria-label="생년월일 일" autocomplete="bday-day" :required="required" :disabled="disabled" @change="update"><option value="" disabled>일</option><option v-for="item in dayCount" :key="item" :value="String(item)">{{item}}일</option></select></span></template>
<style scoped>.birth-date-input{display:grid;grid-template-columns:minmax(0,1.4fr) repeat(2,minmax(0,1fr));gap:8px;width:100%;min-width:0}.birth-date-input select{width:100%;min-width:0;min-height:44px;padding:8px 10px;border:1px solid var(--line,#c9ced6);border-radius:6px;background:var(--surface,#fff);color:inherit;font:inherit;font-size:14px}@media(max-width:400px){.birth-date-input{gap:6px}.birth-date-input select{padding:8px 5px;font-size:13px}}</style>
