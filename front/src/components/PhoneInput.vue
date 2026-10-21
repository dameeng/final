<script setup lang="ts">
import {ref,watch} from 'vue'
const props=withDefaults(defineProps<{required?:boolean;disabled?:boolean;international?:boolean;label?:string}>(),{label:'전화번호'})
const value=defineModel<string>({default:''})
const country=ref('+82'),parts=ref(['','','']),inputs=ref<HTMLInputElement[]>([])
const countries=[['+82','대한민국'],['+1','미국·캐나다'],['+81','일본'],['+86','중국'],['+84','베트남'],['+63','필리핀'],['+66','태국'],['+44','영국'],['+61','호주']]
function publish(){const local=parts.value.some(Boolean)?parts.value.join('-'):'';value.value=local?(props.international&&country.value!=='+82'?country.value+' '+local:local):''}
function parse(raw:string){
 const match=raw.match(/^(\+\d+)\s+(.*)$/);if(match){country.value=match[1]!;raw=match[2]!}
 const split=raw.split('-');if(split.length===3){parts.value=split;return}
 const digits=raw.replace(/\D/g,'');const prefix=digits.startsWith('02')?2:3
 parts.value=[digits.slice(0,prefix),digits.slice(prefix,Math.max(prefix,digits.length-4)),digits.length>prefix?digits.slice(-Math.min(4,digits.length-prefix)):'']
 if(digits.length<=prefix+4)parts.value=[digits.slice(0,prefix),digits.slice(prefix),'']
}
watch(value,next=>{const local=parts.value.some(Boolean)?parts.value.join('-'):'';const current=local?(props.international&&country.value!=='+82'?country.value+' '+local:local):'';if((next||'')!==current)parse(next||'')},{immediate:true})
function input(index:number,event:Event){const el=event.target as HTMLInputElement;parts.value[index]=el.value.replace(/\D/g,'').slice(0,index===0?3:4);el.value=parts.value[index]!;publish();if(el.value.length===(index===0?3:4))inputs.value[index+1]?.focus()}
function paste(event:ClipboardEvent){const raw=event.clipboardData?.getData('text')||'';if(raw.replace(/\D/g,'').length<9)return;event.preventDefault();parse(raw);publish()}
</script>
<template><span class="phone-input" role="group" :aria-label="label"><span v-if="international" class="phone-country"><span class="phone-country-code" aria-hidden="true">{{country}}</span><select v-model="country" :aria-label="label+' 국가번호'" :disabled="disabled" @change="publish"><option v-for="[code,name] in countries" :key="code" :value="code">{{name}} {{code}}</option></select></span><span class="phone-input-parts" @paste="paste"><template v-for="(_,index) in parts" :key="index"><span v-if="index" aria-hidden="true">-</span><input :ref="el=>{if(el)inputs[index]=el as HTMLInputElement}" :value="parts[index]" :aria-label="label+' '+['앞자리','가운데 자리','마지막 자리'][index]" type="tel" inputmode="numeric" :maxlength="index===0?3:4" :pattern="index===0?'[0-9]{2,3}':'[0-9]{3,4}'" :required="required||parts.some(Boolean)" :disabled="disabled" :autocomplete="index===0?'tel-area-code':index===1?'tel-local-prefix':'tel-local-suffix'" @input="input(index,$event)" @keydown.backspace="!parts[index]&&inputs[index-1]?.focus()"></template></span></span></template>
<style scoped>.phone-input{display:flex;align-items:center;gap:10px;width:100%;min-width:0}.phone-country{position:relative;flex:0 0 72px;min-width:0;width:72px}.phone-country select{width:100%;color:transparent!important}.phone-country select option{color:var(--foreground,#20252b);background:var(--surface,#fff)}.phone-country-code{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;pointer-events:none;color:var(--foreground,#20252b)}.phone-input-parts{display:flex;align-items:center;gap:8px;flex:1;min-width:0}.phone-input-parts>input{width:0;flex:1;min-width:0;text-align:center}.phone-input-parts>span{flex:none;color:var(--ink-sub,#64748b)}@media(max-width:600px){.phone-input{flex-direction:column;align-items:stretch}.phone-country{flex:none;width:72px}.phone-input-parts{width:100%}}</style>
