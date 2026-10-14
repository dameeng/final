<script setup lang="ts">
import type {Alert} from '../services/types'
import {maskPhone,sentTime} from '../services/notification-format'
defineProps<{alert:Alert}>()
</script>
<template><div class="notification-content"><h2><span aria-hidden="true" class="notification-symbol">!</span>{{ alert.title }}</h2><h3 v-if="alert.underpassName">{{ alert.underpassName }}</h3><p class="notification-message">{{ alert.content }}</p><dl><div v-if="alert.carNum"><dt>차량번호</dt><dd>{{ alert.carNum }}</dd></div><div v-if="alert.recipientPhone"><dt>수신 연락처</dt><dd>{{ maskPhone(alert.recipientPhone) }}</dd></div><div><dt>발송 시각</dt><dd>{{ sentTime(alert.createdAt) }}</dd></div></dl><router-link v-if="alert.underpassId" :to="'/underpasses/'+encodeURIComponent(alert.underpassId)">해당 지하차도 확인</router-link></div></template>
