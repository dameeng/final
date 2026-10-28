<script setup lang="ts">
import { onMounted,onBeforeUnmount,watch } from 'vue'
import {useApp} from '../stores/app'
import {useBackendEvents} from '../composables/useBackendEvents'
import {registerPushToken,type PushToken} from '../services/devicePush'
const app=useApp()
let ready=false
// Native/Firebase clients hand over an actually issued token; none is fabricated here.
async function receive(event:Event) {
  try {await registerPushToken((event as CustomEvent<PushToken>).detail);window.dispatchEvent(new Event('routel:push-device-updated'))}
  catch {window.dispatchEvent(new Event('routel:push-device-error'))}
}
async function register(){try{await registerPushToken()}catch{window.dispatchEvent(new Event('routel:push-device-error'))}}
watch(()=>[app.account?.id,app.account?.role],()=>{void register();if(ready&&app.account)window.dispatchEvent(new Event('routel:request-push-token'))},{immediate:true})
useBackendEvents(({name})=>{if(name==='connected')void register()})
onMounted(()=>{ready=true;window.addEventListener('routel:push-token',receive);if(app.account)window.dispatchEvent(new Event('routel:request-push-token'))})
onBeforeUnmount(()=>window.removeEventListener('routel:push-token',receive))
</script>
<template><span hidden aria-hidden="true"></span></template>
