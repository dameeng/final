import {defineStore} from 'pinia'
import {ref} from 'vue'
import {backend} from '../services/backend'
import {useApp} from './app'
export const useManagerNotifications=defineStore('manager-notifications',()=>{
 const unread=ref(0),app=useApp();let sequence=0
 function reset(){sequence++;unread.value=0}
 async function refresh(){if(app.account?.role!=='REGIONAL_ADMIN'){reset();return}const id=app.account.id,version=++sequence;try{const data=await backend('/api/managers/me/notifications/unread-count');if(version===sequence&&app.account?.id===id&&app.account.role==='REGIONAL_ADMIN'){unread.value=Math.max(0,Number(data?.total)||0);app.unread=unread.value}}catch{/* The notification list shows actionable API errors. */}}
 return {unread,refresh,reset}
})
