<script setup lang="ts">
import {computed,ref} from 'vue'
import {useRoute} from 'vue-router'
import {useApp} from '../stores/app'
import PostcodeSearch from '../components/PostcodeSearch.vue'
import CustomerAppPage from '../components/CustomerAppPage.vue'
const route=useRoute(),app=useApp(),section=computed(()=>String(route.params.section)),message=ref('')
const titles:Record<string,string>={profile:'회원정보 수정',emergency:'비상 연락처',cars:'내 차량',settings:'알림 수신 설정',inquiries:'내 문의',withdraw:'회원 탈퇴'}
const zipcode=ref(''),roadAddress=ref(''),detailAddress=ref('')
const name=ref(app.account?.name||''),email=ref(''),phone=ref(''),emergency=ref(''),car=ref(''),cars=ref<string[]>([]),alerts=ref(true),notices=ref(true),subject=ref(''),body=ref(''),inquiries=ref<{title:string;body:string}[]>([])
function save(){message.value='입력 내용을 확인했습니다. 실제 저장은 회원 서비스 연동 후 이용할 수 있습니다.'}
function addCar(){if(!car.value.trim())return;cars.value.push(car.value.trim());car.value='';message.value='화면 미리보기용으로 추가했습니다. 서버에는 저장되지 않습니다.'}
function addInquiry(){inquiries.value.unshift({title:subject.value,body:body.value});subject.value='';body.value='';message.value='문의 화면 미리보기입니다. 실제 문의는 전송되지 않았습니다.'}
</script>
<template><CustomerAppPage :title="titles[section]||'마이페이지'"><p v-if="app.memberPreview" class="app-account-note">회원 화면 미리보기 · 실제 회원정보는 불러오지 않습니다.</p>
 <form v-if="section==='profile'" class="app-account-form" @submit.prevent="save"><label>아이디<input :value="app.account?.id||'미리보기'" readonly></label><label>이름<input v-model="name" autocomplete="name" required></label><label>이메일<input v-model="email" type="email" autocomplete="email"></label><label>휴대폰 번호<input v-model="phone" type="tel" autocomplete="tel"></label><label>우편번호<input v-model="zipcode" inputmode="numeric" autocomplete="postal-code"><PostcodeSearch @select="address=>{zipcode=address.zipcode;roadAddress=address.roadAddress;detailAddress=''}"/></label><label>도로명 주소<input v-model="roadAddress" autocomplete="address-line1"></label><label>상세주소<input v-model="detailAddress" autocomplete="address-line2"></label><button class="app-account-primary">정보 저장</button></form>
 <form v-else-if="section==='emergency'" class="app-account-form" @submit.prevent="save"><label>비상 연락처<input v-model="emergency" type="tel" placeholder="010-0000-0000" required></label><button class="app-account-primary">연락처 저장</button></form>
 <section v-else-if="section==='cars'"><form class="app-account-form" @submit.prevent="addCar"><label>차량 번호<input v-model="car" placeholder="예: 123가 4567" required maxlength="15"></label><button class="app-account-primary">차량 추가</button></form><p v-if="!cars.length">현재 표시할 차량이 없습니다.</p><div v-for="(item,index) in cars" :key="index" class="app-account-card">{{item}} <button @click="cars.splice(index,1)">삭제</button></div></section>
 <form v-else-if="section==='settings'" class="app-account-form" @submit.prevent="save"><label class="app-check"><input v-model="alerts" type="checkbox">위험·통제 알림</label><label class="app-check"><input v-model="notices" type="checkbox">공지사항 알림</label><button class="app-account-primary">설정 저장</button></form>
 <section v-else-if="section==='inquiries'"><h2>문의 내역</h2><p v-if="!inquiries.length">현재 표시할 문의가 없습니다.</p><details v-for="(item,index) in inquiries" :key="index"><summary>{{item.title}} · 미리보기</summary><p>{{item.body}}</p></details><h2>문의 작성</h2><form class="app-account-form" @submit.prevent="addInquiry"><label>제목<input v-model="subject" required maxlength="100"></label><label>내용<textarea v-model="body" required rows="5" maxlength="3000"></textarea></label><button class="app-account-primary">문의 화면 확인</button></form></section>
 <section v-else-if="section==='withdraw'" class="app-account-card"><h2>회원 탈퇴 안내</h2><p>탈퇴하면 회원정보와 등록한 차량, 알림 설정이 삭제됩니다.</p><p>회원 서비스 연동 전에는 이 화면에서 실제 탈퇴를 진행할 수 없습니다.</p></section>
 <p class="app-account-note">현재 화면은 프런트엔드 구성 단계이며, 정보 저장·인증·문의 전송은 서버 연결 후 제공됩니다.</p><p role="status">{{message}}</p></CustomerAppPage></template>
