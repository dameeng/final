<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { useDashboardShortcuts } from '../stores/dashboardShortcuts'
const shortcuts=useDashboardShortcuts()
function drag(event:DragEvent,to:string){event.dataTransfer?.setData('text/routel-shortcut',to)}
function drop(event:DragEvent,before:string){event.preventDefault();shortcuts.drop(event.dataTransfer?.getData('text/routel-shortcut')||'',before)}
</script>

<template>
  <nav class="dashboard-shortcuts" aria-label="업무 바로가기">
    <div class="dashboard-shortcuts-heading"><p class="dashboard-shortcuts-title">업무 바로가기</p><button type="button" class="dashboard-shortcuts-edit" @click="shortcuts.requestEdit++">바로가기 편집</button></div>
    <p v-if="!shortcuts.items.length" class="dashboard-shortcuts-empty">바로가기 편집에서 필요한 메뉴를 추가하세요.</p>
    <div class="dashboard-shortcuts-grid">
      <div v-for="(shortcut,index) in shortcuts.items" :key="shortcut.to" class="dashboard-shortcut-wrap" :class="{'is-editing':shortcuts.editing}" :draggable="shortcuts.editing" @dragstart="drag($event,shortcut.to)" @dragover="shortcuts.editing&&$event.preventDefault()" @drop="drop($event,shortcut.to)">
      <RouterLink :to="shortcut.to" custom v-slot="{href,navigate}">
      <a :href="href" class="dashboard-shortcut" :draggable="false" @click="shortcuts.editing?$event.preventDefault():navigate($event)">
        <span class="dashboard-shortcut-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path :d="shortcut.icon" /></svg>
        </span>
        <span class="dashboard-shortcut-label">{{ shortcut.label }}</span>
        <svg class="dashboard-shortcut-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
      </a></RouterLink>
      <div v-if="shortcuts.editing" class="dashboard-shortcut-tools">
        <button type="button" :disabled="index===0" :aria-label="shortcut.label+' 앞으로 이동'" @click="shortcuts.move(shortcut.to,-1)">←</button>
        <button type="button" :disabled="index===shortcuts.items.length-1" :aria-label="shortcut.label+' 뒤로 이동'" @click="shortcuts.move(shortcut.to,1)">→</button>
        <button type="button" :aria-label="shortcut.label+' 바로가기 제거'" @click="shortcuts.toggle(shortcut.to)">×</button>
      </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
#app .page-admin-dashboard .dashboard-shortcuts { margin:0 0 16px; }
#app .page-admin-dashboard .dashboard-shortcuts-title { margin:0 0 10px; color:var(--r-muted); font-size:12px; font-weight:600; line-height:1.5; }
.dashboard-shortcuts-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; }
#app .page-admin-dashboard .dashboard-shortcut { display:flex; align-items:center; gap:12px; min-width:0; min-height:68px; padding:14px; border:1px solid var(--r-line); border-radius:12px; background:var(--r-surface); color:var(--r-ink); text-decoration:none; }
.dashboard-shortcut-icon { display:grid; place-items:center; width:36px; height:36px; flex:none; border-radius:10px; background:var(--r-selected); color:var(--r-accent); }
.dashboard-shortcut-label { font-size:13px; font-weight:650; line-height:1.5; word-break:keep-all; }
.dashboard-shortcut-arrow { margin-left:auto; flex:none; color:var(--r-muted); }
#app .page-admin-dashboard .dashboard-shortcut:hover { background:var(--r-selected); border-color:var(--r-accent); }
#app .page-admin-dashboard .dashboard-shortcut:focus-visible { outline:2px solid var(--r-accent); outline-offset:3px; }
@media (max-width:1200px) { .dashboard-shortcuts-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media (max-width:600px) { .dashboard-shortcuts-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; } #app .page-admin-dashboard .dashboard-shortcut { padding:12px; gap:8px; } .dashboard-shortcut-arrow { display:none; } }
.dashboard-shortcuts-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
#app .page-admin-dashboard .dashboard-shortcuts-heading .dashboard-shortcuts-title { margin:0; }
#app .page-admin-dashboard .dashboard-shortcuts-edit { padding:4px 8px; min-height:30px; border:1px solid var(--r-line); border-radius:6px; background:var(--r-surface); color:var(--r-accent); font-size:12px; }
.dashboard-shortcut-wrap { min-width:0; display:flex; flex-direction:column; }
.dashboard-shortcut-wrap>.dashboard-shortcut { flex:1; }
.dashboard-shortcut-wrap.is-editing { outline:1px dashed var(--r-accent); outline-offset:2px; border-radius:12px; cursor:grab; }
.dashboard-shortcut-tools { display:flex; justify-content:flex-end; gap:6px; padding:6px 0 0; }
#app .dashboard-shortcut-tools button { min-width:30px; min-height:30px; padding:3px 7px; border:1px solid var(--r-line); border-radius:6px; background:var(--r-surface); color:var(--r-ink); }
.dashboard-shortcut-tools button:disabled { opacity:.35; }
.dashboard-shortcuts-empty { padding:16px; border:1px dashed var(--r-line); border-radius:10px; color:var(--r-muted); font-size:13px; }
</style>
