import seeds from '../data/c-map.json'
export function initialize(ctx) {
  const {
    document,
    window,
    location,
    localStorage,
    sessionStorage,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    alert,
    confirm,
    store,
  } = ctx

  var F = store.pageData('c-map', 'F', seeds.F)
  var cur = 0,
    lv = '',
    q = ''
  var TR = store.pageData('c-map', 'TR', seeds.TR)
  F.splice(0, F.length, ...F.filter((f) => ['위험', '주의', '안전'].includes(f[1])))
  const list = document.getElementById('lst')
  list.replaceChildren()
  F.forEach((f, index) => {
    const item = document.createElement('li'),
      button = document.createElement('button'),
      badge = document.createElement('span'),
      body = document.createElement('span'),
      title = document.createElement('strong'),
      description = document.createElement('small')
    button.type = 'button'
    button.className = 'it'
    button.dataset.i = String(index)
    badge.className =
      'lvb ' + ({ '위험': 'danger', '주의': 'warn', '안전': 'safe' }[f[1]] || 'unknown')
    badge.textContent = f[1]
    title.textContent = f[0]
    description.textContent = f[2] + ' · ' + f[5]
    body.append(title, description)
    button.append(badge, body)
    item.append(button)
    list.append(item)
  })
  const count = document.querySelector('.ph h2 .sub')
  if (count) count.textContent = '부산 · ' + F.length + '곳'
  function $(i) {
    return document.getElementById(i)
  }
  function pick(i) {
    cur = i
    store.selectedFacility = i
    var f = F[i]
    $('n').textContent = f[0]
    $('a').textContent = f[5]
    var l = $('lv')
    l.textContent = f[1]
    l.className =
      'lvb ' +
      (f[1] === '위험' ? 'danger' : f[1] === '주의' ? 'warn' : f[1] === '안전' ? 'safe' : 'unknown')
    $('ct').textContent = f[2]
    $('ct2').textContent = f[2]
    $('sc').textContent = { '위험': '76.4점', '주의': '58.2점', '안전': '21.0점' }[f[1]] || '—'
    $('r').textContent = f[3]
    $('w').textContent = f[4]
    var rg = $('ring')
    rg.setAttribute('cx', f[6])
    rg.setAttribute('cy', f[7])
    ;[].forEach.call(document.querySelectorAll('.it'), function (b) {
      b.classList.toggle('on', +b.dataset.i === i)
    })
    $('tr').innerHTML = TR[f[1]] || '<p>관측 정보가 없습니다.</p>'
  }
  function flt() {
    ;[].forEach.call(document.querySelectorAll('.it'), function (b) {
      var f = F[+b.dataset.i]
      b.parentNode.hidden = !((!lv || f[1] === lv) && (!q || f[0].indexOf(q) > -1))
    })
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.it,.mk')
    if (b) pick(+b.dataset.i)
    var c = e.target.closest('#seg .chip')
    if (c) {
      lv = c.dataset.l
      ;[].forEach.call(document.querySelectorAll('#seg .chip'), function (x) {
        x.setAttribute('aria-pressed', String(x === c))
      })
      flt()
    }
  })
  document.addEventListener('keydown', function (e) {
    if (
      (e.key === 'Enter' || e.key === ' ') &&
      e.target.classList &&
      e.target.classList.contains('mk')
    ) {
      e.preventDefault()
      pick(+e.target.dataset.i)
    }
  })
  $('q').addEventListener('input', function () {
    q = this.value.trim()
    flt()
  })
  $('more').addEventListener('click', function () {
    var o = $('ext').style.display === 'none'
    $('ext').style.display = o ? 'flex' : 'none'
    this.setAttribute('aria-expanded', String(o))
    this.textContent = o ? '상세 접기 ▴' : '상세 펼치기 ▾'
  })
  const cctvDialog = $('pop')
  const viewport = ctx.root.ownerDocument.defaultView
  let popupScroll = { left: 0, top: 0 }
  $('cctvb').addEventListener('click', function () {
    $('pn').textContent = F[cur][0]
    ctx.onCctvOpen?.(F[cur][0])
    if (!cctvDialog.open) {
      popupScroll = { left: viewport.scrollX, top: viewport.scrollY }
      cctvDialog.showModal()
      viewport.scrollTo({ ...popupScroll, behavior: 'instant' })
    }
  })
  $('px').addEventListener('click', () => cctvDialog.close())
  ctx.on(cctvDialog, 'click', (event) => {
    if (event.target !== cctvDialog) return
    const rect = cctvDialog.getBoundingClientRect()
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      cctvDialog.close()
  })
  ctx.on(cctvDialog, 'close', () => {
    ctx.onCctvClose?.()
    ctx.setTimeout(() => {
      $('cctvb')?.focus({ preventScroll: true })
      viewport.scrollTo({ ...popupScroll, behavior: 'instant' })
    }, 0)
  })
  pick(Math.min(store.selectedFacility, F.length - 1))
  if (location.hash === '#popup') {
    $('cctvb').click()
  }

  return {}
}
