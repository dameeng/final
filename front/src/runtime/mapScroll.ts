/** Leave ordinary wheel gestures to the page; zoom only with Ctrl or Command. */
export function pageFriendlyMapScroll(host: HTMLElement, map: any) {
  map.setZoomable(false)
  host.title = '지도 확대·축소: Ctrl(⌘) + 스크롤 또는 + / − 버튼'
  const wheel = (event: WheelEvent) => {
    event.stopImmediatePropagation()
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    if (event.deltaY)
      map.setLevel(Math.max(1, Math.min(14, map.getLevel() + (event.deltaY > 0 ? 1 : -1))))
  }
  host.addEventListener('wheel', wheel, { capture: true, passive: false })
  return () => host.removeEventListener('wheel', wheel, true)
}
