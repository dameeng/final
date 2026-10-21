import seeds from '../data/cs-content.json'
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

  ;(function () {
    var side = document.getElementById('side'),
      scrim = document.getElementById('scrim'),
      mb = document.getElementById('menu-btn'),
      mc = document.getElementById('menu-close')
    var bb = document.getElementById('bell-btn'),
      bp = document.getElementById('bell-pop')
    function closeAll(except) {
      if (except !== 'side') {
        side.classList.remove('open')
        mb.setAttribute('aria-expanded', 'false')
      }
      if (except !== 'bell') {
        bp.hidden = true
        bb.setAttribute('aria-expanded', 'false')
      }
      if (window.__closeOther) window.__closeOther(except)
      scrim.hidden = except !== 'side' && except !== 'drawer'
    }
    window.closeAll = closeAll
    mb.addEventListener('click', function () {
      ctx.closeAll('side')
      side.classList.add('open')
      mb.setAttribute('aria-expanded', 'true')
      scrim.hidden = false
      mc.focus()
    })
    mc.addEventListener('click', function () {
      ctx.closeAll()
      mb.focus()
    })
    scrim.addEventListener('click', function () {
      ctx.closeAll()
    })
    bb.addEventListener('click', function () {
      var o = bp.hidden
      ctx.closeAll(o ? 'bell' : undefined)
      if (o) {
        bp.hidden = false
        bb.setAttribute('aria-expanded', 'true')
      }
    })
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        ctx.closeAll()
      }
    })
    var all = document.getElementById('read-all')
    if (all) {
      all.addEventListener('click', function () {
        document.querySelectorAll('.pop-list li.unread').forEach(function (li) {
          li.classList.remove('unread')
        })
        document.getElementById('bell-count').hidden = true
      })
    }
  })()

  function $(id) {
    return document.getElementById(id)
  }
  function toast(t) {
    var el = $('toast')
    el.textContent = t
    el.hidden = false
    setTimeout(function () {
      el.hidden = true
    }, 2200)
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-close]')
    if (c) {
      $(c.dataset.close).close()
    }
  })
  var N = store.pageData('cs-content', 'N', seeds.N),
    F = store.pageData('cs-content', 'F', seeds.F),
    mode = 'n'
  var peek = $('peek')
  function show(k, i) {
    ctx.closeAll('drawer')
    var r, t
    if (k === 'n') {
      r = N[i]
      $('p-meta').textContent = r[6] + ' · 조회 ' + r[5]
      $('p-title').textContent = r[2]
      $('p-cat').textContent = r[0]
      $('p-st').textContent = r[7]
      $('p-st').className =
        'stat ' + (r[7] === '게시 중' ? 'new' : r[7] === '예약' ? 'work' : 'done')
      $('p-body').textContent = NB[i] + '\n\n게시 기간: ' + r[3] + ' · 앱푸시: ' + r[4]
      $('p-edit').dataset.k = 'n'
    } else {
      r = F[i]
      $('p-meta').textContent = '순서 ' + r[0] + ' · 조회 ' + r[3]
      $('p-title').textContent = r[2]
      $('p-cat').textContent = r[1]
      $('p-st').textContent = r[4]
      $('p-st').className = 'stat ' + (r[4] === '공개' ? 'new' : 'done')
      $('p-body').textContent = r[5]
      $('p-edit').dataset.k = 'f'
      $('p-edit').dataset.i = i
    }
    var rows = document.querySelectorAll(k === 'n' ? '#tbl-n tbody tr' : '#tbl-f tbody tr')
    ;[].forEach.call(document.querySelectorAll('tbody tr'), function (tr) {
      tr.classList.remove('sel')
    })
    rows[i].classList.add('sel')
    peek.hidden = false
    $('scrim').hidden = false
  }
  var NB = store.pageData('cs-content', 'NB', seeds.NB)
  function closePeek() {
    peek.hidden = true
    ;[].forEach.call(document.querySelectorAll('tbody tr'), function (tr) {
      tr.classList.remove('sel')
    })
  }
  window.__closeOther = function (e) {
    if (e !== 'drawer') closePeek()
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.row-open')
    if (b) show(b.dataset.k, +b.dataset.i)
  })
  $('peek-close').addEventListener('click', function () {
    ctx.closeAll()
  })
  $('p-edit').addEventListener('click', function () {
    if (this.dataset.k === 'n') {
      location.href = 'cs-notice-edit.html'
    } else {
      ctx.closeAll()
      var f = F[+this.dataset.i]
      $('fq-t').textContent = 'FAQ 수정'
      $('fq-c').value = f[1]
      $('fq-q').value = f[2]
      $('fq-a').value = f[5]
      $('fq').showModal()
    }
  })
  function sw(m) {
    mode = m
    $('sg-n').setAttribute('aria-pressed', String(m === 'n'))
    $('sg-f').setAttribute('aria-pressed', String(m === 'f'))
    $('pn').hidden = m !== 'n'
    $('pf').hidden = m !== 'f'
    $('cat-n').hidden = m !== 'n'
    $('cat-f').hidden = m !== 'f'
    $('add-n').hidden = m !== 'n'
    $('add-f').hidden = m !== 'f'
    ctx.closeAll()
  }
  $('sg-n').addEventListener('click', function () {
    sw('n')
  })
  $('sg-f').addEventListener('click', function () {
    sw('f')
  })
  $('add-f').addEventListener('click', function () {
    $('fq-t').textContent = 'FAQ 등록'
    $('fq-q').value = ''
    $('fq-a').value = ''
    $('fq').showModal()
  })
  $('fq-ok').addEventListener('click', function () {
    $('fq').close()
    toast('FAQ를 저장했어요')
  })
  function flt() {
    var q = $('q').value.trim()
    ;[
      ['#tbl-n', 'cat-n'],
      ['#tbl-f', 'cat-f'],
    ].forEach(function (p) {
      var c = $(p[1]).value
      ;[].forEach.call(document.querySelectorAll(p[0] + ' tbody tr'), function (tr) {
        tr.hidden = !((!c || tr.dataset.cat === c) && (!q || tr.dataset.text.indexOf(q) > -1))
      })
    })
  }
  $('q').addEventListener('input', flt)
  $('cat-n').addEventListener('change', flt)
  $('cat-f').addEventListener('change', flt)

  return {}
}
