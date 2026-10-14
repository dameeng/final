<script setup lang="ts">
import { formatDecimal } from '../../utils/format-number'

import PasswordInput from "../../components/PasswordInput.vue";
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { adminKey } from '../main'
import { useRouter } from 'vue-router'
import { adminApi } from '../services/admin-api'
const props = defineProps<{ section: string; boardKind?: '공지' | 'FAQ' }>()
const { state } = inject(adminKey)!
const titles: Record<string, string> = {
  members: '회원관리',
  opinions: '접수의견 처리',
  notices: '공지·FAQ 관리',
  push: '앱푸시 발송로그',
  logs: '제어이력 로그',
  profile: '마이페이지',
}
const router=useRouter()
function createNotice(kind:'공지'|'FAQ'){void router.push({path:state.profile?.role==='REGIONAL_ADMIN'?'/regional/notices/new':state.profile?.role==='SUPER_ADMIN'?'/super/notices/new':'/notices/new',query:{kind}})}
const PAGE_SIZE = 10
const message = ref('')
const page = ref(1)
const totalPages = ref(1)
const loading = ref(false)
let poll: ReturnType<typeof setInterval> | undefined

type PageBody<T> = { items: T[]; totalPages: number }
// 검색어·필터는 전부 서버 쿼리(keyword, status 등)로 보내고, 목록은 페이지 단위로 받는다.
async function fetchPage<T>(path: string, params: Record<string, string | number | boolean | null | undefined>): Promise<T[]> {
  const query = new URLSearchParams({ page: String(page.value), size: String(PAGE_SIZE) })
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value != null) query.set(key, String(value))
  }
  const body = await adminApi<PageBody<T>>(`${path}?${query}`)
  totalPages.value = Math.max(1, Number(body?.totalPages ?? 1))
  return body?.items ?? []
}

// ---------- 회원관리 ----------
type CustomerRow = { id: number; loginId: string; name: string; email: string; phone: string; carNums: string[]; createdAt: string; withdrawn: boolean }
const members = ref<CustomerRow[]>([])
const memberKeyword = ref('')
const memberCarNum = ref('')
const includeWithdrawn = ref(false)
const selected = ref<string | number | null>(null)
const selectedMember = computed(() => members.value.find((x) => x.id === selected.value) ?? null)
const editForm = ref({ phone: '', emergency: '', zipcode: '', roadAddress: '', detailAddress: '' })
const editingMemberId = ref<number | null>(null)
const savingMember = ref(false)
async function loadMembers() {
  members.value = await fetchPage<CustomerRow>('/customers', {
    keyword: memberKeyword.value.trim(), carNum: memberCarNum.value.trim(), includeWithdrawn: includeWithdrawn.value || null,
  })
}
// 관리자용 고객 단건 조회 API가 없어 주소는 목록에 없다. 수정은 전화번호·주소를 관리자가 직접 입력한다.
function startEditMember(row: CustomerRow) {
  editingMemberId.value = row.id
  editForm.value = { phone: row.phone ?? '', emergency: '', zipcode: '', roadAddress: '', detailAddress: '' }
  message.value = ''
}
async function saveMember() {
  const form = editForm.value
  if (!editingMemberId.value || savingMember.value) return
  if (!form.phone.trim() || !form.zipcode.trim() || !form.roadAddress.trim()) { message.value = '전화번호, 우편번호, 도로명주소는 필수입니다.'; return }
  savingMember.value = true
  try {
    await adminApi(`/customers/${editingMemberId.value}`, {
      method: 'PUT',
      body: JSON.stringify({
        phone: form.phone.trim(), emergency: form.emergency.trim() || null,
        zipcode: form.zipcode.trim(), roadAddress: form.roadAddress.trim(), detailAddress: form.detailAddress.trim() || null,
      }),
    })
    message.value = '회원 정보를 수정했습니다.'
    editingMemberId.value = null
    await loadCurrent()
  } catch (e) { message.value = (e as Error).message }
  finally { savingMember.value = false }
}
async function withdrawMember(row: CustomerRow) {
  if (!window.confirm(`${row.name}(${row.loginId}) 회원을 탈퇴 처리할까요?`)) return
  try {
    await adminApi(`/customers/${row.id}/withdraw`, { method: 'POST' })
    message.value = '탈퇴 처리했습니다.'
    if (editingMemberId.value === row.id) editingMemberId.value = null
    await loadCurrent()
  } catch (e) { message.value = (e as Error).message }
}

