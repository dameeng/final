import seeds from '../data/bot-logs.json'
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
  var L = store.pageData('bot-logs', 'L', seeds.L)
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
    var l = L[i]
    $('p-t').textContent = l[0]
    $('p-c').textContent = l[1]
    $('p-chat').innerHTML = l[4]
      .map(function (m) {
        var me = m[0] === '고객'
        return (
          '<div class="' +
          (me ? 'me' : '') +
          '"><div class="who">' +
          m[0] +
          '</div><div class="bubble ' +
          (me ? '' : 'bot') +
          '">' +
          m[1] +
          '</div></div>'
        )
      })
      .join('')
    $('p-act').replaceChildren()
    var faqButton = document.createElement('button')
    faqButton.className = 'btn primary'
    faqButton.textContent = 'FAQ로 등록'
    faqButton.addEventListener('click', function () {
      ctx.openFaq(
        l[2],
        l[4]
          .filter(function (m) {
            return m[0] === '챗봇'
          })
          .map(function (m) {
            return m[1]
          })
          .join('\n'),
      )
    })
    $('p-act').appendChild(faqButton)
    var manage = document.createElement('a')
    manage.className = 'btn'
    manage.href = '/cs-content'
    manage.textContent = 'FAQ 관리'
    $('p-act').appendChild(manage)
  }
  var st = ''
  function flt() {
    var q = $('q').value.trim()
    ;[].forEach.call(document.querySelectorAll('#tbl tbody tr'), function (tr) {
      tr.hidden = !((!st || tr.dataset.r === st) && (!q || tr.dataset.text.indexOf(q) > -1))
    })
  }
  $('q').addEventListener('input', flt)
  ;[].forEach.call(document.querySelectorAll('.chip'), function (c) {
    c.addEventListener('click', function () {
      st = c.dataset.r
      ;[].forEach.call(document.querySelectorAll('.chip'), function (x) {
        x.setAttribute('aria-pressed', String(x === c))
      })
      flt()
    })
  })

  return {}
}
