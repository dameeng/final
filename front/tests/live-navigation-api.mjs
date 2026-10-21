import { createServer } from 'vite'
const server = await createServer({
  configLoader: 'runner',
  server: { host: 'localhost', port: 8296, strictPort: true },
})
try {
  await server.listen()
  for (const [name, path] of [
    ['places', 'places?q=' + encodeURIComponent('부산역')],
    ['directions', 'directions?origin=129.0422,35.1151&destination=129.0595,35.1578'],
    ['weather', 'weather?lat=35.1578&lng=129.0595'],
    ['cctv', 'cctv?lat=35.1578&lng=129.0595'],
  ]) {
    const response = await fetch('http://localhost:8296/api/navigation/' + path)
    const body = await response.json()
    console.log(
      JSON.stringify({
        name,
        status: response.status,
        success: body.success,
        count: Array.isArray(body.data) ? body.data.length : undefined,
        message: body.message,
        weather: body.data?.condition,
      }),
    )
  }
} finally {
  await server.close()
}
