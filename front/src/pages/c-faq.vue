<script setup lang="ts">
import {computed,ref} from 'vue'
import {RouterLink} from 'vue-router'
import {useApp} from '../stores/app'
import '../styles/c-faq.css'
type Question={category:string;question:string;answer:string}
const app=useApp(),category=ref('전체'),query=ref('')
const categories=['전체','차량 등록','앱 설치','알림','계정']
const defaults:Question[]=[
 {category:'차량 등록',question:'번호판은 어떻게 등록하나요?',answer:'로그인 후 마이페이지의 내 차량에서 차량 번호를 입력하고 등록할 수 있습니다.'},
 {category:'앱 설치',question:'앱은 어디서 설치하나요?',answer:'About us의 앱 소개 페이지에서 설치 안내를 확인할 수 있습니다. 공식 설치 주소는 준비되는 대로 안내합니다.'},
 {category:'알림',question:'알림이 오지 않아요',answer:'마이페이지의 계정 설정에서 알림 설정을 확인해 주세요. 휴대폰의 앱 알림 권한도 함께 확인해 주세요.'},
 {category:'계정',question:'휴대폰 번호를 바꾸고 싶어요',answer:'마이페이지의 계정 설정에서 휴대폰 번호 변경 및 본인 인증을 진행해 주세요. 실제 변경은 인증 서비스 연결 후 이용할 수 있습니다.'},
]
const questions=computed(()=>[...defaults,...app.faqs].filter(row=>(category.value==='전체'||row.category===category.value)&&(!query.value||`${row.question} ${row.answer}`.includes(query.value))))
</script>
<template><main class="wire-page customer-content page-c-faq"><h1>자주 묻는 질문 (FAQ)</h1><p class="faq-lead">서비스 이용 중 궁금한 내용을 확인해 보세요.</p><div class="faq-search"><label for="faq-search">질문·답변 검색</label><input id="faq-search" v-model.trim="query" type="search" placeholder="궁금한 내용을 검색해 주세요"></div><nav class="faq-categories" aria-label="FAQ 분류"><button v-for="item in categories" :key="item" :aria-pressed="category===item" @click="category=item">{{item}}</button></nav><div class="faq-questions"><details v-for="(item,index) in questions" :key="item.question+index"><summary><span class="faq-category">{{item.category}}</span><strong>{{item.question}}</strong><span class="faq-chevron" aria-hidden="true">⌄</span></summary><p>{{item.answer}}</p></details><p v-if="!questions.length" class="faq-empty">조건에 맞는 질문이 없습니다.</p></div><p class="faq-help">찾는 답변이 없나요? <RouterLink to="/my-inquiries">문의하기 →</RouterLink></p></main></template>
