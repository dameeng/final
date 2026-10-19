<script setup lang="ts">
import {useAdminProfile} from '../stores/adminProfile'
const admin=useAdminProfile()
</script>
<template><RouterLink class="side-user" to="/admin-profile" aria-label="관리자 마이페이지로 이동">{{admin.region}} · 지역 관리자<br>{{admin.profile.name}}님</RouterLink></template>
