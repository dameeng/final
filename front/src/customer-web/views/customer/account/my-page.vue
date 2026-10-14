<script setup lang="ts">
import { useWaterMotion } from "../../../composables/use-water-motion";
const waterPaused = useWaterMotion();
import ThemeSwitch from "../../../../shared/components/ThemeSwitch.vue";
import PasswordInput from "../../../../shared/components/PasswordInput.vue";
import { onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { customerSession, logoutCustomer } from '../../../services/session'
import { openPostcode } from '../../../services/postcode'
import '../../../styles/views/customer/account/my-page.css'

type Profile = { loginId: string; name: string; birthDate: string; email: string; phone: string; emergency: string; zipcode: string; roadAddress: string; detailAddress: string }
type Car = { id: number; carNum: string }
type Inquiry = { id: number; title: string; status: 'PENDING' | 'ANSWERED'; createdAt: string }
type InquiryDetail = Inquiry & { content: string; replyContent: string | null; replyAuthorName: string | null; repliedAt: string | null }
const router = useRouter()
const profile = ref<Profile | null>(null)
const cars = ref<Car[]>([])
const carInputs = ref([{ key: 0, number: '' }])
let nextCarKey = 1
const inquiries = ref<Inquiry[]>([])
const selectedInquiry = ref<InquiryDetail | null>(null)
const inquiryTitle = ref('')
const inquiryContent = ref('')
const inquiryPage = ref(1)
const inquiryPages = ref(1)
const inquiryError = ref('')
const message = ref('')
// 결과 메시지는 화면 대신 알림창으로 보여줍니다.
watch(message, (text) => {
  if (!text) return
  window.alert(text)
  message.value = ''
})
const busy = ref(false)
const withdrawing = ref(false)
const password = reactive({ currentPassword: '', newPassword: '', newPasswordConfirm: '' })
async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.success === false) throw new Error(result?.message || '요청을 처리하지 못했습니다.')
  return result.data as T
}
async function load() {
  try {
    const [account, registered] = await Promise.all([api<Profile>('/api/customers/me'), api<Car[]>('/api/customers/me/cars')])
    profile.value = account
    cars.value = registered
    await loadInquiries()
  } catch (e) {
    if (!customerSession.id) { await router.replace('/login'); return }
    message.value = (e as Error).message
  }
}
async function run(action: () => Promise<void>) {
  if (busy.value) return
  busy.value = true; message.value = ''
  try { await action() } catch (e) { message.value = (e as Error).message }
  finally { busy.value = false }
}
function findPostcode() {
  void openPostcode((data) => { if (profile.value) { profile.value.zipcode = data.zonecode; profile.value.roadAddress = data.roadAddress || data.address } }).catch((e) => { message.value = (e as Error).message })
}
function saveProfile() {
  if (!profile.value) return
  const { phone, emergency, zipcode, roadAddress, detailAddress } = profile.value
  void run(async () => { profile.value = await api<Profile>('/api/customers/me', 'PUT', { phone, emergency, zipcode, roadAddress, detailAddress }); message.value = '회원정보를 수정했습니다.' })
}
function registerCar() {
  const numbers = carInputs.value.map(item => item.number.trim()).filter(Boolean)
  if (!numbers.length) return
  if (cars.value.length + numbers.length > 3) { message.value = '차량은 최대 3대까지 등록할 수 있습니다.'; return }
  if (new Set(numbers).size !== numbers.length) { message.value = '중복된 차량번호가 있습니다.'; return }
  void run(async () => {
    let saved = 0
    let failure = ''
    for (const item of carInputs.value) {
      if (!item.number.trim()) continue
      try {
        await api<Car>('/api/customers/me/cars', 'POST', { carNum: item.number.trim() })
        item.number = ''
        saved++
      } catch (error) {
        failure = `${saved}대 등록 완료. ${(error as Error).message}`
        break
      }
    }
    cars.value = await api<Car[]>('/api/customers/me/cars')
    carInputs.value = carInputs.value.filter(item => item.number.trim())
    if (!carInputs.value.length) carInputs.value = [{ key: nextCarKey++, number: '' }]
    message.value = failure || `${saved}대의 차량을 등록했습니다.`
  })
}
function addCarInput() {
  if (cars.value.length + carInputs.value.length < 3) carInputs.value.push({ key: nextCarKey++, number: '' })
}
// 등록한 차량번호 수정: PUT /api/customers/me/cars/{carId}
const editingCarId = ref<number | null>(null)
const editingCarNum = ref('')
function startEditCar(car: Car) { editingCarId.value = car.id; editingCarNum.value = car.carNum }
function cancelEditCar() { editingCarId.value = null; editingCarNum.value = '' }
function saveCar() {
  const id = editingCarId.value
  const carNum = editingCarNum.value.trim()
  if (id == null || !carNum) { message.value = '차량번호를 입력해 주세요.'; return }
  if (cars.value.some(car => car.id !== id && car.carNum === carNum)) { message.value = '이미 등록된 차량번호입니다.'; return }
  void run(async () => {
    await api<Car>(`/api/customers/me/cars/${id}`, 'PUT', { carNum })
    cars.value = await api<Car[]>('/api/customers/me/cars')
    cancelEditCar()
    message.value = '차량번호를 수정했습니다.'
  })
}
function removeCar(id: number) {
  if (!window.confirm('이 차량을 삭제할까요?')) return
  void run(async () => { await api<void>(`/api/customers/me/cars/${id}`, 'DELETE'); cars.value = await api<Car[]>('/api/customers/me/cars'); message.value = '차량을 삭제했습니다.' })
}
function changePassword() {
  if (password.newPassword !== password.newPasswordConfirm) { message.value = '새 비밀번호가 일치하지 않습니다.'; return }
  void run(async () => { await api<void>('/api/customers/me/password', 'PUT', password); password.currentPassword = ''; password.newPassword = ''; password.newPasswordConfirm = ''; message.value = '비밀번호를 변경했습니다.' })
}
async function loadInquiries() {
  try {
    inquiryError.value = ''
    const data = await api<{ items: Inquiry[]; totalPages: number }>(`/api/customers/me/inquiries?page=${inquiryPage.value}&size=10`)
    inquiries.value = data.items || []
    inquiryPages.value = data.totalPages || 1
  } catch (error) { inquiryError.value = (error as Error).message }
}
function openInquiry(id: number) {
  void run(async () => { selectedInquiry.value = await api<InquiryDetail>(`/api/customers/me/inquiries/${id}`) })
}
function submitInquiry() {
  if (!inquiryTitle.value.trim() || !inquiryContent.value.trim()) return
  void run(async () => {
    await api<InquiryDetail>('/api/customers/me/inquiries', 'POST', { title: inquiryTitle.value.trim(), content: inquiryContent.value.trim() })
    inquiryTitle.value = ''; inquiryContent.value = ''; selectedInquiry.value = null
    inquiryPage.value = 1
    await loadInquiries()
    message.value = '문의가 등록되었습니다.'
  })
}
function withdraw() {
  if (withdrawing.value) return
  if (!window.confirm('정말 탈퇴하시겠습니까? 탈퇴 후에는 로그인할 수 없습니다.')) return
  withdrawing.value = true
  void run(async () => {
    await api<void>('/api/customers/me', 'DELETE')
    await logoutCustomer().catch(() => {})
    await router.push('/')
  }).finally(() => { withdrawing.value = false })
}
onMounted(() => void load())
</script>
<template>
  <main class="routel-content-page account-page">
    <h1>마이페이지</h1>
    <section id="account-theme">
      <h2>화면 설정</h2>
      <div class="account-display-settings">
        <ThemeSwitch storage-key="routel-customer-theme" />
        <div class="account-motion-setting"><span>배경 물결</span><button type="button" aria-label="물결 애니메이션 일시정지" :aria-pressed="waterPaused" @click="waterPaused = !waterPaused">{{ waterPaused ? '물결 재생' : '물결 일시정지' }}</button></div>
      </div>
    </section>
    <p v-if="!profile"><RouterLink to="/login">로그인</RouterLink> 후 회원정보와 차량을 확인할 수 있습니다.</p>
    <template v-else>
      <nav class="account-links" aria-label="마이페이지 메뉴">
        <a href="#account-info">회원정보 수정</a><a href="#account-emergency">비상연락처</a><a href="#account-cars">차량 등록</a><a href="#account-qa">Q&amp;A</a>
      </nav>
      <section id="account-info">
        <h2>회원정보 수정</h2>
        <form @submit.prevent="saveProfile">
          <label>아이디 <input :value="profile.loginId" disabled /></label>
          <label>이름 <input :value="profile.name" disabled /></label>
          <label>이메일 <input :value="profile.email" disabled /></label>
          <label>전화번호 <input v-model.trim="profile.phone" type="tel" required /></label>
          <label>우편번호 <span class="account-postcode"><input v-model.trim="profile.zipcode" required /><button type="button" @click="findPostcode">주소 검색</button></span></label>
          <label>도로명주소 <input v-model.trim="profile.roadAddress" required /></label>
          <label class="account-wide">상세주소 <input v-model.trim="profile.detailAddress" /></label>
          <button :disabled="busy">정보 저장</button>
        </form>
      </section>
      <section id="account-emergency">
        <h2>비상연락처 등록</h2>
        <form @submit.prevent="saveProfile">
          <label>비상연락처 <input v-model.trim="profile.emergency" type="tel" placeholder="010-1234-5678" /></label>
          <button :disabled="busy">비상연락처 저장</button>
        </form>
      </section>
      <section id="account-cars">
        <h2>차량 등록 <small>({{ cars.length }}/3)</small></h2>
        <div class="account-cars-layout">
        <form @submit.prevent="registerCar">
          <div v-for="(item, index) in carInputs" :key="item.key" class="account-car-row">
            <label>차량번호 {{ index + 1 }} <input v-model.trim="item.number" placeholder="12가3456" :disabled="cars.length >= 3" /></label>
            <button v-if="index > 0" type="button" @click="carInputs.splice(index, 1)">입력칸 삭제</button>
          </div>
          <div class="account-car-actions">
          <button type="button" :disabled="busy || cars.length + carInputs.length >= 3" @click="addCarInput">+ 차량 입력칸 추가</button>
          <button :disabled="busy || cars.length >= 3">차량 등록</button>
          </div>
        </form>
        <div class="account-car-list">
          <h3>등록된 차량</h3>
          <ul>
            <li v-for="car in cars" :key="car.id">
              <template v-if="editingCarId === car.id">
                <input v-model.trim="editingCarNum" placeholder="12가3456" aria-label="차량번호 수정" />
                <button type="button" :disabled="busy" @click="saveCar">저장</button>
                <button type="button" :disabled="busy" @click="cancelEditCar">취소</button>
              </template>
              <template v-else>
                <span class="account-car-num">{{ car.carNum }}</span>
                <button type="button" :disabled="busy" @click="startEditCar(car)">수정</button>
                <button type="button" :disabled="busy" @click="removeCar(car.id)">삭제</button>
              </template>
            </li>
            <li v-if="!cars.length" class="account-car-empty">등록된 차량이 없습니다.</li>
          </ul>
        </div>
        </div>
      </section>
      <section id="account-qa">
        <h2>내 Q&amp;A</h2>
        <form @submit.prevent="submitInquiry">
          <label>제목 <input v-model.trim="inquiryTitle" maxlength="200" required /></label>
          <label class="account-wide">문의 내용 <textarea v-model.trim="inquiryContent" rows="5" required /></label>
          <button :disabled="busy">문의 등록</button>
        </form>
        <p v-if="inquiryError" role="alert">{{ inquiryError }}</p>
        <ul class="account-inquiries">
          <li v-for="item in inquiries" :key="item.id"><button class="account-inquiry-title" type="button" @click="openInquiry(item.id)">{{ item.title }}</button><span class="review-status" :data-status="item.status">{{ item.status === 'ANSWERED' ? '답변 완료' : '답변 대기' }}</span><time>{{ item.createdAt?.slice(0, 10) }}</time></li>
          <li v-if="!inquiries.length">작성한 문의가 없습니다.</li>
        </ul>
        <p v-if="inquiryPages > 1"><button :disabled="inquiryPage <= 1" @click="inquiryPage--; loadInquiries()">이전</button> {{ inquiryPage }} / {{ inquiryPages }} <button :disabled="inquiryPage >= inquiryPages" @click="inquiryPage++; loadInquiries()">다음</button></p>
        <article v-if="selectedInquiry" class="account-inquiry-detail">
          <h3>{{ selectedInquiry.title }}</h3>
          <p>{{ selectedInquiry.content }}</p>
          <h4>관리자 답변</h4>
          <p v-if="selectedInquiry.replyContent">{{ selectedInquiry.replyContent }}</p>
          <p v-else>아직 답변이 없습니다.</p>
          <button type="button" @click="selectedInquiry = null">닫기</button>
        </article>
      </section>
      <section>
        <h2>비밀번호 변경</h2>
        <form class="account-password-form" @submit.prevent="changePassword">
          <label>현재 비밀번호 <PasswordInput v-model="password.currentPassword" required /></label>
          <label>새 비밀번호 <PasswordInput v-model="password.newPassword" required /></label>
          <label>새 비밀번호 확인 <PasswordInput v-model="password.newPasswordConfirm" required /></label>
          <button :disabled="busy">비밀번호 변경</button>
        </form>
      </section>
      <section id="account-withdraw">
        <h2>회원 탈퇴</h2>
        <p>탈퇴하면 로그인이 불가능해집니다.</p>
        <button type="button" class="account-withdraw-button" :disabled="busy || withdrawing" @click="withdraw">회원 탈퇴</button>
      </section>
    </template>
  </main>
</template>