<script setup lang="ts">
defineProps<{ id: string; tab: string }>()
</script>
<template>
  <nav class="tabs facility-detail-tabs" aria-label="지하차도 상세 탭">
    <RouterLink
      v-for="[value,label] in [['overview','개요'],['equip','설비'],['sign','전광판'],['cctv','CCTV'],['settings','설정']]"
      :key="value"
      v-slot="{href,navigate}"
      :to="{path:'/fac-detail',query:{id,underpassId:id,tab:value}}"
      custom
    ><a :href="href" :class="{'is-current':tab===value}" :aria-current="tab===value?'page':undefined" @click="navigate">{{label}}</a></RouterLink>
  </nav>
</template>
