import {ref,watch,type Ref} from 'vue'
const themes = new Map<string, Ref<'light'|'dark'>>()
export function useTheme(key:string,fallback:'light'|'dark'='light'){
 const existing=themes.get(key)
 if(existing)return existing
 const saved=localStorage.getItem(key)
 const initial=saved==='light'||saved==='dark'?saved:saved==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):fallback
 const mode=ref<'light'|'dark'>(initial)
 themes.set(key,mode)
 watch(mode,value=>{localStorage.setItem(key,value);document.documentElement.dataset.routelTheme=value},{immediate:true})
 return mode
}
