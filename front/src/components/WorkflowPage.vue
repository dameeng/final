<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref, useAttrs, useId, watch } from 'vue'
import { workflowPageState } from '../utils/workflow-page-state'
import { routerKey, routeLocationKey } from 'vue-router'
defineOptions({ inheritAttrs:false })
const props=withDefaults(defineProps<{pageMode?:boolean;hideBack?:boolean}>(),{pageMode:undefined,hideBack:false})
const attrs=useAttrs(), emit=defineEmits<{close:[Event];cancel:[Event]}>()
const router=inject(routerKey,null), route=inject(routeLocationKey,null)
const pageMode=computed(()=>props.pageMode??/^\/(admin|customer)-app\//.test(route?.path||''))
const nativeDialog=ref<HTMLDialogElement>()
const anchor=ref<HTMLElement>(), surface=ref<HTMLElement>(), outlet=ref<HTMLElement>()
const opened=ref(false)
const identity=useId()
function releaseTitle() { if(workflowPageState.owner===identity) {workflowPageState.owner='';workflowPageState.title=''} }
const key=computed(()=>String(attrs['aria-labelledby']||attrs['aria-label']||attrs.id||attrs.class||'detail').split(' ')[0])
let host:HTMLElement|undefined, mount:HTMLElement|undefined, trigger:HTMLElement|null=null, scroll=0, previousUrl='', sourcePath='', pushed=false
function findHost() {
  const local=anchor.value?.closest<HTMLElement>('.app-restored-body,.backend-main,.customer-page-body,.app-service-content,.bd')
  if(local) return local
  return document.querySelector<HTMLElement>('.app-restored-body')
    || document.querySelector<HTMLElement>('.mobile-page>.ph>.bd')
    || document.querySelector<HTMLElement>('.backend-main')
    || document.querySelector<HTMLElement>('.mypage-body')
    || document.querySelector<HTMLElement>('.customer-page-body')
    || document.querySelector<HTMLElement>('.mobile-app-map')
    || document.getElementById('app') || document.body
}
async function showModal() {
  if(opened.value) return
  if(!pageMode.value) { opened.value=true; nativeDialog.value?.showModal(); return }
  host=findHost(); trigger=document.activeElement as HTMLElement; scroll=host.scrollTop
  mount=document.createElement('div'); mount.className='workflow-page-mount'
  host.append(mount); host.classList.add('workflow-page-outlet'); outlet.value=mount; opened.value=true
  if(router&&route) {
    previousUrl=route.fullPath; sourcePath=route.path; pushed=true
    await router.push({query:{...route.query,__view:key.value}})
  }
  await nextTick(); host.scrollTop=0; surface.value?.focus()
  workflowPageState.owner=identity
  workflowPageState.title=(surface.value?.querySelector('h1,h2')?.textContent||String(attrs['aria-label']||'상세 보기')).split('·')[0]!.trim()
}
async function close(_returnValue?:string, navigation=false) {
  if(!opened.value) return
  if(!pageMode.value) { opened.value=false; nativeDialog.value?.close(_returnValue); return }
  opened.value=false; outlet.value=undefined
  releaseTitle()
  const oldHost=host, oldMount=mount, oldTrigger=trigger, oldScroll=scroll
  mount=undefined
  if(!navigation&&router&&route&&route.query.__view===key.value) {
    if(pushed&&router.options.history.state.back===previousUrl) router.back()
    else { const query={...route.query}; delete query.__view; void router.replace({query}) }
  }
  pushed=false
  await nextTick(); oldMount?.remove()
  if(!oldHost?.querySelector('.workflow-page-mount')) oldHost?.classList.remove('workflow-page-outlet')
  const previous=oldHost?.querySelector<HTMLElement>(':scope>.workflow-page-mount:last-child>.workflow-page')
  if(previous) {
    workflowPageState.owner=previous.dataset.workflowOwner||''
    workflowPageState.title=(previous.querySelector('h1,h2')?.textContent||previous.getAttribute('aria-label')||'상세 보기').split('·')[0]!.trim()
  }
  if(oldHost) oldHost.scrollTop=oldScroll
  emit('close',new Event('close'))
  oldTrigger?.focus({preventScroll:true})
}
function requestClose() {
  const event=new Event('cancel',{cancelable:true}); emit('cancel',event)
  if(!event.defaultPrevented) void close()
}
function nativeClosed(event: Event) { opened.value=false; emit('close',event) }
const backdropPress=ref(false)
function nativeOutside(event: PointerEvent|MouseEvent) {
  const element=nativeDialog.value
  if(!element||event.target!==element) return false
  const box=element.getBoundingClientRect()
  return event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom
}
watch(()=>route?.fullPath,()=>{
  if(!opened.value||route?.query.__view===key.value) return
  if(route?.path===sourcePath&&route.query.__view&&host?.querySelector(':scope>.workflow-page-mount:last-child')!==mount) return
  void close(undefined,true)
})
onBeforeUnmount(()=>{
  nativeDialog.value?.close()
  releaseTitle()
  const oldHost=host; mount?.remove()
  if(!oldHost?.querySelector('.workflow-page-mount')) oldHost?.classList.remove('workflow-page-outlet')
})
defineExpose({showModal,close,get open(){return opened.value},getBoundingClientRect:()=>(pageMode.value?surface.value:nativeDialog.value)?.getBoundingClientRect()||new DOMRect(),querySelector:(selector:string)=>(pageMode.value?surface.value:nativeDialog.value)?.querySelector(selector)})
</script>
<template>
  <span ref="anchor" hidden></span>
  <dialog v-if="!pageMode" ref="nativeDialog" v-bind="attrs" @close="nativeClosed" @cancel="emit('cancel',$event)" @pointerdown="backdropPress=nativeOutside($event)" @pointercancel="backdropPress=false" @click="backdropPress&&nativeOutside($event)&&requestClose();backdropPress=false"><slot /></dialog>
  <Teleport v-else-if="opened&&outlet" :to="outlet">
    <section ref="surface" v-bind="attrs" class="workflow-page" :data-workflow-owner="identity" role="region" tabindex="-1" @keydown.esc.stop.prevent="requestClose">
      <div v-if="!hideBack" class="workflow-page-navigation"><button type="button" class="btn" @click="requestClose">‹ 뒤로</button></div>
      <slot />
    </section>
  </Teleport>
</template>
<style>
.workflow-page-outlet>:not(.workflow-page-mount) { display:none!important; }
.workflow-page-outlet>.workflow-page-mount:not(:last-child) { display:none!important; }
#app .workflow-page-outlet,#app .app-restored-body:has(.workflow-page-mount) { background:var(--r-canvas)!important; color:var(--r-ink); }
#app .workflow-page-mount { width:100%; min-width:0; box-sizing:border-box; }
#app.workflow-page-outlet .workflow-page-mount>.workflow-page,
#app .workflow-page-outlet .workflow-page-mount>.workflow-page {
  display:block!important; position:static!important; inset:auto!important; box-sizing:border-box;
  width:100%!important; min-width:0!important; max-width:900px!important; height:auto!important; min-height:0!important; max-height:none!important;
  margin:0 auto!important; padding:0!important; border:0!important; border-radius:0!important;
  overflow:visible!important; background:transparent!important; color:var(--r-ink)!important; box-shadow:none!important; transform:none!important; outline:none;
}
#app .workflow-page-navigation { display:flex; margin-bottom:16px; }
#app .workflow-page-navigation>.btn { min-height:44px; padding:8px 14px; border:1px solid var(--r-line); border-radius:8px; background:var(--r-surface); color:var(--r-ink); }
#app .workflow-page form { min-width:0!important; width:100%; max-width:100%; box-sizing:border-box; }
#app .workflow-page :is(input,textarea,select,video) { max-width:100%; box-sizing:border-box; }
#app .workflow-page textarea { min-height:120px; padding:12px; border:1px solid var(--r-line); border-radius:8px; background:var(--r-surface); color:var(--r-ink); font:inherit; }
#app .workflow-page :is(h2,h3) { color:var(--r-ink); }
#app .workflow-page .pm-action-modes { gap:10px; padding:12px; border:1px solid var(--r-line); border-radius:10px; background:var(--r-surface); }
#app .workflow-page .pm-action-field { padding-top:8px; }
#app .workflow-page .pm-action-buttons { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); margin-top:12px; }
#app .workflow-page .pm-action-buttons .btn { min-height:44px; }
#app .mobile-app-map.workflow-page-outlet { overflow-y:auto!important; padding:16px; }
#app .workflow-page .traffic-device-list { max-height:none; overflow:visible; }
</style>
