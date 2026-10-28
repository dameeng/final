<script setup lang="ts">
import {formatPhone} from '../utils/phone'
defineProps<{profile:Record<string,any>}>()
defineEmits<{edit:[]}>()
</script>
<template>
  <div class="customer-profile-summary">
    <header class="customer-profile-identity">
      <span class="customer-profile-avatar" aria-hidden="true"><UiIcon name="user" /></span>
      <div><h2>{{profile.name||'회원'}}님</h2><span>{{profile.loginId}}</span></div>
      <button type="button" @click="$emit('edit')">내 정보 수정</button>
    </header>
    <div class="customer-profile-sections">
      <section aria-label="연락 정보"><h3>연락 정보</h3><dl>
        <div><dt>연락처</dt><dd>{{formatPhone(profile.phone)||'미등록'}}</dd></div>
        <div><dt>이메일</dt><dd>{{profile.email||'미등록'}}</dd></div>
        <div><dt>비상 연락처</dt><dd>{{formatPhone(profile.emergency)||'미등록'}}</dd></div>
      </dl></section>
      <section aria-label="주소 정보"><h3>주소 정보</h3><dl>
        <div><dt>우편번호</dt><dd>{{profile.zipcode||'미등록'}}</dd></div>
        <div><dt>도로명 주소</dt><dd>{{profile.roadAddress||'미등록'}}</dd></div>
        <div><dt>상세 주소</dt><dd>{{profile.detailAddress||'미등록'}}</dd></div>
      </dl></section>
    </div>
  </div>
</template>
<style scoped>
.customer-profile-identity{display:flex;align-items:center;gap:14px;padding-bottom:20px;border-bottom:1px solid var(--r-line);}
.customer-profile-avatar{display:grid;place-items:center;width:52px;height:52px;flex:none;border-radius:50%;background:var(--r-selected);color:var(--r-accent);--ui-icon-size:26px;}
#app .customer-profile-summary .customer-profile-identity h2{margin:0 0 2px;font-size:21px;line-height:28px;font-weight:650;}
.customer-profile-identity>div>span{color:var(--r-muted);font-size:13px;}
.customer-profile-identity>button{margin-left:auto;min-height:40px;padding:8px 14px;border:1px solid var(--r-line);border-radius:8px;background:var(--r-surface);color:var(--r-ink);font:inherit;font-size:13px;cursor:pointer;}
.customer-profile-sections{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px;padding-top:20px;}
.customer-profile-sections>section+section{padding-left:32px;border-left:1px solid var(--r-line);}
.customer-profile-sections h3{margin:0 0 16px;color:var(--r-ink);font-size:14px;font-weight:600;}
.customer-profile-sections dl{display:grid;gap:12px;margin:0;}
.customer-profile-sections dl>div{display:grid;grid-template-columns:88px minmax(0,1fr);align-items:baseline;gap:12px;}
.customer-profile-sections dt{color:var(--r-muted);font-size:12px;line-height:22px;}
.customer-profile-sections dd{margin:0;color:var(--r-ink);font-size:14px;line-height:22px;overflow-wrap:anywhere;}
@media(max-width:800px){.customer-profile-sections{grid-template-columns:1fr;gap:20px;}.customer-profile-sections>section+section{padding:20px 0 0;border-left:0;border-top:1px solid var(--r-line);}}
@media(max-width:420px){.customer-profile-identity{flex-wrap:wrap;}.customer-profile-identity>button{width:100%;margin-left:0;}}
</style>
