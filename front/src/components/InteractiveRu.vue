<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref} from 'vue'
import MascotVideo from './MascotVideo.vue'
import ouch from '../assets/mascot/routel-ru-reaction.png'
import wink from '../assets/mascot/routel-ru-wink.png'
import dizzy from '../assets/mascot/routel-ru-dizzy.png'
import {mascotActions,mascotReactions,type MascotAction} from '../utils/mascot-reactions'
const figure=ref<HTMLElement>()
const action=ref<MascotAction>()
const reaction=computed(()=>action.value?mascotReactions[action.value]:null)
const picture=computed(()=>reaction.value?.expression==='ouch'?ouch:reaction.value?.expression==='dizzy'?dizzy:wink)
let animation:Animation|undefined,timer:ReturnType<typeof setTimeout>|undefined,hold:ReturnType<typeof setTimeout>|undefined
let press:{id:number;x:number;y:number;lastX:number;lastAt:number;moving:boolean}|undefined
let count=0,lastTap=0,combo=0
function play(next:MascotAction,direction=1) {
  clearTimeout(timer)
  action.value=next
  animation?.cancel()
  if(figure.value&&!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const neutral='translate(0,0) rotate(0) scale(1)'
    const frames=mascotReactions[next].motion.map(value=>direction<0?value.replace(/(translateX|rotate)\((-?[\d.]+)(px|deg)\)/g,(_,fn,n,unit)=>`${fn}(${-Number(n)}${unit})`):value)
    animation=figure.value.animate([neutral,...frames,neutral].map(transform=>({transform})),{duration:next==='spin'?1100:850,easing:'ease-in-out'})
  }
  timer=setTimeout(()=>{action.value=undefined},next==='cuddle'?2300:1800)
}
function tap(){const now=performance.now();combo=now-lastTap<700?combo+1:0;lastTap=now;play(combo>=3?'dizzy':mascotActions[count++%mascotActions.length]!)}
function start(event:PointerEvent){
  if(!event.isPrimary||event.button!==0)return
  press={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastAt:0,moving:false}
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  tap();clearTimeout(hold);hold=setTimeout(()=>{if(press&&!press.moving)play('cuddle')},650)
}
function move(event:PointerEvent){
  if(!press||press.id!==event.pointerId||Math.hypot(event.clientX-press.x,event.clientY-press.y)<6)return
  clearTimeout(hold);press.moving=true
  if(performance.now()-press.lastAt>90){play('sway',event.clientX<press.lastX?-1:1);press.lastAt=performance.now()}
  press.lastX=event.clientX
}
function release(){clearTimeout(hold);if(press?.moving)play('bounce');press=undefined}
onMounted(()=>{for(const src of [ouch,wink,dizzy]){const image=new Image();image.src=src}})
onBeforeUnmount(()=>{clearTimeout(timer);clearTimeout(hold);animation?.cancel()})
</script>
<template>
  <button type="button" class="interactive-ru" :data-reaction="action" aria-label="루와 놀기" title="누르거나 길게 누르고, 좌우로 흔들어 보세요" @pointerdown="start" @pointermove="move" @pointerup="release" @pointercancel="release" @lostpointercapture="release" @click="$event.detail===0&&tap()">
    <span v-if="reaction" class="ru-speech" role="status">{{reaction.text}}</span>
    <span ref="figure" class="ru-figure" aria-hidden="true"><MascotVideo v-show="!reaction" src="/brand/routel-ru-welcome-clean-v2.webm" poster="/brand/routel-ru-welcome-clean-v2-poster.png" /><img v-if="reaction" :src="picture" width="120" height="120" alt="" draggable="false" /></span>
  </button>
</template>
<style scoped>
.interactive-ru{position:relative;border:0;font:inherit;cursor:grab;touch-action:none;user-select:none;}
.interactive-ru:active{cursor:grabbing;}
.interactive-ru:focus-visible{outline:2px solid var(--r-focus);outline-offset:4px;}
.ru-figure{display:block;position:relative;width:100%;aspect-ratio:1;transform-origin:50% 80%;pointer-events:none;}
.ru-figure>img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;}
.ru-speech{position:absolute;bottom:calc(100% + 8px);left:0;z-index:2;width:max-content;max-width:min(220px,calc(100vw - 48px));padding:9px 12px;border:1px solid var(--r-line);border-radius:12px 12px 12px 3px;background:var(--r-surface);color:var(--r-ink);font-size:12px;line-height:18px;letter-spacing:0;box-shadow:0 4px 16px #17365718;pointer-events:none;}
</style>
