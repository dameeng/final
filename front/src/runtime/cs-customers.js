import seeds from '../data/cs-customers.json'
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
  var C = store.pageData('cs-customers', 'C', seeds.C)
  var peek = $('peek')
  function openPeek(i) {
    ctx.closeAll('drawer')
    fill(i)
    ;[].forEach.call(document.querySelectorAll('#tbl tbody tr'), function (tr, k) {
      tr.classList.toggle('sel', k === i)
    })
    peek.hidden = false
    $('scrim').hidden = false
  }
  function closePeek() {
    peek.hidden = true
    ;[].forEach.call(document.querySelectorAll('#tbl tbody tr'), function (tr) {
      tr.classList.remove('sel')
    })
  }
  window.__closeOther = function (e) {
    if (e !== 'drawer') closePeek()
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.row-open')
    if (b) openPeek(+b.dataset.i)
  })
  $('peek-close').addEventListener('click', function () {
    ctx.closeAll()
  })

  function fill(i) {
    var c = C[i]
    $('p-name').textContent = c[0]
    $('p-mail').textContent = c[1]
    $('p-join').textContent = c[2]
    $('p-push').textContent = c[5]
    $('p-cars').innerHTML = c[6].length
      ? c[6]
          .map(function (x) {
            return '<li><strong>' + x[0] + '</strong><span class="sub">' + x[1] + '</span></li>'
          })
          .join('')
      : '<li><span class="sub">등록된 차량이 없어요</span></li>'
    $('p-inq').innerHTML = c[7].length
      ? c[7]
          .map(function (x) {
            return (
              '<li><span>' +
              x[0] +
              '</span><span class="stat ' +
              (x[1] === '미답변' ? 'new' : 'done') +
              '">' +
              x[1] +
              '</span></li>'
            )
          })
          .join('')
      : '<li><span class="sub">문의 내역이 없어요</span></li>'
  }
  $('q').addEventListener('input', function () {
    var q = this.value.trim(),
      n = 0
    ;[].forEach.call(document.querySelectorAll('#tbl tbody tr'), function (tr) {
      var ok = !q || tr.dataset.text.indexOf(q) > -1
      tr.hidden = !ok
      if (ok) n++
    })
    $('cnt').textContent = '총 ' + n + '명'
  })

  return {}
}
