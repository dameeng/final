import seeds from '../data/pm-history.json'
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
  function openReg(label) {
    ctx.closeAll()
    $('reg-eq').textContent = label
    $('reg').showModal()
  }
  if ($('reg-ok'))
    $('reg-ok').addEventListener('click', function () {
      $('reg').close()
      toast('점검 내용을 등록했어요 (등록자: ○○○)')
      window.__afterReg && window.__afterReg()
    })

  $('h-reg').addEventListener('click', function () {
    openReg('설비를 선택하세요')
  })
  var H = store.pageData('pm-history', 'H', seeds.H)
  var peek = $('peek')
  function openPeek(i) {
    var h = H[i]
    ctx.closeAll('drawer')
    $('p-when').textContent = h[0]
    $('p-title').textContent = h[1] + ' · ' + h[3]
    $('p-act').textContent = h[4]
    $('p-res').textContent = h[7]
    $('p-memo').textContent = h[5]
    $('p-b').textContent = h[8] + '점'
    $('p-a').textContent = h[9] + '점'
    $('p-who').textContent = h[6]
    $('p-kind').textContent = h[2]
    ;[].forEach.call(document.querySelectorAll('#htbl tbody tr'), function (tr, k) {
      tr.classList.toggle('sel', k === i)
    })
    peek.hidden = false
    $('scrim').hidden = false
  }
  function closePeek() {
    peek.hidden = true
    ;[].forEach.call(document.querySelectorAll('#htbl tbody tr'), function (tr) {
      tr.classList.remove('sel')
    })
  }
  window.__closeOther = function (except) {
    if (except !== 'drawer') closePeek()
  }
  document.querySelectorAll('.row-open').forEach(function (b) {
    b.addEventListener('click', function () {
      openPeek(+b.dataset.i)
    })
  })
  $('peek-close').addEventListener('click', function () {
    ctx.closeAll()
  })
  var tf = '',
    q = ''
  function apply() {
    ;[].forEach.call(document.querySelectorAll('#htbl tbody tr'), function (tr) {
      tr.hidden = !((!tf || tr.dataset.type === tf) && (!q || tr.dataset.text.indexOf(q) > -1))
    })
  }
  $('h-type').addEventListener('change', function () {
    tf = this.value
    apply()
  })
  $('h-q').addEventListener('input', function () {
    q = this.value.trim()
    apply()
  })

  return {}
}