// ---------- 접수의견 ----------
type OpinionRow = { id: number; title: string; customerName: string; status: 'PENDING' | 'ANSWERED' }
const opinions = ref<OpinionRow[]>([])
const opinionKeyword = ref('')
const opinionStatus = ref<'' | 'PENDING' | 'ANSWERED'>('')
const opinionLink=(id:number)=>`${state.profile?.role==='SUPER_ADMIN'?'/super/customers':state.profile?.role==='REGIONAL_ADMIN'?'/regional/customers':''}/inquiries/${id}`
const answer = ref('')
const opinionDetail = ref('')
const opinionHasReply = ref(false)
const savingReply = ref(false)
async function loadOpinions() {
  opinions.value = await fetchPage<OpinionRow>('/inquiries', { keyword: opinionKeyword.value.trim(), status: opinionStatus.value })
}
async function selectOpinion(id: number) {
  selected.value = id
  opinionDetail.value = ''
  answer.value = ''
  opinionHasReply.value = false
  try {
    const data = await adminApi<{ content?: string; replyContent?: string | null }>(`/inquiries/${id}`)
    opinionDetail.value = String(data?.content ?? '')
    opinionHasReply.value = data?.replyContent != null
    answer.value = String(data?.replyContent ?? '')
  } catch (error) { message.value = (error as Error).message }
}
async function replyOpinion() {
  if (!selected.value || !answer.value.trim() || savingReply.value) { message.value = '처리 내용을 입력해 주세요.'; return }
  savingReply.value = true
  try {
    await adminApi(`/inquiries/${selected.value}/reply`, {
      method: opinionHasReply.value ? 'PUT' : 'POST', body: JSON.stringify({ content: answer.value.trim() }),
    })
    message.value = opinionHasReply.value ? '답변을 수정했습니다.' : '답변을 등록했습니다.'
    opinionHasReply.value = true
    await loadCurrent()
  } catch (error) { message.value = (error as Error).message }
  finally { savingReply.value = false }
}
async function deleteReply() {
  if (!selected.value || !opinionHasReply.value || savingReply.value || !window.confirm('이 답변을 삭제할까요? 문의는 답변 대기 상태로 돌아갑니다.')) return
  savingReply.value = true
  try {
    await adminApi(`/inquiries/${selected.value}/reply`, { method: 'DELETE' })
    answer.value = ''
    opinionHasReply.value = false
    message.value = '답변을 삭제했습니다.'
    await loadCurrent()
  } catch (error) { message.value = (error as Error).message }
  finally { savingReply.value = false }
}

