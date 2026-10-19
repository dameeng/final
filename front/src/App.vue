<script setup lang="ts">
import './styles/customer-app-shell.css'
import {watch,computed,onMounted} from 'vue'
import {useRoute} from 'vue-router'
import AdminHandover from './components/AdminHandover.vue'
import CustomerHeader from './components/CustomerHeader.vue'
import CustomerFooter from './components/CustomerFooter.vue'
import MyPageLayout from './components/MyPageLayout.vue'
import CustomerPageLayout from './components/CustomerPageLayout.vue'
import PublicChatbot from './components/PublicChatbot.vue'
import {restoreCustomer} from './services/customerSession'
import {mobileInteractions} from './runtime/mobileInteractions'
import type {VNode} from 'vue'
import {useRouter} from 'vue-router'
import {useApp} from './stores/app'
const app=useApp();watch(()=>app.theme,t=>document.documentElement.dataset.theme=t,{immediate:true})
const route=useRoute();const customer=computed(()=>!route.path.startsWith('/customer-app/')&&(route.path==='/'||/^\/(?:c-|info\/|my-|login|signup|password-reset|find-id)/.test(route.path)))
onMounted(()=>{if(import.meta.env.VITE_DATA_MODE==='server')void restoreCustomer()})
const router=useRouter();const cleanups=new Map<HTMLElement,()=>void>()
function mounted(vnode:VNode){const el=vnode.el as HTMLElement;if(route.path.startsWith('/customer-app/')||route.path.startsWith('/admin-app/'))cleanups.set(el,mobileInteractions(el,route.path,router,app))}
function unmounted(vnode:VNode){const el=vnode.el as HTMLElement;cleanups.get(el)?.();cleanups.delete(el)}
</script>
<template><div :class="{'customer-shell':customer,'admin-shell':!customer&&!route.path.startsWith('/admin-app/')&&!route.path.startsWith('/customer-app/')}"><AdminHandover/><CustomerHeader v-if="customer"/><RouterView v-slot="{Component}"><CustomerPageLayout v-if="customer"><MyPageLayout v-if="route.path.startsWith('/my-')"><component :is="Component" :key="$route.path" @vue:mounted="mounted" @vue:unmounted="unmounted"/></MyPageLayout><component v-else :is="Component" :key="$route.path" @vue:mounted="mounted" @vue:unmounted="unmounted"/></CustomerPageLayout><component v-else :is="Component" :key="$route.path" @vue:mounted="mounted" @vue:unmounted="unmounted"/></RouterView><CustomerFooter v-if="customer"/><PublicChatbot v-if="customer"/></div></template>
