import facilities from '../data/c-map.json'
import { workflows } from '../services/workflows'
import { loadKakao, geocode } from '../services/kakao'
import { tablePagination } from './table-pagination'
export function meeting(name: string, ctx: any) {
  const root = ctx.root as HTMLElement
  root.querySelectorAll('.bot-fab').forEach((e) => e.remove())
  const connection = root.querySelector('.conn>span:nth-of-type(2)')
  if (connection) connection.textContent = '구성 예시 · 수신 정보 없음'
  if (
    name === 'c-map' ||
    name === 'admin-dashboard' ||
    name.startsWith('pm-') ||
    name === 'fac-detail'
  ) {
    const note = document.createElement('p')
    note.className = 'data-provenance'
    note.textContent = '시설명: 부산 공개 자료 · 상태·수치: 구성 예시 · 지도: 위치 도식'
    root.querySelector('main,.wrap')?.prepend(note)
  }
  if (name === 'c-notice' && ctx.router.currentRoute.value.query.tab === 'faq')
    root.querySelectorAll<HTMLElement>('.ab a')[1]?.click()
  if (name.startsWith('pm-') && ['pm-equipment', 'pm-queue'].includes(name)) {
    const search = root.querySelector<HTMLInputElement>('#f-q')
    if (search) {
      search.closest('.search')?.remove()
      search.remove()
    }
    let select = root.querySelector<HTMLSelectElement>('[aria-label="시설 선택"]')
    if (!select) {
      select = document.createElement('select')
      select.setAttribute('aria-label', '시설 선택')
      root.querySelector('.filters,.tools,#qchips')?.before(select)
    }
    const rows = Array.from(
      root.querySelectorAll<HTMLTableRowElement>('#tbl tbody tr,#qtbl tbody tr'),
    )
    const sites = facilities.F.map((f) => String(f[0])).filter((n) =>
      rows.some((r) => r.textContent?.includes(n)),
    )
    select.replaceChildren()
    ;['시설 전체', ...sites].forEach((n, i) => {
      const o = document.createElement('option')
      o.value = i ? n : ''
      o.textContent = n
      select!.append(o)
    })
    const paginate = tablePagination(ctx, name==='pm-equipment'?'#tbl':'#qtbl')
    const filter = () =>
      paginate((row: HTMLTableRowElement) => {
        const facility =
          (!select!.value || row.textContent?.includes(select!.value)) &&
          (!ctx.router.currentRoute.value.query.pending || row.dataset.st !== 'done')
        const type = root.querySelector<HTMLSelectElement>('#f-type')?.value || ''
        const state =
          root.querySelector<HTMLElement>('#qchips [aria-pressed="true"]')?.dataset.st || ''
        const level =
          root.querySelector<HTMLElement>('.chip[aria-pressed="true"][data-lv]')?.dataset.lv || ''
        return !!(
          facility &&
          (!type || row.dataset.type === type) &&
          (!state || row.dataset.st === state) &&
          (!level || row.dataset.lv === level)
        )
      })
    ctx.on(root, 'change', () => ctx.setTimeout(filter, 0))
    ctx.on(root, 'click', (event: Event) => {if(!(event.target as Element).closest('.service-pagination'))ctx.setTimeout(filter, 0)})
    ctx.setTimeout(filter, 0)
    const dialog = root.querySelector<HTMLDialogElement>('#reg')
    if (dialog) {
      dialog.classList.add('drawer-dialog')
      dialog.querySelector('h2')!.textContent = '조치 등록 · 완료'
      const memo = dialog.querySelector<HTMLTextAreaElement>('#reg-memo')
      if (memo) memo.required = true
      const save = dialog.querySelector<HTMLButtonElement>('#reg-ok')
      if (save) {
        save.textContent = '조치 등록·완료'
        ctx.on(
          save,
          'click',
          async (e: Event) => {
            e.preventDefault()
            e.stopImmediatePropagation()
            if (!memo?.value.trim()) {
              ctx.notify('조치 내용을 입력해 주세요.')
              memo?.focus()
              return
            }
            if (!workflows.maintenance) {
              ctx.notify('조치 저장 서비스가 연결되지 않았습니다. 입력 내용은 유지됩니다.')
              return
            }
            save.disabled = true
            try {
              await workflows.maintenance({
                equipmentId:
                  dialog.querySelector('#reg-eq')?.textContent?.match(/[A-Z]+-\d+/)?.[0] || '',
                at: (dialog.querySelector('#reg-at') as HTMLInputElement)?.value || '',
                type: (dialog.querySelector('#reg-type') as HTMLSelectElement)?.value || '',
                memo: memo.value,
                result: (dialog.querySelector('#reg-res') as HTMLSelectElement)?.value || '',
              })
              dialog.close()
              ctx.notify('조치가 등록되어 완료 처리되었습니다.')
            } catch (e) {
              ctx.notify(e instanceof Error ? e.message : '저장 실패')
            } finally {
              save.disabled = false
            }
          },
          { capture: true },
        )
      }
    }
    if (name === 'pm-queue' && dialog) {
      let focus: HTMLElement | null = null
      ctx.on(
        root,
        'click',
        (e: Event) => {
          const target = e.target as Element
          const action = target.closest<HTMLElement>('.q-act,#qtbl a[href="/pm-equipment-detail"]')
          if (!action) return
          e.preventDefault()
          e.stopImmediatePropagation()
          const row = action.closest('tr')!
          dialog.querySelector('#reg-eq')!.textContent = row.children[2]?.textContent || ''
          focus = action
          dialog.showModal()
          dialog.querySelector<HTMLElement>('textarea')?.focus()
        },
        { capture: true },
      )
      ctx.on(dialog, 'close', () => focus?.focus())
    }
  }
  if (name === 'fac-detail') {
    root.querySelectorAll('.snapshot-details,#snap').forEach((e) => e.remove())
    root.querySelector('.video .live')?.remove()
    const filter = root.querySelector<HTMLSelectElement>('[aria-label="차량 상태 필터"]')
    if (filter) {
      filter.value = '잔류 중'
      filter.dispatchEvent(new Event('change'))
    }
    const section = root.querySelector('#s-sign'),
      grid = section?.querySelector('.grid2'),
      history = root.querySelector('#shist')?.closest('section')
    if (grid && history) {
      const manual = grid.children[1]!
      const frame = document.createElement('div')
      frame.className = 'vms-layout'
      manual.before(frame)
      frame.append(manual, history)
      grid.classList.add('vms-sections')
    }
    const hint = root.querySelector('#m-go')?.nextElementSibling
    if (hint) hint.textContent = '실제 전광판 제어는 연결된 서비스 응답 후 반영됩니다.'
    ctx.on(
      root,
      'click',
      (e: Event) => {
        const button = (e.target as Element).closest<HTMLElement>(
          '#m-go,#t-auto,#tp-save,#a-save,#t-save,#c-save,#cf-ok,#ctl,#release',
        )
        if (!button) return
        e.preventDefault()
        e.stopImmediatePropagation()
        ctx.notify('실제 저장·제어 서비스 연결이 필요합니다.')
      },
      { capture: true },
    )
    root.querySelectorAll<HTMLInputElement>('#a-la,#a-lo').forEach((i) => {
      i.value = ''
      i.placeholder = '지도 위치 확인 후 입력'
    })
    const exportButton = document.createElement('a')
    exportButton.className = 'btn'
    exportButton.textContent = '사건 문서 보기·내보내기'
    exportButton.href = '/handover-pdf'
    root.querySelector('.page-head')?.append(exportButton)
  }
  // Stop the previous example control before it can claim a real operation succeeded.
  ctx.on(
    root,
    'click',
    (e: Event) => {
      const button = (e.target as Element).closest<HTMLElement>('button')
      if (!button) return
      if (
        name === 'fac-list' &&
        button.textContent?.trim() === '확인' &&
        button.closest('dialog')
      ) {
        e.preventDefault()
        e.stopImmediatePropagation()
        ctx.notify('통제 서비스 연결이 필요합니다. 실제 시설 상태는 변경하지 않았습니다.')
      }
    },
    { capture: true },
  )
  if (name === 'fac-new' || name === 'fac-detail') mountLocationEditor(name, ctx)
}
async function mountLocationEditor(name: string, ctx: any) {
  const root = ctx.root as HTMLElement
  root.querySelectorAll('.bot-fab').forEach((e) => e.remove())
  const connection = root.querySelector('.conn>span:nth-of-type(2)')
  if (connection) connection.textContent = '구성 예시 · 수신 정보 없음'
  const address = root.querySelector<HTMLInputElement>(name === 'fac-new' ? '#a' : '#a-a'),
    lat = root.querySelector<HTMLInputElement>(name === 'fac-new' ? '#la' : '#a-la'),
    lng = root.querySelector<HTMLInputElement>(name === 'fac-new' ? '#lo' : '#a-lo')
  if (!address || !lat || !lng) return
  const host = document.createElement('div')
  host.className = 'meeting-map-layout'
  host.setAttribute('aria-label', '시설 위치 지도')
  host.textContent = '주소 검색 후 지도 위치를 확인하세요.'
  address.closest('.form-grid')?.after(host)
  if (name === 'fac-new') {
    root.querySelector('.mapsel')?.remove()
    Array.from(root.querySelectorAll('button'))
      .filter((b) => b.textContent?.trim() === '주소 검색')
      .forEach((b) => b.remove())
  }
  let alive = true,
    map: any,
    marker: any,
    k: any,
    request = 0
  const sdkEvents: { target: any; name: string; fn: any }[] = []
  ctx.on(root, 'page-dispose', () => {
    alive = false
    sdkEvents.forEach((x) => k?.maps.event.removeListener(x.target, x.name, x.fn))
    marker?.setMap(null)
  })
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = '주소·지도 위치 확인'
  address.after(b)
  ctx.on(address, 'input', () => {
    request++
    lat.value = ''
    lng.value = ''
  })
  ctx.on(b, 'click', async () => {
    const seq = ++request,
      query = address.value
    b.disabled = true
    try {
      const pos = await geocode(query)
      if (!alive || seq !== request) return
      k = await loadKakao()
      if (!alive || seq !== request) return
      const center = new k.maps.LatLng(pos.lat, pos.lng)
      if (!map) {
        host.replaceChildren()
        map = new k.maps.Map(host, { center, level: 3 })
        marker = new k.maps.Marker({ map, position: center, draggable: true })
        const pick = (e: any) => {
          const point = e.latLng || marker.getPosition()
          marker.setPosition(point)
          lat.value = String(point.getLat())
          lng.value = String(point.getLng())
          const ticket = ++request
          new k.maps.services.Geocoder().coord2Address(
            point.getLng(),
            point.getLat(),
            (result: any, status: any) => {
              if (alive && ticket === request && status === k.maps.services.Status.OK)
                address.value =
                  result[0].road_address?.address_name ||
                  result[0].address?.address_name ||
                  address.value
            },
          )
        }
        k.maps.event.addListener(map, 'click', pick)
        k.maps.event.addListener(marker, 'dragend', pick)
        sdkEvents.push(
          { target: map, name: 'click', fn: pick },
          { target: marker, name: 'dragend', fn: pick },
        )
      } else {
        map.setCenter(center)
        marker.setPosition(center)
      }
      lat.value = String(pos.lat)
      lng.value = String(pos.lng)
    } catch (e) {
      ctx.notify(e instanceof Error ? e.message : '주소 검색 실패')
    } finally {
      if (alive) b.disabled = false
    }
  })
  if (name === 'fac-new') {
    const save = root.querySelector('#save')
    if (save)
      ctx.on(
        save,
        'click',
        (e: Event) => {
          e.preventDefault()
          e.stopImmediatePropagation()
          if (!lat.value || !lng.value) {
            ctx.notify('주소를 검색하고 지도 위치를 확인해 주세요.')
            return
          }
          ctx.notify('시설 등록 서비스 연결이 필요합니다. 입력 내용은 유지됩니다.')
        },
        { capture: true },
      )
  }
}