// ---------- 공지·FAQ ----------
type NoticeRow = { id: number; title: string; important: boolean }
type FaqRow = { id: number; question: string }
const noticeList = ref<{ id: number; kind: '공지' | 'FAQ'; title: string; important: boolean }[]>([])
const listKind = ref<'공지' | 'FAQ'>(props.boardKind || '공지')
const noticeKeyword = ref('')
const importantOnly = ref(false)
const noticeKind = ref<'공지' | 'FAQ'>(props.boardKind || '공지')
const noticeTitle = ref('')
const noticeContent = ref('')
const noticeImportant = ref(false)
const editingNoticeId = ref<number | null>(null)
const savingNotice = ref(false)
async function loadNotices() {
  if (listKind.value === '공지') {
    const rows = await fetchPage<NoticeRow>('/notices', { keyword: noticeKeyword.value.trim(), important: importantOnly.value ? true : null })
    noticeList.value = rows.map((row) => ({ id: row.id, kind: '공지', title: row.title, important: row.important === true }))
  } else {
    const rows = await fetchPage<FaqRow>('/faqs', { keyword: noticeKeyword.value.trim() })
    noticeList.value = rows.map((row) => ({ id: row.id, kind: 'FAQ', title: row.question, important: false }))
  }
}
async function selectNotice(kind: '공지' | 'FAQ', id: number | null = null) {
  noticeKind.value = kind
  editingNoticeId.value = id
  noticeTitle.value = id ? noticeList.value.find((item) => item.id === id && item.kind === kind)?.title ?? '' : ''
  noticeContent.value = ''
  noticeImportant.value = id ? noticeList.value.find((item) => item.id === id && item.kind === kind)?.important ?? false : false
  message.value = ''
  if (id) {
    try {
      const data = await adminApi<{ content?: string; answer?: string; important?: boolean }>(`/${kind === '공지' ? 'notices' : 'faqs'}/${id}`)
      noticeContent.value = String(kind === '공지' ? data?.content ?? '' : data?.answer ?? '')
      if (kind === '공지') noticeImportant.value = data?.important === true
    } catch { message.value = '게시글 상세 조회에 실패했습니다.' }
  }
}
async function saveNotice() {
  if (!noticeTitle.value.trim() || !noticeContent.value.trim() || savingNotice.value) {
    message.value = '제목과 내용을 입력해 주세요.'
    return
  }
  const kind = noticeKind.value
  savingNotice.value = true
  try {
    await adminApi(`/${kind === '공지' ? 'notices' : 'faqs'}${editingNoticeId.value ? `/${editingNoticeId.value}` : ''}`, {
      method: editingNoticeId.value ? 'PUT' : 'POST',
      body: JSON.stringify(kind === '공지'
        ? { title: noticeTitle.value.trim(), content: noticeContent.value.trim(), important: noticeImportant.value }
        : { question: noticeTitle.value.trim(), answer: noticeContent.value.trim() }),
    })
    message.value = '게시글이 저장되었습니다.'
    noticeTitle.value = ''
    noticeContent.value = ''
    noticeImportant.value = false
    editingNoticeId.value = null
    await loadCurrent()
  } catch (error) { message.value = (error as Error).message }
  finally { savingNotice.value = false }
}
async function deleteNotice(kind: '공지' | 'FAQ', id: number, title: string) {
  if (savingNotice.value || !window.confirm(`'${title}' ${kind} 글을 삭제할까요?`)) return
  savingNotice.value = true
  message.value = ''
  try {
    await adminApi(`/${kind === '공지' ? 'notices' : 'faqs'}/${id}`, { method: 'DELETE' })
    if (editingNoticeId.value === id && noticeKind.value === kind) await selectNotice(kind)
    await loadCurrent()
    message.value = '게시글을 삭제했습니다.'
  } catch (error) { message.value = (error as Error).message }
  finally { savingNotice.value = false }
}

// ---------- 앱푸시 발송로그 (alert_log) ----------
type AlertLogRow = { id: number; underpassId: number; customerId: number; carNum: string; alertType: 'PREDICTIVE' | 'ROI_FINAL'; sentAt: string }
const alertLogs = ref<AlertLogRow[]>([])
const pushUnderpassId = ref('')
const pushCustomerId = ref('')
const pushAlertType = ref<'' | 'PREDICTIVE' | 'ROI_FINAL'>('')
const pushFrom = ref('')
const pushTo = ref('')
const alertTypeLabel: Record<string, string> = { PREDICTIVE: '접근 예측 경고', ROI_FINAL: '진입 직전 최종 경고' }
async function loadAlertLogs() {
  alertLogs.value = await fetchPage<AlertLogRow>('/alert-logs', {
    underpassId: pushUnderpassId.value, customerId: pushCustomerId.value.trim(), alertType: pushAlertType.value,
  })
}
// 기간은 서버 파라미터가 없어서 현재 페이지 안에서만 거른다.
const pushLogs = computed(() =>
  alertLogs.value
    .filter((x) => (!pushFrom.value || x.sentAt >= pushFrom.value) && (!pushTo.value || x.sentAt <= `${pushTo.value}T23:59:59`))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
)

