export function organizeSidebar(root:HTMLElement){
 const menu=root.querySelector('.side nav');if(!menu)return
 const links=Array.from(menu.querySelectorAll<HTMLAnchorElement>('a'))
 const home=links.find(a=>a.getAttribute('href')==='/admin-dashboard');if(home){home.classList.add('sidebar-home');menu.before(home)}
 const groups=[['시설·안전',['/fac-list','/verify','/pm-equipment','/jurisdiction-contacts']],['고객·지원',['/cs-customers','/bot-stats']],['기록',['/logs']]] as const
 groups.forEach(([title,paths])=>{const group=document.createElement('details');group.className='sidebar-group';group.open=paths.some(path=>links.some(a=>a.getAttribute('href')===path&&a.hasAttribute('aria-current')))||(title==='시설·안전'&&location.pathname==='/admin-dashboard');const label=document.createElement('summary');label.className='sidebar-group-label';label.textContent=title;group.append(label);paths.forEach(path=>{const link=links.find(a=>a.getAttribute('href')===path);if(link)group.append(link)});menu.append(group)})
 root.querySelectorAll<HTMLAnchorElement>('.side-bot a').forEach(a=>{if(a.getAttribute('href')==='/index')a.remove()})
}
