import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, extname, sep } from 'node:path'
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)))
const port = Number(process.env.PORT || 8283)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname.startsWith('/api/')) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({ success: false, message: 'Backend is not connected. Use preview mode.' }),
      )
      return
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname))
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403)
      res.end()
      return
    }
    let target = path
    try {
      if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html')
    } catch {
      if (extname(target)) {
        res.writeHead(404)
        res.end()
        return
      }
      target = resolve(root, 'index.html')
    }
    const body = await readFile(target)
    res.writeHead(200, {
      'Content-Type': types[extname(target)] || 'application/octet-stream',
      'Cache-Control':
        extname(target) === '.html' || target.endsWith('sw.js') ? 'no-cache' : 'public, max-age=0',
      'Service-Worker-Allowed': '/',
    })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end()
  }
}).listen(port, '0.0.0.0', () =>
  console.log(
    `ROUTEL PWA: http://localhost:${port}/pwa/ (HTTPS hosting required for phone installation)`,
  ),
)