// ---------- 제어이력 (underpass_event + display_log) ----------
type ControlHistoryRow = {
  kind: 'EVENT' | 'DISPLAY'
  eventType: 'BLOCK' | 'RELEASE' | 'RISK_LEVEL_UP' | 'RISK_LEVEL_DOWN' | null
  riskLevel: string | null; riskScoreAtEvent: number | null; messageType: string | null
  operatorId: number | null; createdAt: string
}
const logsFacilityId = ref('')
const logsType = ref('')
const rawControlHistory = ref<ControlHistoryRow[]>([])
const EVENT_LABEL: Record<string, string> = { BLOCK: '통제', RELEASE: '해제', RISK_LEVEL_UP: '위험도 상승', RISK_LEVEL_DOWN: '위험도 하락' }
const DISPLAY_LABEL: Record<string, string> = { RISK_WARNING: '전광판 위험 경고', BLOCK_NOTICE: '전광판 차단 안내', RELEASE_NOTICE: '전광판 해제 안내' }
watch(() => state.underpasses, (rows) => {
  if (!logsFacilityId.value && rows.length) logsFacilityId.value = rows[0].id
}, { immediate: true })
async function loadControlHistory() {
  if (!logsFacilityId.value) { rawControlHistory.value = []; return }
  const data = await adminApi<ControlHistoryRow[]>(`/underpasses/${encodeURIComponent(logsFacilityId.value)}/events`)
  rawControlHistory.value = Array.isArray(data) ? data : []
}
function actionLabel(row: ControlHistoryRow) {
  if (row.kind === 'DISPLAY') return DISPLAY_LABEL[row.messageType ?? ''] ?? row.messageType ?? '전광판'
  const label = EVENT_LABEL[row.eventType ?? ''] ?? row.eventType ?? '-'
  return row.eventType?.startsWith('RISK_LEVEL') && row.riskLevel ? `${label} (${row.riskLevel}${row.riskScoreAtEvent != null ? `, ${formatDecimal(row.riskScoreAtEvent)}점` : ''})` : label
}
const controlLogs = computed(() => {
  const facilityName = state.underpasses.find((item) => item.id === logsFacilityId.value)?.name ?? logsFacilityId.value
  return rawControlHistory.value
    .filter((row) => !logsType.value || (logsType.value === 'DISPLAY' ? row.kind === 'DISPLAY' : row.kind === 'EVENT' && row.eventType === logsType.value))
    .map((row) => ({
      time: row.createdAt,
      facility: facilityName,
      action: actionLabel(row),
      operator: row.operatorId != null ? `관리자 #${row.operatorId}` : '-',
    }))
})

// ---------- 마이페이지: 비밀번호 변경 ----------
const pwForm = ref({ currentPassword: '', newPassword: '', newPasswordConfirm: '' })
const savingPassword = ref(false)
async function changePassword() {
  const form = pwForm.value
  if (savingPassword.value) return
  if (!form.currentPassword || !form.newPassword) { message.value = '현재 비밀번호와 새 비밀번호를 입력해 주세요.'; return }
  if (form.newPassword !== form.newPasswordConfirm) { message.value = '새 비밀번호 확인이 일치하지 않습니다.'; return }
  savingPassword.value = true
  try {
    await adminApi('/managers/me/password', { method: 'PUT', body: JSON.stringify(form) })
    pwForm.value = { currentPassword: '', newPassword: '', newPasswordConfirm: '' }
    message.value = '비밀번호를 변경했습니다.'
  } catch (e) { message.value = (e as Error).message }
  finally { savingPassword.value = false }
}

