// Server-only API bridge: credentials are never sent to the browser bundle.
const cache = new Map()
const number = (value, min, max) => {
  const n = Number(value)
  if (value == null || value === '' || !Number.isFinite(n) || n < min || n > max)
    throw new Error('INVALID_INPUT')
  return n
}
const coordinate = (value) => {
  const parts = (value || '').split(',')
  if (parts.length !== 2) throw new Error('INVALID_INPUT')
  return `${number(parts[0], 124, 132)},${number(parts[1], 32, 40)}`
}
async function upstream(url, headers) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })
  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('PROVIDER_RESPONSE')
  }
  if (!response.ok) {
    const error = new Error(
      response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH' : 'PROVIDER_RESPONSE',
    )
    error.status = response.status
    throw error
  }
  return data
}
function grid(lat, lng) {
  const rad = Math.PI / 180,
    re = 6371.00877 / 5,
    slat1 = 30 * rad,
    slat2 = 60 * rad,
    olon = 126 * rad,
    olat = 38 * rad
  const sn =
      Math.log(Math.cos(slat1) / Math.cos(slat2)) /
      Math.log(Math.tan(Math.PI / 4 + slat2 / 2) / Math.tan(Math.PI / 4 + slat1 / 2)),
    sf = (Math.pow(Math.tan(Math.PI / 4 + slat1 / 2), sn) * Math.cos(slat1)) / sn,
    ro = (re * sf) / Math.pow(Math.tan(Math.PI / 4 + olat / 2), sn),
    ra = (re * sf) / Math.pow(Math.tan(Math.PI / 4 + (lat * rad) / 2), sn),
    theta = (lng * rad - olon) * sn
  return {
    nx: Math.floor(ra * Math.sin(theta) + 43 + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + 136 + 0.5),
  }
}
function key(env, name) {
  if (!env[name]) throw new Error('MISSING_KEY')
  return env[name]
}
export function navigationApi(env) {
  const middleware = async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/navigation/')) return next()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    const reply = (status, body) => {
      res.statusCode = status
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'GET')
      return reply(405, { success: false, message: 'GET 요청만 지원합니다.' })
    try {
      let data
      const p = url.searchParams,
        path = url.pathname.replace('/api/navigation/', '')
      if (path === 'places') {
        const q = (p.get('q') || '').trim()
        if (!q || q.length > 100) throw Error('INVALID_INPUT')
        const target = new URL('https://dapi.kakao.com/v2/local/search/keyword.json')
        target.searchParams.set('query', q)
        target.searchParams.set('x', '129.0756')
        target.searchParams.set('y', '35.1796')
        target.searchParams.set('size', '8')
        const body = await upstream(target, {
          Authorization: `KakaoAK ${key(env, 'KAKAO_REST_API_KEY')}`,
        })
        data = (body.documents || []).map((row) => ({
          id: row.id,
          name: row.place_name,
          address: row.road_address_name || row.address_name,
          lng: Number(row.x),
          lat: Number(row.y),
        }))
      } else if (path === 'directions') {
        const target = new URL('https://apis-navi.kakaomobility.com/v1/directions')
        target.searchParams.set('origin', coordinate(p.get('origin')))
        target.searchParams.set('destination', coordinate(p.get('destination')))
        target.searchParams.set('alternatives', 'true')
        target.searchParams.set('summary', 'false')
        target.searchParams.set('roadevent', '0')
        if (p.has('waypoint')) target.searchParams.set('waypoints', coordinate(p.get('waypoint')))
        const body = await upstream(target, {
          Authorization: `KakaoAK ${key(env, 'KAKAO_REST_API_KEY')}`,
        })
        data = (body.routes || []).filter((route) => route.result_code === 0)
      } else if (path === 'weather') {
        const lat = number(p.get('lat'), 32, 40),
          lng = number(p.get('lng'), 124, 132),
          { nx, ny } = grid(lat, lng),
          id = `weather:${nx},${ny}`,
          stored = cache.get(id)
        if (stored && stored.until > Date.now()) data = stored.data
        else {
          const date = new Date(Date.now() + 9 * 3600000 - 50 * 60000),
            day = date.toISOString().slice(0, 10).replaceAll('-', ''),
            hour = String(date.getUTCHours()).padStart(2, '0') + '00'
          const target = new URL(
            'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst',
          )
          Object.entries({
            serviceKey: key(env, 'KMA_SERVICE_KEY'),
            pageNo: '1',
            numOfRows: '100',
            dataType: 'JSON',
            base_date: day,
            base_time: hour,
            nx: String(nx),
            ny: String(ny),
          }).forEach(([k, v]) => target.searchParams.set(k, v))
          const body = await upstream(target)
          if (body.response?.header?.resultCode !== '00') throw Error('WEATHER_UNAVAILABLE')
          const items = body.response?.body?.items?.item
          if (!Array.isArray(items) || !items.length) throw Error('WEATHER_UNAVAILABLE')
          const values = Object.fromEntries(
              items.map((row) => [row.category, Number(row.obsrValue)]),
            ),
            rain = values.PTY
          data = {
            temperature: values.T1H ?? null,
            humidity: values.REH ?? null,
            rainfall: values.RN1 ?? null,
            windSpeed: values.WSD ?? null,
            condition:
              {
                0: '강수 없음',
                1: '비',
                2: '비/눈',
                3: '눈',
                5: '빗방울',
                6: '빗방울/눈날림',
                7: '눈날림',
              }[rain] || '기상 상태 미제공',
            observedAt: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T${hour.slice(0, 2)}:00:00+09:00`,
            source: '기상청',
          }
          cache.set(id, { until: Date.now() + 600000, data })
        }
      } else if (path === 'cctv') {
        const lat = number(p.get('lat'), 32, 40),
          lng = number(p.get('lng'), 124, 132),
          id = `cctv:${lat.toFixed(2)},${lng.toFixed(2)}`,
          stored = cache.get(id)
        if (stored && stored.until > Date.now()) data = stored.data
        else {
          const rows = await Promise.all(
            ['its', 'ex'].map(async (type) => {
              const target = new URL('https://openapi.its.go.kr:9443/cctvInfo')
              Object.entries({
                apiKey: key(env, 'ITS_API_KEY'),
                type,
                cctvType: '1',
                minX: String(lng - 0.05),
                maxX: String(lng + 0.05),
                minY: String(lat - 0.05),
                maxY: String(lat + 0.05),
                getType: 'json',
              }).forEach(([k, v]) => target.searchParams.set(k, v))
              const body = await upstream(target)
              const values = body.response?.data ?? body.data
              if (body.response?.datacount === 0) return []
              if (!Array.isArray(values)) throw Error('CCTV_UNAVAILABLE')
              return values
            }),
          )
          data = rows
            .flat()
            .filter((row) => /^https?:\/\//i.test(row.cctvurl || ''))
            .map((row) => ({
              name: row.cctvname,
              url: row.cctvurl,
              lat: Number(row.coordy),
              lng: Number(row.coordx),
              type: String(row.cctvtype || '1'),
            }))
            .sort(
              (a, b) =>
                (a.lat - lat) ** 2 + (a.lng - lng) ** 2 - ((b.lat - lat) ** 2 + (b.lng - lng) ** 2),
            )
            .slice(0, 12)
          cache.set(id, { until: Date.now() + 120000, data })
        }
      } else return reply(404, { success: false, message: '조회 주소를 확인해 주세요.' })
      reply(200, { success: true, data })
    } catch (error) {
      const messages = {
        INVALID_INPUT: '입력한 장소·좌표를 확인해 주세요.',
        MISSING_KEY: '서버 API 키 설정이 필요합니다.',
        PROVIDER_AUTH: 'API 제공처에서 인증을 거부했습니다. 키와 서비스 사용 설정을 확인해 주세요.',
        PROVIDER_RESPONSE: 'API 제공처의 응답을 확인하지 못했습니다.',
        NO_ROUTE: '이 구간에서 자동차 경로를 찾지 못했습니다.',
        WEATHER_UNAVAILABLE: '기상청 관측 정보를 받아오지 못했습니다.',
        CCTV_UNAVAILABLE: 'ITS CCTV 정보를 받아오지 못했습니다.',
      }
      reply(error.message === 'INVALID_INPUT' ? 400 : 502, {
        success: false,
        message:
          messages[error.message] ||
          'API 연결이 지연되거나 실패했습니다. 잠시 후 다시 시도해 주세요.',
      })
    }
  }
  return {
    name: 'routel-navigation-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
