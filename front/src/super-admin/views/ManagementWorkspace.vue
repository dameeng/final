<script setup lang="ts">
import {computed,inject} from 'vue'
import {useRoute} from 'vue-router'
import {adminKey} from '../../shared/admin/main'
import ManagerApprovalsView from './ManagerApprovalsView.vue'
import ExtraView from '../../shared/admin/views/ExtraView.vue'
import RecordsView from '../../shared/admin/views/RecordsView.vue'
import FacilityManageView from '../../shared/admin/views/FacilityManageView.vue'
const props=defineProps<{section:'accounts'|'customers'}>()
const route=useRoute()
const {state}=inject(adminKey)!
const tabs=computed(()=>props.section==='accounts'?[['approvals','가입 승인'],['managers','관리자 목록·지역 배정'],['regions','지역 관리']]:[['members','고객 조회'],['opinions','문의 처리'],['notices','공지·FAQ']])
const active=computed(()=>tabs.value.some(t=>t[0]===route.query.tab)?String(route.query.tab):tabs.value[0][0])
</script>
<template><div v-if="state.profile?.role==='SUPER_ADMIN'" class="super-workspace">
 <div class="su-heading"><h1>{{ section==='accounts'?'지역·관리자':'고객·게시물' }}</h1><p>{{ section==='accounts'?'가입 승인과 담당 지역 배정, 지역 정보를 한곳에서 관리합니다.':'고객 정보와 문의, 공지사항·FAQ를 관리합니다.' }}</p></div>
 <nav class="su-tabs" aria-label="관리 업무"><router-link v-for="tab in tabs" :key="tab[0]" :to="{path:route.path,query:{tab:tab[0]}}" :aria-current="active===tab[0]?'page':undefined">{{ tab[1] }}</router-link></nav>
 <section class="su-card su-embedded">
  <ManagerApprovalsView v-if="active==='approvals'"/>
  <ExtraView v-else-if="active==='managers'" section="permissions"/>
  <FacilityManageView v-else-if="active==='regions'" mode="regions"/>
  <RecordsView v-else :key="active" :section="active"/>
 </section>
</div></template>
