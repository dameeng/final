<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId } from 'vue'
const props = defineProps<{
  modelValue?: string | number | null
  options: { value: string; label: string }[]
  label: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const id = useId(), trigger = ref<HTMLButtonElement>(), popup = ref<HTMLElement>()
const open = ref(false), active = ref(0), placement = ref<Record<string,string>>({})
const entries = computed(() => [{ value: '', label: props.placeholder || '선택' }, ...props.options])
const selected = computed(() => entries.value.find(o => o.value === String(props.modelValue ?? '')))
function position() {
  if (!trigger.value) return
  const r = trigger.value.getBoundingClientRect(), below = innerHeight - r.bottom - 12
  const height = Math.min(280, Math.max(below, r.top - 12))
  const styles = getComputedStyle(trigger.value)
  placement.value = {
    left: Math.max(8,Math.min(r.left,innerWidth-r.width-8))+'px', width:Math.min(r.width,innerWidth-16)+'px',
    maxHeight:height+'px', ...(below >= Math.min(280,r.top-12) ? {top:r.bottom+4+'px'} : {bottom:innerHeight-r.top+4+'px'}),
    '--picker-surface':styles.getPropertyValue('--r-surface')||'#fff',
    '--picker-ink':styles.getPropertyValue('--r-ink')||'#172e49',
    '--picker-line':styles.getPropertyValue('--r-line')||'#d7e4f5',
    '--picker-selected':styles.getPropertyValue('--r-selected')||'#eaf3ff',
    '--picker-accent':styles.getPropertyValue('--r-accent')||'#2475ce',
  }
}
function reveal() {
  void nextTick(() => popup.value?.querySelector('[data-active=true]')?.scrollIntoView({block:'nearest'}))
}
function show() {
  if (props.disabled) return
  active.value = Math.max(0,entries.value.findIndex(o=>o.value===String(props.modelValue??'')))
  open.value = true; position(); reveal()
}
function choose(index:number) {
  emit('update:modelValue',entries.value[index].value)
  open.value=false
  trigger.value?.focus()
  void nextTick(()=>trigger.value?.dispatchEvent(new Event('change',{bubbles:true})))
}
let typed='', typedAt=0
function keydown(e:KeyboardEvent) {
  if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
    e.preventDefault()
    if (!open.value) { show(); return }
    active.value=e.key==='Home'?0:e.key==='End'?entries.value.length-1:Math.max(0,Math.min(entries.value.length-1,active.value+(e.key==='ArrowDown'?1:-1)))
    reveal()
  } else if (e.key==='Escape') { e.preventDefault();open.value=false }
  else if (e.key==='Tab') open.value=false
  else if ((e.key==='Enter'||e.key===' ')&&open.value) { e.preventDefault();choose(active.value) }
  else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&e.key!==' ') {
    if(!open.value)show()
    typed=(Date.now()-typedAt<700?typed:'')+e.key;typedAt=Date.now()
    const index=entries.value.findIndex(o=>o.label.toLocaleLowerCase().startsWith(typed.toLocaleLowerCase()))
    if(index>=0){active.value=index;reveal()}
  }
}
function outside(e:PointerEvent) { if(!trigger.value?.contains(e.target as Node)&&!popup.value?.contains(e.target as Node))open.value=false }
document.addEventListener('pointerdown',outside)
window.addEventListener('resize',position)
window.addEventListener('scroll',position,true)
onBeforeUnmount(()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true)})
</script>
<template>
  <span class="facility-select">
    <button ref="trigger" type="button" class="facility-select-trigger" role="combobox" :aria-label="label" :aria-expanded="open" :aria-controls="id" aria-haspopup="listbox" :aria-required="required" :aria-activedescendant="open?id+'-'+active:undefined" :disabled="disabled" @click="open?open=false:show()" @keydown="keydown"><span>{{selected?.label||placeholder||'선택'}}</span><span aria-hidden="true">⌄</span></button>
    <input v-if="required" class="facility-select-validation" tabindex="-1" aria-hidden="true" :value="modelValue" :disabled="disabled" required @invalid.prevent="trigger?.focus();show()" />
    <Teleport to="body"><div v-if="open" :id="id" ref="popup" class="facility-select-popup" role="listbox" :aria-label="label" :style="placement" @pointerdown.prevent><div v-for="(option,index) in entries" :id="id+'-'+index" :key="option.value" role="option" :aria-selected="option.value===String(modelValue??'')" :data-active="index===active" @pointermove="active=index" @click="choose(index)"><span>{{option.label}}</span><span v-if="option.value===String(modelValue??'')" aria-hidden="true">✓</span></div></div></Teleport>
  </span>
</template>
<style scoped>
.facility-select { display:block; min-width:0; position:relative; }
.facility-select .facility-select-trigger { display:flex!important; align-items:center; justify-content:space-between; gap:12px; width:100%; min-height:44px; padding:10px 14px; border:1px solid var(--r-line,#d7e4f5); border-radius:8px; background:var(--r-surface,#fff); color:var(--r-ink,#172e49); font:inherit; font-size:13px; font-weight:400!important; line-height:22px; text-align:left; cursor:pointer; box-sizing:border-box; box-shadow:none!important; }
.facility-select-trigger>span:first-child { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.facility-select-trigger:focus-visible { outline:2px solid var(--r-accent,#2475ce); outline-offset:2px; }
.facility-select-trigger:disabled { opacity:.5; cursor:default; }
.facility-select .facility-select-validation { position:absolute; width:1px; height:1px; min-height:0; padding:0; border:0; clip-path:inset(50%); overflow:hidden; }
.facility-select-popup { position:fixed; z-index:10000; overflow:auto; overscroll-behavior:contain; padding:4px; box-sizing:border-box; border:1px solid var(--picker-line); border-radius:8px; background:var(--picker-surface); color:var(--picker-ink); box-shadow:0 8px 24px #102c4826; font:400 13px/22px 'Pretendard',sans-serif; }
.facility-select-popup>[role=option] { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:9px 12px; min-height:40px; box-sizing:border-box; border-radius:5px; cursor:pointer; overflow-wrap:anywhere; }
.facility-select-popup>[data-active=true] { background:var(--picker-selected); }
.facility-select-popup>[aria-selected=true] { color:var(--picker-accent); font-weight:600; }
</style>
