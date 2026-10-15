<script setup lang="ts">
import { nextTick, ref } from 'vue'
import '../styles/zoomable-map.css'
withDefaults(defineProps<{height?:number;selectionOnly?:boolean}>(),{height:460,selectionOnly:false})
const emit=defineEmits<{reset:[]}>()
const zoom=ref(1), viewport=ref<HTMLElement|null>(null)
async function change(value:number){
 const el=viewport.value,old=zoom.value
 const x=el?(el.scrollLeft+el.clientWidth/2)/old:0,y=el?(el.scrollTop+el.clientHeight/2)/old:0
 zoom.value=Math.max(1,Math.min(3,value))
 await nextTick()
 if(el){el.scrollLeft=x*zoom.value-el.clientWidth/2;el.scrollTop=y*zoom.value-el.clientHeight/2}
}
</script>
<template>
 <div class="routel-svg-zoom">
  <div class="routel-svg-zoom-buttons" role="group" aria-label="지도 확대 축소" @click.stop @pointerdown.stop>
   <button v-if="!selectionOnly" type="button" aria-label="지도 확대" :disabled="zoom>=3" @click="change(zoom+.25)">+</button>
   <button v-if="!selectionOnly" type="button" aria-label="지도 축소" :disabled="zoom<=1" @click="change(zoom-.25)">−</button>
   <span v-if="!selectionOnly" aria-live="polite">{{ Math.round(zoom*100) }}%</span>
   <button type="button" @click="change(1);emit('reset')">전체 보기</button>
  </div>
  <div ref="viewport" class="routel-svg-zoom-viewport" :style="{height:height+'px'}" tabindex="0" :aria-label="selectionOnly ? '지역 선택 지도' : '지역 지도, 확대 후 스크롤로 이동'">
   <div class="routel-svg-zoom-content" :style="{width:zoom*100+'%',height:height*zoom+'px'}"><slot /></div>
  </div>
 </div>
</template>
