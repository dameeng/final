import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
export const busanDistricts = [
  '중구',
  '서구',
  '동구',
  '영도구',
  '부산진구',
  '동래구',
  '남구',
  '북구',
  '해운대구',
  '사하구',
  '금정구',
  '강서구',
  '연제구',
  '수영구',
  '사상구',
  '기장군',
]
const defaults = { name: '○○○', district: '동구', department: '', email: '', phone: '' }
export const useAdminProfile = defineStore('adminProfile', () => {
  const profile = ref({ ...defaults })
  try {
    const value = JSON.parse(localStorage.getItem('routel-admin-profile') || 'null')
    if (value && busanDistricts.includes(value.district))
      profile.value = {
        ...defaults,
        ...Object.fromEntries(
          Object.keys(defaults)
            .filter((key) => typeof value[key] === 'string')
            .map((key) => [key, value[key]]),
        ),
      }
  } catch {}
  const region = computed(() => `부산 ${profile.value.district}`)
  function save(value: typeof defaults) {
    localStorage.setItem('routel-admin-profile', JSON.stringify(value))
    profile.value = { ...value }
  }
  return { profile, region, save }
})
