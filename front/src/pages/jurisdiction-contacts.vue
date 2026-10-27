<script setup lang="ts">
import BackendLayout from '../components/BackendLayout.vue'
import JurisdictionContactList from '../components/JurisdictionContactList.vue'
</script>
<template>
  <BackendLayout :standard-menu="true">
    <section class="contacts-page">
      <div class="service-heading"><h1>관할 담당자 연락처</h1></div>
      <JurisdictionContactList />
    </section>
  </BackendLayout>
</template>
<style scoped src="../styles/pages/jurisdiction-contacts.css"></style>
