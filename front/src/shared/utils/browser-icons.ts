import icon192 from '../../customer-web/assets/images/pwa-192x192.png'
import icon512 from '../../customer-web/assets/images/pwa-512x512.png'

/** Browser icons only. Installation manifest remains owned by the existing PWA config. */
export function applyBrowserIcons() {
  for (const [rel, href] of [['icon', icon512], ['apple-touch-icon', icon192]]) {
    const existing = Array.from(document.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`))
    const link = existing.shift() ?? document.createElement('link')
    existing.forEach(item => item.remove())
    link.rel = rel!
    link.href = href!
    link.type = 'image/png'
    document.head.append(link)
  }
}
