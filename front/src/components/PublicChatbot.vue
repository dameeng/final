<script setup lang="ts">
import {ref,nextTick,watch,onMounted,onBeforeUnmount} from 'vue'
import {RouterLink,useRoute} from 'vue-router'
import {backend,asPage,queryString} from '../services/backend'
import {useApp} from '../stores/app'
import '../styles/public-chatbot.css'
const app=useApp(),dialog=ref<HTMLDialogElement>(),entry=ref(''),messages=ref<{role:string;text:string}[]>([]),launcher=ref<HTMLButtonElement>()
const route=useRoute(),panelWidth=ref(560),messageList=ref<HTMLOListElement>()
const popular=ref<{id:number;question:string}[]>([]),answerBusy=ref(false)
const position=ref<{x:number;y:number}>(),dragging=ref(false)
let drag:{id:number;x:number;y:number;left:number;top:number}|undefined,suppressClick=false
function place(x:number,y:number){
 const rect=launcher.value?.getBoundingClientRect();if(!rect)return
 position.value={x:Math.max(8,Math.min(x,innerWidth-rect.width-8)),y:Math.max(8,Math.min(y,innerHeight-rect.height-8))}
}
function startDrag(event:PointerEvent){
 if(!event.isPrimary||event.button!==0)return
 const rect=launcher.value!.getBoundingClientRect()
 suppressClick=false;drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top}
 launcher.value!.setPointerCapture(event.pointerId)
}
function moveDrag(event:PointerEvent){
 if(!drag||event.pointerId!==drag.id)return
 const dx=event.clientX-drag.x,dy=event.clientY-drag.y
 if(!dragging.value&&Math.hypot(dx,dy)<6)return
 dragging.value=true;suppressClick=true;place(drag.left+dx,drag.top+dy)
}
function endDrag(){drag=undefined;dragging.value=false}
function launch(){if(suppressClick){suppressClick=false;return}void open()}
function fitLauncher(){if(position.value)place(position.value.x,position.value.y)}
function moveWithKey(event:KeyboardEvent){
 const step=event.shiftKey?40:10,deltas:Record<string,[number,number]>={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}
 const delta=deltas[event.key];if(!delta)return
 event.preventDefault();const rect=launcher.value!.getBoundingClientRect();place(rect.left+delta[0],rect.top+delta[1])
}
onMounted(()=>window.addEventListener('resize',fitLauncher))
function fitPanel(){const pane=document.querySelector<HTMLElement>('.page-c-map .app>aside:not([hidden]),.page-c-live-map .map-sidebar');const rect=pane?.getBoundingClientRect();panelWidth.value=window.innerWidth<=700?Math.min(window.innerWidth,dialog.value?.open?dialog.value.getBoundingClientRect().right:document.documentElement.clientWidth):rect&&rect.left>window.innerWidth*.45?Math.min(window.innerWidth,Math.max(340,(dialog.value?.open?dialog.value.getBoundingClientRect().right:document.documentElement.clientWidth)-rect.left)):Math.min(600,window.innerWidth)}
async function open(){void backend('/api/faqs/popular?limit=5').then(rows=>{popular.value=Array.isArray(rows)?rows:[]}).catch(()=>{popular.value=[]});fitPanel();dialog.value?.showModal();window.addEventListener('resize',fitPanel);await nextTick();fitPanel();await nextTick();dialog.value?.querySelector('input')?.focus({preventScroll:true})}
function close(){dialog.value?.close();window.removeEventListener('resize',fitPanel);launcher.value?.focus({preventScroll:true})}
function outside(event:MouseEvent){if(event.target!==dialog.value)return;const rect=dialog.value.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close()}
watch(()=>route.fullPath,close)
watch(()=>messages.value.length,async()=>{await nextTick();messageList.value?.scrollTo({top:messageList.value.scrollHeight})})
onBeforeUnmount(()=>{window.removeEventListener('resize',fitPanel);window.removeEventListener('resize',fitLauncher)})
async function send(){const question=entry.value.trim();if(!question||answerBusy.value)return;messages.value.push({role:'이용자',text:question});entry.value='';answerBusy.value=true;try{const privateQuestion=/(내\s*(차량|문의|계정|정보|연락처)|개인정보|전화번호)/.test(question);if(privateQuestion){messages.value.push({role:'안내',text:app.account?.role==='customer'?'개인정보는 마이페이지에서 확인해 주세요.':'먼저 로그인해 주세요.'});return}const result=asPage<any>(await backend('/api/faqs'+queryString({keyword:question,page:1,size:5})));const row=result.items.find(item=>item.question===question)||result.items[0];if(!row){messages.value.push({role:'안내',text:'등록된 FAQ에서 답변을 찾지 못했습니다. 공지·FAQ 또는 문의하기를 확인해 주세요.'});return}const detail=await backend('/api/faqs/'+encodeURIComponent(row.id));messages.value.push({role:'안내',text:String(detail.answer||'등록된 답변이 없습니다.')})}catch(e){messages.value.push({role:'안내',text:e instanceof Error?e.message:'FAQ를 불러오지 못했습니다.'})}finally{answerBusy.value=false}}
</script>
<template><button ref="launcher" class="public-chat-launcher" type="button" aria-haspopup="dialog" title="끌어서 위치 이동 · 방향키로 이동" :class="{'is-dragging':dragging}" :style="position?{position:'fixed',left:position.x+'px',top:position.y+'px',right:'auto',bottom:'auto',margin:'0'}:undefined" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag" @keydown="moveWithKey" @click="launch">챗봇 문의</button><dialog ref="dialog" class="drawer-dialog public-chat-dialog" :style="{width:panelWidth+'px'}" aria-labelledby="public-chat-title" @cancel.prevent="close" @click="outside"><header class="public-chat-header"><div><small>ROUTEL HELP</small><h2 id="public-chat-title">ROUTEL 이용 안내</h2></div><button type="button" aria-label="챗봇 닫기" @click="close">×</button></header><p class="public-chat-description">등록된 FAQ를 안내합니다. 자유 질문 자동 답변은 서비스 연결 후 제공됩니다.</p><ol ref="messageList" class="chat-messages" aria-live="polite"><li v-if="!messages.length" class="public-chat-welcome"><b>무엇을 도와드릴까요?</b><p>궁금한 내용을 아래에 입력해 주세요.</p><RouterLink to="/info/faq">자주 묻는 질문 확인 →</RouterLink><div v-if="popular.length" class="service-actions" aria-label="인기 질문"><button v-for="item in popular" :key="item.id" type="button" :disabled="answerBusy" @click="entry=item.question;send()">{{item.question}}</button></div></li><li v-for="(m,i) in messages" :key="i" :class="{'is-user':m.role==='이용자'}"><b>{{m.role}}</b><p>{{m.text}}</p></li></ol><form class="public-chat-form" @submit.prevent="send"><label for="public-chat-input">질문</label><div class="public-chat-compose"><input id="public-chat-input" v-model="entry" placeholder="궁금한 내용을 입력하세요" autocomplete="off" required><button type="submit" :disabled="answerBusy">{{answerBusy?'조회 중…':'보내기'}}</button></div><nav aria-label="챗봇 이용 안내"><RouterLink to="/c-notice">공지사항</RouterLink><RouterLink to="/info/faq">FAQ</RouterLink><RouterLink to="/my-inquiries">문의하기</RouterLink></nav></form></dialog></template>
