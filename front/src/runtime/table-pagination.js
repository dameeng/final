// Keep legacy table interactions on their original rows while paging filtered results.
export function tablePagination(ctx, selector) {
  const table=ctx.document.querySelector(selector)
  const rows=Array.from(table.querySelectorAll('tbody tr'))
  const nav=ctx.document.createElement('nav')
  nav.className='service-pagination'
  nav.setAttribute('aria-label','목록 페이지')
  nav.style.cssText='display:flex;align-items:center;justify-content:center;gap:14px;margin:16px 0'
  const previous=ctx.document.createElement('button'), status=ctx.document.createElement('span'), next=ctx.document.createElement('button')
  previous.type=next.type='button';previous.className=next.className='btn sm'
  previous.textContent='이전';next.textContent='다음';status.setAttribute('aria-live','polite')
  nav.append(previous,status,next);table.after(nav)
  let page=1, matches=()=>true
  function render() {
    const filtered=rows.filter(matches), pages=Math.max(1,Math.ceil(filtered.length/10))
    page=Math.min(page,pages)
    const visible=new Set(filtered.slice((page-1)*10,page*10))
    rows.forEach(row=>{row.hidden=!visible.has(row)})
    status.textContent=`${page} / ${pages} 페이지`
    previous.disabled=page===1;next.disabled=page===pages
  }
  ctx.on(previous,'click',()=>{page--;render()})
  ctx.on(next,'click',()=>{page++;render()})
  render()
  return predicate=>{matches=predicate;page=1;render()}
}
