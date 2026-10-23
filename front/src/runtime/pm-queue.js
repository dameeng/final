import seeds from '../data/pm-queue.json'
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

  var Q = store.pageData('pm-queue', 'Q', seeds.Q)
  var NEXT = store.pageData('pm-queue', 'NEXT', seeds.NEXT)
  var pending = null
  function setRow(i, st, label, btn) {
    var tr = document.querySelector('#qtbl tr[data-i="' + i + '"]')
    tr.dataset.st = st
    var s = $('st-' + i)
    s.className = 'stat ' + st
    s.textContent = label
    $('act-' + i).innerHTML = btn
      ? '<button type="button" class="btn sm q-act" data-i="' + i + '">' + btn + '</button>'
      : '<span class="sub">-</span>'
  }
  $('qtbl').addEventListener('click', function (e) {
    var b = e.target.closest('.q-act')
    if (!b) return
    var i = +b.dataset.i
    var tr = b.closest('tr')
    var st = tr.dataset.st
    if (st === 'work') {
      pending = i
      openReg(Q[i])
      return
    }
    var n = NEXT[st]
    setRow(i, n[0], n[1], n[2])
  })
  window.__afterReg = function () {
    if (pending !== null) {
      setRow(pending, 'done', '조치 완료', '')
      pending = null
    }
  }
  document.querySelectorAll('#qchips .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      document.querySelectorAll('#qchips .chip').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === c))
      })
    })
  })

  return {}
}