// ---------- 공통: 현재 섹션 불러오기 / 검색 / 페이징 ----------
async function loadCurrent() {
  loading.value = true
  try {
    if (props.section === 'members') await loadMembers()
    else if (props.section === 'opinions') await loadOpinions()
    else if (props.section === 'notices') await loadNotices()
    else if (props.section === 'push') await loadAlertLogs()
    else if (props.section === 'logs') await loadControlHistory()
  } catch (e) { message.value = (e as Error).message }
  finally { loading.value = false }
}
function search() { page.value = 1; void loadCurrent() }
function movePage(step: number) {
  const next = page.value + step
  if (next < 1 || next > totalPages.value) return
  page.value = next
  void loadCurrent()
}
watch(() => props.section, () => { page.value = 1; totalPages.value = 1; selected.value = null; message.value = ''; void loadCurrent() })
watch(logsFacilityId, () => void loadCurrent())
onMounted(() => { void loadCurrent(); poll = setInterval(() => void loadCurrent(), 30000) })
onBeforeUnmount(() => clearInterval(poll))
</script>

<template>
<div class="routel-admin-page" :class="{'qa-profile-centered':section==='profile'}">
  <h1>{{ titles[section] }}</h1>
  <template v-if="section === 'profile'">
    <p v-if="state.authLoading" role="status">직원 정보 확인 중입니다.</p>
    <dl class="staff-profile">
      <div><dt>이름</dt><dd>{{ state.profile?.name || '정보 없음' }}</dd></div>
      <div><dt>역할</dt><dd>{{ state.profile?.role === 'SUPER_ADMIN' ? '총관리자' : state.profile?.role === 'REGIONAL_ADMIN' ? '지역 관리자' : state.profile?.role || '정보 없음' }}</dd></div>
      <div><dt>담당 지역</dt><dd>{{ state.profile?.regionName || '담당 지역 미지정' }}</dd></div>
      <div v-for="field in (['loginId','email','phone','department','position'] as const)" v-show="state.profile?.[field]" :key="field"><dt>{{ {loginId:'아이디',email:'이메일',phone:'연락처',department:'부서',position:'직책'}[field] }}</dt><dd>{{ state.profile?.[field] }}</dd></div>
    </dl>
    <h2>비밀번호 변경</h2>
    <form class="manager-password-form" @submit.prevent="changePassword">
      <p><label>현재 비밀번호 <PasswordInput v-model="pwForm.currentPassword" autocomplete="current-password" required /></label></p>
      <p><label>새 비밀번호 <PasswordInput v-model="pwForm.newPassword" autocomplete="new-password" minlength="8" maxlength="64" required /></label></p>
      <p><label>새 비밀번호 확인 <PasswordInput v-model="pwForm.newPasswordConfirm" autocomplete="new-password" minlength="8" maxlength="64" required /></label></p>
      <button type="submit" :disabled="savingPassword">{{ savingPassword ? '변경 중...' : '비밀번호 변경' }}</button>
    </form>
    <p role="status">{{ message }}</p>
    <router-link to="/login">로그인 화면</router-link>
  </template>
  <template v-else>
    <p v-if="message && section !== 'opinions' && section !== 'notices'" role="status">{{ message }}</p>

    <template v-if="section === 'members'">
      <form @submit.prevent="search">
        <label>검색 <input v-model="memberKeyword" type="search" placeholder="아이디·이름·이메일 등" /></label>
        <label>차량번호 <input v-model="memberCarNum" type="search" /></label>
        <label><input v-model="includeWithdrawn" type="checkbox" @change="search" /> 탈퇴 회원 포함</label>
        <button type="submit">조회</button>
      </form>
      <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table">
        <tbody>
          <tr><th>아이디</th><th>이름</th><th>가입일</th><th>상태</th><th>관리</th></tr>
          <tr v-for="x in members" :key="x.id">
            <td>{{ x.loginId }}</td>
            <td>{{ x.name }}</td>
            <td>{{ x.createdAt }}</td>
            <td>{{ x.withdrawn ? '탈퇴' : '정상' }}</td>
            <td>
              <button type="button" @click="selected = x.id">보기</button>
              <template v-if="!x.withdrawn">
                <button type="button" @click="startEditMember(x)">수정</button>
                <button class="routel-danger-action" type="button" @click="withdrawMember(x)">탈퇴 처리</button>
              </template>
            </td>
          </tr>
          <tr v-if="!members.length"><td colspan="5" align="center">회원이 없습니다.</td></tr>
        </tbody>
      </table></div>
      <dl v-if="selectedMember">
        <dt>이메일</dt><dd>{{ selectedMember.email }}</dd>
        <dt>전화번호</dt><dd>{{ selectedMember.phone }}</dd>
        <dt>등록 차량</dt><dd>{{ selectedMember.carNums.length ? selectedMember.carNums.join(', ') : '없음' }}</dd>
      </dl>
      <form v-if="editingMemberId" @submit.prevent="saveMember">
        <h2>회원 정보 수정 · {{ editingMemberId }}</h2>
        <p>아이디·이름·생년월일·이메일은 수정할 수 없습니다. 주소는 목록에 없어 직접 입력해야 합니다.</p>
        <p><label>전화번호 <input v-model="editForm.phone" required /></label></p>
        <p><label>비상연락처 <input v-model="editForm.emergency" /></label></p>
        <p><label>우편번호 <input v-model="editForm.zipcode" required /></label></p>
        <p><label>도로명주소 <input v-model="editForm.roadAddress" required /></label></p>
        <p><label>상세주소 <input v-model="editForm.detailAddress" /></label></p>
        <button type="submit" :disabled="savingMember">{{ savingMember ? '저장 중...' : '수정 저장' }}</button>
        <button type="button" @click="editingMemberId = null">취소</button>
      </form>
    </template>

    <template v-else-if="section === 'opinions'">
      <form @submit.prevent="search">
        <label>검색 <input v-model="opinionKeyword" type="search" /></label>
        <label>처리 상태 <select v-model="opinionStatus" @change="search"><option value="">전체</option><option value="PENDING">대기</option><option value="ANSWERED">답변 완료</option></select></label>
        <button type="submit">조회</button>
      </form>
      <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table">
        <tbody>
          <tr><th>제목</th><th>작성자</th><th>처리 상태</th></tr>
          <tr v-for="x in opinions" :key="x.id">
            
            <td><router-link :to="opinionLink(x.id)">{{ x.title }}</router-link></td>
            <td>{{ x.customerName }}</td>
            <td><span class="review-status" :data-status="x.status">{{ x.status === 'ANSWERED' ? '답변 완료' : '답변 대기' }}</span></td>
            
          </tr>
          <tr v-if="!opinions.length"><td colspan="3" align="center">접수된 의견이 없습니다.</td></tr>
        </tbody>
      </table></div>

      <p role="status">{{ message }}</p>
    </template>

    <template v-else-if="section === 'notices'">
      <p>
        <button v-if="!boardKind || boardKind==='공지'" type="button" @click="createNotice('공지')">공지 등록</button>
        <button v-if="!boardKind || boardKind==='FAQ'" type="button" @click="createNotice('FAQ')">FAQ 등록</button>
      </p>
      <form v-if="editingNoticeId" class="review-editor" @submit.prevent="saveNotice">
        <h2>{{ editingNoticeId ? '게시글 수정' : `${noticeKind} 등록` }}</h2>
        <p><label>제목 <input v-model="noticeTitle" required /></label></p>
        <p><label>내용 <textarea v-model="noticeContent" rows="6" cols="55" required /></label></p>
        <p v-if="noticeKind === '공지'"><label><input v-model="noticeImportant" type="checkbox" /> 중요 공지</label></p>
        <button type="submit" :disabled="savingNotice">{{ savingNotice ? '저장 중...' : '게시글 저장' }}</button>
      </form>
      <h2>목록</h2>
      <form @submit.prevent="search">
        <label v-if="!boardKind">구분 <select v-model="listKind" @change="search"><option value="공지">공지</option><option value="FAQ">FAQ</option></select></label>
        <label>검색 <input v-model="noticeKeyword" type="search" /></label>
        <label v-if="listKind === '공지'"><input v-model="importantOnly" type="checkbox" @change="search" /> 중요 공지만</label>
        <button type="submit">조회</button>
      </form>
      <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table">
        <tbody>
          <tr><th>번호</th><th>구분</th><th>제목</th><th>관리</th></tr>
          <tr v-for="x in noticeList" :key="`${x.kind}-${x.id}`">
            <td>{{ x.id }}</td>
            <td>{{ x.kind }}</td>
            <td>{{ x.important ? '중요 · ' : '' }}{{ x.title }}</td>
            <td>
              <button type="button" @click="selectNotice(x.kind, x.id)">수정</button>
              <button class="routel-danger-action" type="button" :disabled="savingNotice" @click="deleteNotice(x.kind, x.id, x.title)">삭제</button>
            </td>
          </tr>
          <tr v-if="!noticeList.length"><td colspan="4" align="center">게시글이 없습니다.</td></tr>
        </tbody>
      </table></div>
      <p role="status">{{ message }}</p>
    </template>

    <template v-else-if="section === 'push'">
      <form @submit.prevent="search">
        <label>시설
          <select v-model="pushUnderpassId" @change="search">
            <option value="">전체</option>
            <option v-for="item in state.underpasses" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </label>
        <label>고객 ID <input v-model="pushCustomerId" type="number" min="1" /></label>
        <label>유형
          <select v-model="pushAlertType" @change="search">
            <option value="">전체</option>
            <option value="PREDICTIVE">접근 예측 경고</option>
            <option value="ROI_FINAL">진입 직전 최종 경고</option>
          </select>
        </label>
        <button type="submit">조회</button>
      </form>
      <p>기간 <input v-model="pushFrom" type="date" aria-label="조회 시작일" /> ~ <input v-model="pushTo" type="date" aria-label="조회 종료일" /> (현재 페이지 안에서만 거릅니다)</p>
      <p>실제 FCM 발송 연동 전 단계로, 발송 대상으로 기록된 로그입니다(성공/실패 결과는 아직 없습니다).</p>
      <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table">
        <tbody>
          <tr><th>발송일시</th><th>유형</th><th>지하차도 ID</th><th>차량번호</th><th>고객 ID</th></tr>
          <tr v-for="x in pushLogs" :key="x.id">
            <td>{{ x.sentAt }}</td>
            <td>{{ alertTypeLabel[x.alertType] ?? x.alertType }}</td>
            <td>{{ x.underpassId }}</td>
            <td>{{ x.carNum }}</td>
            <td>{{ x.customerId }}</td>
          </tr>
          <tr v-if="!pushLogs.length"><td colspan="5" align="center">발송 내역이 없습니다.</td></tr>
        </tbody>
      </table></div>
    </template>

    <template v-else>
      <p>
        <label>시설
          <select v-model="logsFacilityId">
            <option v-for="item in state.underpasses" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </label>
        <label>유형
          <select v-model="logsType">
            <option value="">전체</option>
            <option value="BLOCK">통제</option>
            <option value="RELEASE">해제</option>
            <option value="RISK_LEVEL_UP">위험도 상승</option>
            <option value="RISK_LEVEL_DOWN">위험도 하락</option>
            <option value="DISPLAY">전광판 조작</option>
          </select>
        </label>
      </p>
      <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table">
        <tbody>
          <tr><th>시간</th><th>시설</th><th>작업</th><th>담당자</th></tr>
          <tr v-for="(x, i) in controlLogs" :key="i">
            <td>{{ x.time }}</td>
            <td>{{ x.facility }}</td>
            <td>{{ x.action }}</td>
            <td>{{ x.operator }}</td>
          </tr>
          <tr v-if="!controlLogs.length"><td colspan="4" align="center">제어이력이 없습니다.</td></tr>
        </tbody>
      </table></div>
    </template>

    <p v-if="section !== 'logs'" class="admin-pagination">
      <button type="button" :disabled="page <= 1 || loading" @click="movePage(-1)">이전</button>
      {{ page }} / {{ totalPages }}
      <button type="button" :disabled="page >= totalPages || loading" @click="movePage(1)">다음</button>
    </p>
  </template>
</div>
</template>