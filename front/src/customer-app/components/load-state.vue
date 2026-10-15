<script setup lang="ts">
defineProps<{ loading: boolean; error: string }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <p v-if="loading" role="status">불러오는 중입니다.</p>
  <p v-if="error" role="alert">
    {{ error }} <button @click="$emit('retry')">다시 시도</button>
  </p>
</template>
