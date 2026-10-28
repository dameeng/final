<script setup lang="ts">
import { computed } from 'vue'
const props=defineProps<{kind?:string|null;label?:string|null}>()
const labels:Record<string,string>={START:'점검 시작',RECORD:'기록 추가',RESOLVED:'조치 완료',ETC:'기타 종료'}
const text=computed(()=>labels[props.kind||'']||props.label||'구분 미기록')
</script>
<template><span class="pm-action-kind" :data-kind="kind||'UNKNOWN'">{{text}}</span></template>
<style scoped>
.pm-action-kind{display:inline-flex;align-items:center;padding:3px 8px;border-radius:4px;font-size:12px;line-height:18px;white-space:nowrap;background:var(--r-soft);color:var(--r-muted);}
.pm-action-kind[data-kind=START]{background:var(--r-selected);color:var(--r-accent);}
.pm-action-kind[data-kind=RESOLVED]{background:#e1f3ea;color:#1b7f5c;}
.pm-action-kind[data-kind=ETC]{background:#fff1d6;color:#965000;}
:global(:root[data-theme=dark]) .pm-action-kind[data-kind=RESOLVED]{background:#203e36;color:#a1e2c6;}
:global(:root[data-theme=dark]) .pm-action-kind[data-kind=ETC]{background:#403722;color:#f3d28a;}
</style>
