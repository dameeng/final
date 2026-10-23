import { uiIconSvg } from '../utils/ui-icons'
import { organizeSidebar } from './sidebar'
import { meeting } from './meeting'
import { watch } from 'vue'
import { loadKakao, geocode } from '../services/kakao'
export function enhance(name: string, ctx: any) {
  const root = ctx.root as HTMLElement
  const store = ctx.store
  const popup = root.querySelector<HTMLElement>('#bell-pop'),
    bellButton = root.querySelector<HTMLElement>('#bell-btn')
  if (popup && bellButton) {
    const close = () => {
      popup.hidden = true
      bellButton.setAttribute('aria-expanded', 'false')
    }
    ctx.on(document, 'pointerdown', (event: Event) => {
      if (
        !popup.hidden &&
        !popup.contains(event.target as Node) &&
        !bellButton.contains(event.target as Node)
      )
        close()
    })
    popup.querySelectorAll<HTMLLIElement>('.pop-list li').forEach((row) => {
      const title = row.children[1] as HTMLElement | undefined
      if (!title) return
      const category = row.querySelector('.cat')?.textContent || '',
        text = title.textContent || ''
      const href = category.includes('설비')
        ? `/pm-equipment?equipment=${encodeURIComponent(text.match(/[A-Z]-\d+/)?.[0] || '')}`
        : /고객|업무/.test(category)
          ? '/cs-inquiries'
          : '/fac-detail'
      const link = document.createElement('a')
      link.className = 'notification-title'
      link.href = href
      link.textContent = text
      title.replaceWith(link)
      ctx.on(link, 'click', (event: Event) => {
        event.preventDefault()
        row.classList.remove('unread')
        const count = popup.querySelectorAll('li.unread').length
        const badge = root.querySelector<HTMLElement>('#bell-count')
        if (badge) {
          badge.textContent = String(count)
          badge.hidden = count === 0
        }
        bellButton.setAttribute('aria-label', `알림 ${count}건 안 읽음`)
        close()
        ctx.route(href)
      })
    })
    const all = popup.querySelector<HTMLAnchorElement>('.pop-foot')
    if (all) {
      all.href = '/notifications'
      ctx.on(all, 'click', (e: Event) => {
        e.preventDefault()
        close()
        ctx.route('/notifications')
      })
    }
  }
  const stopIdentity = watch(
    () => store.account?.name,
    () => {
      root
        .querySelectorAll<HTMLElement>('.hdr .user')
        .forEach((el) => (el.textContent = `${store.account?.name || '관리자'}님`))
      root.querySelectorAll<HTMLElement>('.ro').forEach((el) => {
        if (el.textContent?.includes('(로그인 계정 자동 기록)'))
          el.textContent = `${store.account?.name || '관리자'} (로그인 계정 자동 기록)`
      })
    },
    { immediate: true },
  )
  ctx.on(root, 'page-dispose', stopIdentity)
  const menu = root.querySelector('.side nav')
  if (menu) {
    const link = document.createElement('a')
    link.href = '/jurisdiction-contacts'
    link.textContent = '\uad00\ud560 \ub2f4\ub2f9\uc790 \uc5f0\ub77d\ucc98'
    ctx.on(link, 'click', (e: Event) => {
      e.preventDefault()
      ctx.closeAll()
      ctx.route('/jurisdiction-contacts')
    })
    menu.append(link)
  }
  organizeSidebar(root)
  // Rendering is preserved from the source; these changes add shared application state and requested workflows.
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    if (a.getAttribute('href')?.startsWith('/bot-unanswered')) a.remove()
  })
  root.querySelectorAll('.sample').forEach((el) => el.remove())
  root
    .querySelectorAll<HTMLElement>('.hdr-l strong,.top .logo')
    .forEach((el) => (el.textContent = 'ROUTEL'))
  const theme = document.createElement('button')
  theme.type = 'button'
  theme.className = 'iconbtn theme-toggle'
  theme.innerHTML = uiIconSvg('theme')
  theme.setAttribute('aria-label', '라이트·다크 모드 전환')
  ctx.on(theme, 'click', () => store.themeToggle())
  root.querySelector('.hdr-r,.top .me,.top .in')?.append(theme)
  const bell = root.querySelector('#bell-btn')
  if (bell) {
    ctx.on(bell, 'dblclick', () => ctx.route('/notifications'))
    const link = root.querySelector<HTMLAnchorElement>('.pop-foot a')
    if (link) link.href = '/notifications'
  }
  ctx.openFaq = (question: string, answer: string) => {
    const dialog = document.createElement('dialog')
    dialog.className = 'added-dialog'
    const heading = document.createElement('h2')
    heading.textContent = 'FAQ 등록'
    const form = document.createElement('form')
    form.className = 'added-form'
    const q = document.createElement('input')
    q.value = question
    q.required = true
    q.setAttribute('aria-label', '질문')
    const a = document.createElement('textarea')
    a.value = answer
    a.required = true
    a.setAttribute('aria-label', '답변')
    const cat = document.createElement('select')
    cat.setAttribute('aria-label', '분류')
    ;['이용 방법', '알림·푸시', '차량·번호판', '계정', '기타'].forEach((t) => {
      const o = document.createElement('option')
      o.textContent = t
      cat.append(o)
    })
    const save = document.createElement('button')
    save.textContent = '등록'
    const close = document.createElement('button')
    close.textContent = '닫기'
    close.type = 'button'
    ctx.on(close, 'click', () => {
      dialog.close()
      dialog.remove()
    })
    ctx.on(form, 'submit', (e: Event) => {
      e.preventDefault()
      store.faqs.push({ question: q.value, answer: a.value, category: cat.value })
      store.record('FAQ', 'FAQ 등록')
      ctx.notify('현재 화면의 FAQ 목록에 등록했습니다. 서버 저장은 연결이 필요합니다.')
      dialog.close()
      dialog.remove()
    })
    form.append(cat, q, a, save, close)
    dialog.append(heading, form)
    root.append(dialog)
    dialog.showModal()
  }
  if (name === 'c-map') {
    const app = root.querySelector<HTMLElement>('.app')
    const panels = root.querySelectorAll<HTMLElement>('.app>aside,.app>.panel')
    const left = panels[0],
      detail = panels[1]
    if (app && left && detail) {
      app.classList.add('map-swap-layout')
      detail.classList.add('swapped-detail')
      detail.hidden = true
      app.insertBefore(detail, left)
      const back = document.createElement('button')
      back.type = 'button'
      back.className = 'btn back-to-list'
      back.textContent = '목록으로'
      detail.prepend(back)
      ctx.on(back, 'click', () => {
        detail.hidden = true
        left.hidden = false
      })
      ctx.on(root, 'click', (e: Event) => {
        if ((e.target as Element).closest('.it,.mk')) {
          left.hidden = true
          detail.hidden = false
        }
      })
    }
  }
  if (name === 'c-auth') {
    const boxes = Array.from(root.querySelectorAll<HTMLElement>('.g3>.box,.g3>.card,.g3>section'))
    const fallback = Array.from(root.querySelector('.g3')?.children || []) as HTMLElement[]
    const screens = boxes.length ? boxes : fallback
    screens.forEach((el, i) => {
      el.dataset.authScreen = String(i)
      el.hidden = i !== 0
    })
    ctx.on(root, 'click', (e: Event) => {
      const a = (e.target as Element).closest('a,button')
      if (!a) return
      const text = a.textContent?.trim()
      if (text === '회원가입') {
        e.preventDefault()
        screens.forEach((s, i) => (s.hidden = i !== 1))
      } else if (text === '비밀번호 찾기') {
        e.preventDefault()
        screens.forEach((s, i) => (s.hidden = i !== 2))
      } else if (text === '로그인' && !a.closest('[data-auth-screen="0"]')) {
        e.preventDefault()
        screens.forEach((s, i) => (s.hidden = i !== 0))
      }
    })
    const grid = root.querySelector('.g3')
    if (grid) grid.classList.add('auth-single')
    root.querySelectorAll<HTMLElement>('.i').forEach((el, i) => {
      const label =
        el.previousElementSibling?.textContent ||
        el.parentElement?.previousElementSibling?.textContent ||
        '입력'
      if (el.querySelector('input,select')) return
      const input = document.createElement('input')
      input.setAttribute('aria-label', label.trim() || `입력 ${i + 1}`)
      input.type = label.includes('비밀번호')
        ? 'password'
        : label.includes('이메일')
          ? 'email'
          : label.includes('생년월일')
            ? 'date'
            : 'text'
      input.autocomplete = input.type === 'password' ? 'new-password' : 'off'
      el.replaceChildren(input)
    })
  }
  if (name === 'c-app') {
    root.querySelectorAll<HTMLElement>('.hero .icon').forEach((el) => el.remove())
    root.querySelectorAll('p').forEach((el) => {
      if (/초안|확인 필요|한 줄로 압축/.test(el.textContent || '')) el.remove()
    })
    root.querySelectorAll<HTMLAnchorElement>('.stores a').forEach((a) => {
      a.textContent = '설치 안내'
      a.href = '/info/app-download'
    })
  }
  if (name === 'fac-list') {
    root.querySelectorAll<HTMLTableRowElement>('#tbl tbody tr').forEach((tr, i) => {
      const cell = tr.lastElementChild
      const b = document.createElement('button')
      b.className = 'btn sm control-action'
      b.textContent = tr.textContent?.includes('통제 중') ? '해제' : '통제'
      ctx.on(b, 'click', (e: Event) => {
        e.stopPropagation()
        ctx.askControl(i, b.textContent)
      })
      cell?.append(b)
    })
  }
  ctx.askControl = (i: number, action: string) => {
    const dialog = document.createElement('dialog')
    dialog.className = 'added-dialog'
    const form = document.createElement('form')
    form.className = 'added-form'
    const title = document.createElement('h2')
    title.textContent = action + ' 확인'
    const reason = document.createElement('textarea')
    reason.required = true
    reason.setAttribute('aria-label', '사유')
    const save = document.createElement('button')
    save.textContent = '확인'
    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = '취소'
    ctx.on(close, 'click', () => {
      dialog.close()
      dialog.remove()
    })
    ctx.on(form, 'submit', (e: Event) => {
      e.preventDefault()
      store.record('통제', `${action}: ${reason.value}`, String(i))
      const list = store.data[`${store.roleKey}:fac-list:F`] as any[] | undefined
      if (list?.[i]) list[i].ctl = action === '통제' ? 'BLOCKED' : 'OPEN'
      const row = root.querySelectorAll<HTMLTableRowElement>('#tbl tbody tr')[i]
      if (row?.children[2])
        row.children[2].textContent = action === '통제' ? '통제 중' : '정상 운영'
      const button = row?.querySelector<HTMLButtonElement>('.control-action')
      if (button) button.textContent = action === '통제' ? '해제' : '통제'
      ctx.notify('변경 내용을 저장했습니다.')
      dialog.close()
      dialog.remove()
    })
    form.append(title, reason, save, close)
    dialog.append(form)
    root.append(dialog)
    dialog.showModal()
  }
  if (name === 'pm-equipment') {
    const stopEquipment = watch(
      () => ctx.router.currentRoute.value.query.equipment,
      (id) => {
        if (id)
          ctx.setTimeout(() => {
            Array.from(root.querySelectorAll<HTMLButtonElement>('.row-open'))
              .find((button) => button.textContent?.trim() === id)
              ?.click()
          }, 0)
      },
    )
    ctx.on(root, 'page-dispose', stopEquipment)
    const toolbar = root.querySelector('.filters,.tools,.filter')
    const select = document.createElement('select')
    select.setAttribute('aria-label', '시설 선택')
    select.innerHTML =
      '<option value="">시설 전체</option>' +
      ['○○', '△△', '□□', '◇◇', '☆☆'].map((n) => `<option>${n}지하차도</option>`).join('')
    toolbar?.prepend(select)
    ctx.on(select, 'change', () => {
      root
        .querySelectorAll<HTMLTableRowElement>('#tbl tbody tr')
        .forEach((tr) => (tr.hidden = !!select.value && !tr.textContent?.includes(select.value)))
    })
    const b = document.createElement('button')
    b.className = 'btn'
    b.textContent = '설비 추가'
    root.querySelector('.page-head .row')?.append(b)
    ctx.on(b, 'click', () => {
      const dialog = document.createElement('dialog')
      dialog.className = 'added-dialog'
      const form = document.createElement('form')
      form.className = 'added-form'
      form.innerHTML =
        '<h2>설비 추가</h2><label>시설<select required><option>초량1지하차도</option><option>초량2지하차도</option></select></label><label>유형<select><option>배수펌프</option><option>전광판</option><option>CCTV</option><option>수위센서</option></select></label><label>설비 ID<input required></label><button>등록</button>'
      ctx.on(form, 'submit', (e: Event) => {
        e.preventDefault()
        ctx.notify('설비 등록 서비스 연결이 필요합니다. 입력 내용은 유지됩니다.')
      })
      dialog.append(form)
      root.append(dialog)
      dialog.showModal()
    })
  }
  if (name === 'fac-detail') {
    const heading = root.querySelector('.page-head h1')
    const reception = document.createElement('span')
    reception.className = 'reception-summary'
    reception.textContent = '데이터 수신 상태'
    heading?.append(reception)
  }
  if (name === 'fac-new') {
    const addr = root.querySelector<HTMLInputElement>('#a')
    const button = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('주소 검색'),
    )
    let located = ''
    ctx.on(addr!, 'input', () => (located = ''))
    if (button && addr)
      ctx.on(button, 'click', async () => {
        try {
          const requested = addr.value
          const p = await geocode(requested)
          if (addr.value !== requested) return
          const coords = root.querySelectorAll<HTMLInputElement>('input')
          const lat = root.querySelector<HTMLInputElement>('#la')
          const lng = root.querySelector<HTMLInputElement>('#lo')
          if (lat) lat.value = String(p.lat)
          if (lng) lng.value = String(p.lng)
          const host = root.querySelector<HTMLElement>('.mapsel')
          if (host) {
            host.replaceChildren()
            const k = await loadKakao()
            const map = new k.maps.Map(host, { center: new k.maps.LatLng(p.lat, p.lng), level: 3 })
            new k.maps.Marker({ map, position: map.getCenter(), draggable: true })
          }
          located = addr.value
        } catch {
          ctx.notify('주소를 조회하지 못했습니다. 다시 확인해 주세요.')
        }
      })
    const save = root.querySelector('#save')
    if (save)
      ctx.on(
        save,
        'click',
        (e: Event) => {
          if (located !== addr?.value) {
            e.stopImmediatePropagation()
            ctx.notify('주소를 검색하고 지도 위치를 확인해 주세요.')
          }
        },
        { capture: true },
      )
  }
  if (name === 'cs-notice-edit') {
    root
      .querySelectorAll<HTMLInputElement>('input[type="date"]')
      .forEach((el) => (el.type = 'datetime-local'))
    const save = root.querySelector('#save')
    if (save)
      ctx.on(
        save,
        'click',
        (e: Event) => {
          const values = Array.from(
            root.querySelectorAll<HTMLInputElement>(
              'input[type="datetime-local"],input[type="date"]',
            ),
          ).map((i) => i.value)
          if (values[0] && values[1] && new Date(values[1]) <= new Date(values[0])) {
            e.stopImmediatePropagation()
            ctx.notify('게시 종료는 게시 시작 이후로 설정해 주세요.')
            return
          }
          store.notices.push({
            id: crypto.randomUUID(),
            title: (root.querySelector('#t') as HTMLInputElement)?.value || '',
            body: (root.querySelector('#b') as HTMLInputElement)?.value || '',
            category: (root.querySelector('#cat') as HTMLSelectElement)?.value || '안내',
            start: values[0] || '',
            end: values[1] || '',
            pinned: false,
          })
        },
        { capture: true },
      )
  }
  if (name === 'notifications') {
    ctx.on(
      root,
      'click',
      (e: Event) => {
        const button = (e.target as Element).closest<HTMLButtonElement>('button.n')
        if (button && button.closest('li')?.getAttribute('data-cat') !== '시스템') {
          const href = button.dataset.href
          if (href) {
            e.stopImmediatePropagation()
            button.closest('li')?.classList.remove('unread')
            store.unread = Math.max(0, store.unread - 1)
            ctx.route(href)
          }
        }
      },
      { capture: true },
    )
    root.querySelectorAll<HTMLElement>('.noti,.nrow,.notification,.notif').forEach((el) => {
      ctx.on(el, 'click', () => {
        const link = el.querySelector<HTMLAnchorElement>('a')
        if (link) ctx.route(link.href)
      })
    })
    root.querySelectorAll('a,button').forEach((el) => {
      if (el.textContent?.trim() === '이동' && el.parentElement?.textContent?.includes('시스템'))
        el.remove()
    })
  }
  if (name === 'shift-login') {
    const dialog = root.querySelector<HTMLElement>('#sh')
    if (dialog) {
      const x = document.createElement('button')
      x.className = 'shift-close'
      x.setAttribute('aria-label', '닫기')
      x.textContent = '×'
      dialog.prepend(x)
      ctx.on(x, 'click', () => {
        ;(dialog as HTMLDialogElement).close()
      })
    }
  }
  if (name === 'fac-detail') {
    const receptionCard = Array.from(root.querySelectorAll<HTMLElement>('#s-overview .card')).find(
      (el) => el.querySelector('h2')?.textContent === '데이터 수신 상태',
    )
    const heading = root.querySelector('.page-head h1')
    if (receptionCard && heading) {
      const details = document.createElement('details')
      details.className = 'reception-detail'
      const summary = document.createElement('summary')
      summary.textContent = '수신 정상 3 · 지연 1'
      details.append(summary)
      const table = receptionCard.querySelector('table')
      if (table) details.append(table)
      heading.append(details)
      receptionCard.remove()
      heading.querySelector('.reception-summary')?.remove()
    }
    const section = root.querySelector<HTMLElement>('#s-cctv')
    if (section) {
      const video = section.querySelector<HTMLElement>('.viewer,.video,.cctv,.vid')
      if (video) {
        const layout = document.createElement('div')
        layout.className = 'cctv-log-layout'
        video.parentElement!.insertBefore(layout, video)
        layout.append(video)
        const panel = document.createElement('section')
        panel.className = 'cctv-log-panel'
        const title = document.createElement('h2')
        title.textContent = 'CCTV 기록'
        const filter = document.createElement('select')
        filter.setAttribute('aria-label', '차량 상태 필터')
        ;['전체', '잔류 중', '통과 완료'].forEach((t) => {
          const o = document.createElement('option')
          o.textContent = t
          filter.append(o)
        })
        const list = document.createElement('div')
        const data = [
          ['12가 3456', '잔류 중'],
          ['34나 7890', '통과 완료'],
          ['56다 1234', '통과 완료'],
        ]
        const render = () => {
          list.replaceChildren()
          data
            .filter((row) => filter.value === '전체' || row[1] === filter.value)
            .forEach((row) => {
              const p = document.createElement('p')
              p.textContent = row.join(' · ')
              list.append(p)
            })
        }
        ctx.on(filter, 'change', render)
        render()
        panel.append(title, filter, list)
        layout.append(panel)
        const play = document.createElement('button')
        play.className = 'btn'
        play.textContent = '재생'
        ctx.on(play, 'click', () => ctx.notify('영상을 불러오지 못했습니다. 연결을 확인해 주세요.'))
        video.append(play)
      }
    }
  }
  if (name === 'handover-pdf') {
    root.querySelectorAll<HTMLButtonElement>('.page-head button').forEach((b) => {
      b.textContent = b.textContent?.includes('경찰')
        ? '전달 문서 내보내기'
        : '내보내기 · PDF로 저장'
      ctx.on(b, 'click', () => window.print())
    })
  }
  if (name === 'shift-login') {
    root.querySelectorAll<HTMLAnchorElement>('#sh a').forEach((a) => {
      a.href = a.textContent?.includes('미처리') ? '/pm-queue' : '/shift-report'
    })
  }
  if (name === 'logs') {
    const b = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('엑셀 내보내기'),
    )
    if (b)
      ctx.on(b, 'click', () => {
        const rows = Array.from(root.querySelectorAll('#tbl tr')).map((tr) =>
          Array.from(tr.querySelectorAll('th,td'))
            .map((td) => `"${(td.textContent || '').replaceAll('"', '""')}"`)
            .join('\t'),
        )
        const blob = new Blob(['\ufeff' + rows.join('\n')], {
          type: 'text/tab-separated-values;charset=utf-8',
        })
        const a = document.createElement('a')
        a.download = 'ROUTEL_로그.tsv'
        const url = URL.createObjectURL(blob)
        a.href = url
        a.click()
        URL.revokeObjectURL(url)
      })
  }
  if (name === 'c-auth') {
    const screens = Array.from(root.querySelectorAll<HTMLElement>('.g3>section'))
    const selectScreen = (index: number) => screens.forEach((s, i) => (s.hidden = i !== index))
    root.querySelectorAll<HTMLElement>('.g3 .sub span').forEach((el) => {
      if (['회원가입', '비밀번호 찾기'].includes(el.textContent?.trim() || '')) {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'auth-text-button'
        b.textContent = el.textContent
        ctx.on(b, 'click', () => selectScreen(b.textContent === '회원가입' ? 1 : 2))
        el.replaceWith(b)
      }
    })
    screens.slice(1).forEach((screen) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'btn'
      b.textContent = '로그인으로'
      ctx.on(b, 'click', () => selectScreen(0))
      screen.append(b)
    })
    root.querySelectorAll<HTMLElement>('.f').forEach((field) => {
      const label = field.querySelector('label')?.textContent || ''
      const input = field.querySelector<HTMLInputElement>('input')
      if (input) {
        input.id = crypto.randomUUID()
        field.querySelector('label')?.setAttribute('for', input.id)
      }
      if (label.includes('통신사') && input) {
        const select = document.createElement('select')
        select.setAttribute('aria-label', '통신사')
        ;['선택', 'SKT', 'KT', 'LG U+', '알뜰폰'].forEach((t) => {
          const o = document.createElement('option')
          o.textContent = t
          select.append(o)
        })
        input.replaceWith(select)
      }
    })
    root.querySelectorAll<HTMLElement>('.p3').forEach((group) => {
      const inputs = Array.from(group.querySelectorAll<HTMLInputElement>('input'))
      inputs.forEach((input, i) => {
        input.type = 'tel'
        input.inputMode = 'numeric'
        input.maxLength = i === 0 ? 3 : 4
        input.setAttribute('aria-label', `휴대폰 번호 ${i + 1}번째 칸`)
        ctx.on(input, 'input', () => {
          input.value = input.value.replace(/\D/g, '')
          if (input.value.length === input.maxLength) inputs[i + 1]?.focus()
        })
        ctx.on(input, 'paste', (e: Event) => {
          const text = (e as ClipboardEvent).clipboardData?.getData('text').replace(/\D/g, '') || ''
          if (text.length >= 10) {
            e.preventDefault()
            inputs[0]!.value = text.slice(0, 3)
            inputs[1]!.value = text.slice(3, 7)
            inputs[2]!.value = text.slice(7, 11)
          }
        })
      })
    })
    root.querySelectorAll<HTMLElement>('.ck').forEach((el) => {
      const text = el.textContent?.replace('☑', '').trim()
      el.replaceChildren()
      const label = document.createElement('label')
      const box = document.createElement('input')
      box.type = 'checkbox'
      label.append(box, document.createTextNode(text || ''))
      el.append(label)
    })
    root.querySelectorAll<HTMLElement>('.seg2 span').forEach((el) => {
      el.tabIndex = 0
      el.setAttribute('role', 'button')
      ctx.on(el, 'click', () => {
        root.querySelectorAll('.seg2 span').forEach((s) => s.classList.toggle('on', s === el))
        if (el.textContent === '외국인' && !screens[1]?.querySelector('.country-code')) {
          const select = document.createElement('select')
          select.className = 'country-code'
          select.setAttribute('aria-label', '국가번호')
          ;['+82 대한민국', '+1 미국', '+81 일본', '+86 중국'].forEach((t) => {
            const o = document.createElement('option')
            o.textContent = t
            select.append(o)
          })
          screens[1]?.querySelector('.seg2')?.after(select)
        }
      })
    })
    const login = screens[0]?.querySelector<HTMLElement>('.btn')
    if (login)
      ctx.on(login, 'click', () => {
        const inputs = Array.from(screens[0]!.querySelectorAll<HTMLInputElement>('input'))
        if (inputs.some((i) => !i.value.trim())) {
          ctx.notify('아이디와 비밀번호를 입력해 주세요.')
          return
        }
        if (import.meta.env.VITE_DATA_MODE === 'server') {
          ctx.notify('로그인 요청을 처리하지 못했습니다. 다시 시도해 주세요.')
          return
        }
        store.account = { id: inputs[0]!.value, name: inputs[0]!.value, role: 'customer' }
        ctx.route('/my-home')
      })
    root.querySelectorAll<HTMLElement>('.btn').forEach((el) => {
      if (['인증번호 받기', '확인', '비밀번호 변경'].includes(el.textContent?.trim() || ''))
        ctx.on(el, 'click', () => ctx.notify('요청을 처리하지 못했습니다. 다시 시도해 주세요.'))
    })
  }
  if (name === 'c-notice') {
    const searchBox = Array.from(root.querySelectorAll<HTMLElement>('div')).find(
      (el) => el.textContent?.trim() === '제목·내용 검색' && el.children.length === 0,
    )
    const input = document.createElement('input')
    input.type = 'search'
    input.setAttribute('aria-label', '제목·내용 검색')
    input.placeholder = '제목·내용 검색'
    searchBox?.replaceWith(input)
    const filterRows = () =>
      root
        .querySelectorAll<HTMLTableRowElement>('table tbody tr')
        .forEach(
          (tr) =>
            (tr.hidden =
              !!input.value &&
              !`${tr.textContent || ''} ${tr.dataset.noticeBody || ''}`.includes(input.value)),
        )
    ctx.on(input, 'input', filterRows)
    root.querySelectorAll<HTMLElement>('.cc').forEach((group) =>
      group.querySelectorAll<HTMLElement>('span').forEach((c) => {
        c.tabIndex = 0
        c.setAttribute('role', 'button')
        ctx.on(c, 'click', () => {
          group.querySelectorAll('span').forEach((x) => x.classList.toggle('on', x === c))
          const panel = group.closest('section')
          if (panel?.querySelector('table'))
            panel
              .querySelectorAll<HTMLTableRowElement>('tr')
              .forEach(
                (tr) =>
                  (tr.hidden =
                    c.textContent !== '전체' && !tr.textContent?.includes(c.textContent || '')),
              )
        })
      }),
    )
    const faqPanel = Array.from(root.querySelectorAll('section')).find((s) =>
      s.querySelector('h2')?.textContent?.includes('FAQ'),
    )
    faqPanel?.querySelectorAll<HTMLElement>('div').forEach((el) => {
      const question = el.querySelector('b')
      if (question && el.querySelector('span.sub')) {
        el.tabIndex = 0
        el.setAttribute('role', 'button')
        ctx.on(el, 'click', () => {
          let a = el.querySelector('.faq-answer')
          if (a) {
            a.remove()
            return
          }
          a = document.createElement('p')
          a.className = 'faq-answer'
          a.textContent =
            store.faqs.find((f: any) => f.question === question.textContent)?.answer ||
            (
              {
                '번호판은 어떻게 등록하나요?': '내정보의 내 차량에서 등록할 수 있습니다.',
                '앱은 어디서 설치하나요?': '앱 소개의 설치 안내를 확인해 주세요.',
                '알림이 오지 않아요': '알림 수신 설정과 기기 알림 권한을 확인해 주세요.',
                '휴대폰 번호를 바꾸고 싶어요': '계정 설정에서 번호 변경 후 본인 인증을 진행하세요.',
              } as Record<string, string>
            )[question.textContent || ''] ||
            '문의하기에서 질문을 남겨 주세요.'
          el.append(a)
        })
      }
    })
    const table = root.querySelector('table tbody')
    store.notices
      .filter(
        (n: any) =>
          (!n.start || new Date(n.start) <= new Date()) && (!n.end || new Date(n.end) > new Date()),
      )
      .forEach((n: any) => {
        const tr = document.createElement('tr')
        ;[n.category, n.title, n.start || '', ''].forEach((t) => {
          const td = document.createElement('td')
          td.textContent = t
          tr.append(td)
        })
        table?.prepend(tr)
      })
  }

  if (name === 'fac-detail') {
    const sec = root.querySelector('#s-cctv')
    const split = sec?.querySelector('.split')
    const snapshots = split?.querySelector(':scope>.card')
    if (snapshots) {
      const details = document.createElement('details')
      details.className = 'snapshot-details'
      const summary = document.createElement('summary')
      summary.textContent = '최근 스냅샷'
      details.append(summary, snapshots)
      split?.after(details)
    }
  }
  if (name === 'cs-content') {
    const table = root.querySelector('#tbl-f tbody')
    store.faqs.forEach((faq: any, i: number) => {
      const tr = document.createElement('tr')
      ;[String(i + 1), '↑ ↓', faq.category, faq.question, '0', '공개'].forEach((value) => {
        const td = document.createElement('td')
        td.textContent = value
        tr.append(td)
      })
      const b = document.createElement('button')
      b.textContent = '상세'
      ctx.on(b, 'click', () => ctx.openFaq(faq.question, faq.answer))
      tr.lastElementChild?.append(b)
      table?.append(tr)
    })
  }
  if (name === 'c-notice') {
    const panel = Array.from(root.querySelectorAll('section')).find((s) =>
      s.querySelector('h2')?.textContent?.includes('FAQ'),
    )
    store.faqs.forEach((faq: any) => {
      const details = document.createElement('details')
      const summary = document.createElement('summary')
      summary.textContent = faq.question
      const p = document.createElement('p')
      p.textContent = faq.answer
      details.append(summary, p)
      panel?.append(details)
    })
  }
  if (name === 'c-notice') {
    const panels = root.querySelectorAll<HTMLElement>('.wrap section.panel')
    root.querySelectorAll<HTMLElement>('.ab a').forEach((a, index) => {
      a.tabIndex = 0
      a.setAttribute('role', 'button')
      ctx.on(a, 'click', () => {
        root.querySelectorAll('.ab a').forEach((x) => x.classList.toggle('on', x === a))
        panels.forEach((p, i) => (p.hidden = i !== index))
      })
    })
  }

  ctx.setTimeout(() => meeting(name, ctx), 0)
}
