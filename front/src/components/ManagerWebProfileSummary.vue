<script setup lang="ts">
defineProps<{ profile: Record<string, any>; editing: boolean }>()
defineEmits<{ edit: [] }>()
const time = (value: unknown) => value ? String(value).slice(0, 5) : '미등록'
</script>
<template>
  <div class="manager-web-summary">
    <header class="manager-web-identity">
      <span class="manager-web-avatar" aria-hidden="true">{{ String(profile.name || '관리자').slice(0, 1) }}</span>
      <div class="manager-web-name"><span>지역 관리자</span><h2>{{ profile.name || '관리자' }}님</h2><p>{{ profile.loginId || '아이디 미등록' }}</p></div>
      <button v-if="!editing" type="button" @click="$emit('edit')">내 정보 수정</button>
    </header>
    <div class="manager-web-assignment">
      <section><div class="manager-web-label"><h3>담당 지역</h3><span>{{ profile.regions?.length || 0 }}개 지역</span></div><div class="manager-web-regions"><span v-for="region in profile.regions || []" :key="region.id || region.name">{{ region.name }}</span><span v-if="!profile.regions?.length" class="is-empty">담당 지역 미지정</span></div></section>
      <section><div class="manager-web-label"><h3>근무조</h3></div><strong class="manager-web-shift">{{ profile.shift?.name || '미지정' }}</strong><span v-if="profile.shift" class="manager-web-hours">{{ time(profile.shift.startTime) }}–{{ time(profile.shift.endTime) }}</span></section>
    </div>
    <p class="manager-web-restriction">이름·담당 지역·근무조는 지정된 관리자 권한으로 변경됩니다.</p>
  </div>
</template>
<style scoped>
.manager-web-identity { display:flex; align-items:center; gap:16px; padding-bottom:22px; }
.manager-web-avatar { display:grid; place-items:center; flex:none; width:60px; height:60px; border:1px solid var(--r-line); border-radius:18px; background:var(--r-selected); color:var(--r-accent); font-size:25px; font-weight:650; }
.manager-web-name { flex:1; min-width:0; }.manager-web-name>span { color:var(--r-muted); font-size:11px; line-height:18px; }
#app .manager-web-name h2 { margin:3px 0 2px; font-size:23px; line-height:30px; font-weight:700; }
.manager-web-name p { margin:0; color:var(--r-muted); font-size:12px; line-height:20px; overflow-wrap:anywhere; }
.manager-web-identity button { flex:none; min-height:40px; padding:9px 14px; border:1px solid var(--r-accent); border-radius:8px; background:var(--r-selected); color:var(--r-accent); font:inherit; font-size:12px; font-weight:600; white-space:nowrap; cursor:pointer; }
.manager-web-identity button:focus-visible { outline:2px solid var(--r-focus); outline-offset:3px; }
.manager-web-assignment { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(0,1fr); gap:16px; }
.manager-web-assignment>section { min-width:0; padding:16px 18px; border:1px solid var(--r-line); border-radius:10px; background:var(--r-soft); }
.manager-web-label { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
#app .manager-web-label h3 { margin:0; font-size:12px; line-height:20px; font-weight:500; color:var(--r-muted); }
.manager-web-label>span { margin-left:auto; color:var(--r-muted); font-size:10px; line-height:20px; white-space:nowrap; }
.manager-web-regions { display:flex; flex-wrap:wrap; gap:6px; }.manager-web-regions>span { padding:4px 9px; border:1px solid var(--r-line); border-radius:6px; background:var(--r-surface); color:var(--r-ink); font-size:12px; line-height:20px; }
.manager-web-regions .is-empty { color:var(--r-muted); }
.manager-web-shift { display:inline-block; color:var(--r-ink); font-size:18px; font-weight:650; line-height:28px; margin-right:12px; }
.manager-web-hours { display:inline-block; color:var(--r-muted); font-size:12px; line-height:28px; font-variant-numeric:tabular-nums; white-space:nowrap; }
.manager-web-restriction { margin:12px 0 0; font-size:11px; line-height:18px; color:var(--r-muted); }
@media(max-width:650px) { .manager-web-assignment { grid-template-columns:minmax(0,1fr); gap:12px; }.manager-web-identity { gap:12px; flex-wrap:wrap; }.manager-web-avatar { width:48px; height:48px; border-radius:14px; }.manager-web-identity button { margin-left:auto; } }
</style>
