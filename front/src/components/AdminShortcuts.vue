<script setup lang="ts">
import {adminSections} from '../data/adminNavigation'
</script>
<template><div class="admin-shortcuts"><section v-for="group in adminSections" :key="group.title"><h3>{{group.title}}</h3><nav><RouterLink v-for="[label,to] in group.links" :key="to" :to="to!">{{label}}<span aria-hidden="true">→</span></RouterLink></nav></section></div></template>
<style scoped>
.admin-shortcuts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:12px;min-width:0}.admin-shortcuts section{padding:16px;border:1px solid var(--line);border-radius:10px;min-width:0}.admin-shortcuts h3{margin:0 0 12px;font-size:15px}.admin-shortcuts nav{display:flex;flex-direction:column;gap:6px}.admin-shortcuts a{display:flex;justify-content:space-between;gap:8px;padding:10px;border-radius:6px;background:var(--background,#f5f8fb);font-size:13px;color:inherit;text-decoration:none}.admin-shortcuts a:hover{outline:1px solid var(--line)}@media(max-width:1050px){.admin-shortcuts{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:500px){.admin-shortcuts{grid-template-columns:1fr}}
</style>
