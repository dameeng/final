import {adminSidebarGroups,sidebarLinkActive} from '../data/adminSidebar'
export function organizeSidebar(root:HTMLElement){
 const menu=root.querySelector('.side nav');if(!menu)return
 const current=location.pathname
 const home=document.createElement('a');home.href='/admin-dashboard';home.className='sidebar-home';home.textContent='종합 현황'
 if(current==='/admin-dashboard')home.setAttribute('aria-current','page')
 menu.parentElement?.querySelector(':scope>.sidebar-home')?.remove()
 menu.before(home);menu.replaceChildren();menu.classList.add('admin-sidebar-groups')
 for(const group of adminSidebarGroups){
  const section=document.createElement('details');section.className='sidebar-group'
  section.open=group.links.some(link=>sidebarLinkActive(link,current))||(group===adminSidebarGroups[0]&&current==='/admin-dashboard')
  const summary=document.createElement('summary');summary.className='sidebar-group-label';summary.textContent=group.title;section.append(summary)
  for(const link of group.links){const anchor=document.createElement('a');anchor.href=link[1]||link[2]!;anchor.textContent=link[0]!;if(sidebarLinkActive(link,current))anchor.setAttribute('aria-current','page');section.append(anchor)}
  menu.append(section)
 }
}
