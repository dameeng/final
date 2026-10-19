<script setup lang="ts">
import './styles/customer-app-shell.css'
import PwaStatus from './components/PwaStatus.vue'
import {watch,computed,onMounted} from 'vue'
import {useRoute} from 'vue-router'
import CustomerAppNav from './components/CustomerAppNav.vue'
import ServiceAuth from './pages/service-auth.vue'
import ServiceAccount from './pages/service-account.vue'
import ServiceDashboard from './pages/service-dashboard.vue'
import ServiceResource from './pages/backend-resource.vue'
import LiveMap from './pages/c-live-map.vue'
import {resourceRoutes} from './data/backendResources'
import {restoreManager} from './services/managerSession'
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
const app=useApp();if(new URLSearchParams(location.search).get('preview')==='1'&&/^\/(admin|customer)-app\//.test(location.pathname))app.setMemberPreview(true);watch(()=>app.theme,t=>document.documentElement.dataset.theme=t,{immediate:true})
const route=useRoute();const customer=computed(()=>!route.path.startsWith('/customer-app/')&&(route.path==='/'||/^\/(?:c-|info\/|my-|login|signup|password-reset|find-id)/.test(route.path)))
const live=computed(()=>import.meta.env.VITE_DATA_MODE==='server'||!!app.account||!!localStorage.getItem('routel-session-kind'))
watch(()=>route.path,path=>{if(!/^\/(admin|customer)-app\//.test(path))return;const kind=path.startsWith('/admin-app/')?'admin':'customer';const manifest=document.querySelector<HTMLLinkElement>('#app-manifest'),icon=document.querySelector<HTMLLinkElement>('#app-touch-icon');if(manifest)manifest.href=`/${kind}.webmanifest`;if(icon)icon.href=`/icons/${kind}-180.png`},{immediate:true})
const serviceComponent=computed(()=>{
 const path=route.path
 if(app.memberPreview&&!app.account&&/^\/(customer|admin)-app\//.test(path)&&!['/customer-app/screen-1','/admin-app/screen-1','/customer-app/screen-2','/customer-app/screen-3','/customer-app/screen-4','/customer-app/password-reset','/admin-app/signup','/admin-app/password-reset'].includes(path))return null
 if(['/admin-login','/admin-signup','/admin-password-reset','/login','/signup','/password-reset','/admin-app/screen-1','/customer-app/screen-1','/customer-app/screen-2','/customer-app/screen-3','/customer-app/screen-4','/customer-app/password-reset','/admin-app/signup','/admin-app/password-reset'].includes(path))return ServiceAuth
 // Logging in must not replace the configured example map/dashboard layout.
 if(['/c-map','/customer-app/screen-5','/customer-app/screen-6'].includes(path))return import.meta.env.VITE_DATA_MODE==='server'?LiveMap:null
 if(path==='/admin-dashboard'||path==='/admin-app/screen-3')return import.meta.env.VITE_DATA_MODE==='server'?ServiceDashboard:null
 if(!live.value)return null
 if(['/admin-profile','/admin-app/screen-14','/my-home','/my-account','/my-withdraw'].includes(path)||/^\/customer-app\/account\/(profile|emergency|settings|withdraw)$/.test(path))return ServiceAccount
 if(resourceRoutes[path]||path.startsWith('/admin-data/'))return ServiceResource
 return null
})
onMounted(async()=>{const kind=localStorage.getItem('routel-session-kind');if(kind==='customer'){await restoreCustomer();if(!app.account)await restoreManager()}else if(kind==='manager'||import.meta.env.VITE_DATA_MODE==='server'||route.path.startsWith('/admin-data/')||route.path==='/admin-reports'){await restoreManager();if(!app.account)await restoreCustomer()}})
const router=useRouter();const cleanups=new Map<HTMLElement,()=>void>()
function mounted(vnode:VNode){const el=vnode.el as HTMLElement;if(!serviceComponent.value&&(route.path.startsWith('/customer-app/')||route.path.startsWith('/admin-app/')))cleanups.set(el,mobileInteractions(el,route.path,router,app))}
function unmounted(vnode:VNode){const el=vnode.el as HTMLElement;cleanups.get(el)?.();cleanups.delete(el)}
</script>
<template><div :class="{'customer-shell':customer,'service-mobile':!!serviceComponent&&(route.path.startsWith('/admin-app/')||route.path.startsWith('/customer-app/')),'admin-shell':!customer&&!route.path.startsWith('/admin-app/')&&!route.path.startsWith('/customer-app/')}"><PwaStatus v-if="/^\/(admin|customer)-app\//.test(route.path)"/><AdminHandover/><CustomerHeader v-if="customer"/><RouterView v-slot="{Component}"><CustomerPageLayout v-if="customer"><MyPageLayout v-if="route.path.startsWith('/my-')"><component :is="serviceComponent||Component" :key="$route.path" @vue:mounted="mounted" @vue:unmounted="unmounted"/></MyPageLayout><component v-else :is="serviceComponent||Component" :key="$route.path" @vue:mounted="mounted" @vue:unmounted="unmounted"/></CustomerPageLayout><component v-else :is="serviceComponent||Component" :key="$route.path" @vue:mounted="mounted" @vue:unmounted="unmounted"/></RouterView><CustomerAppNav v-if="serviceComponent&amp;&amp;route.path.startsWith('/customer-app/')&amp;&amp;app.account&amp;&amp;!/^\/customer-app\/(screen-[1234]|password-reset)$/.test(route.path)"/><nav v-if="serviceComponent&amp;&amp;route.path.startsWith('/admin-app/')&amp;&amp;app.account" class="service-app-nav"><RouterLink to="/admin-app/screen-3">현황</RouterLink><RouterLink to="/admin-app/screen-4">통제</RouterLink><RouterLink to="/admin-app/screen-13">알림</RouterLink><RouterLink to="/admin-app/screen-14">내 정보</RouterLink></nav><CustomerFooter v-if="customer"/><PublicChatbot v-if="customer"/></div></template>
