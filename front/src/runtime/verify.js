import seeds from '../data/verify.json'
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

  var grid = $('grid')
  var LIMIT = 60
  var n = 4
  var PL = store.pageData('verify', 'PL', seeds.PL),
    SI = store.pageData('verify', 'SI', seeds.SI)
  function cards() {
    return [].slice.call(grid.querySelectorAll('.pcard'))
  }
  function upd() {
    var k = cards().length
    $('cnt').textContent = k
    $('empty').hidden = k > 0
    var b = document.querySelector('.side nav a:nth-child(4) .count')
    if (b) {
      b.textContent = k
      b.hidden = !k
    }
  }
  function hist(c, res, cls, final, who) {
    $('htbl').tBodies[0].insertAdjacentHTML(
      'afterbegin',
      '<tr><td>10:50</td><td>' +
        c.dataset.site +
        '</td><td>' +
        c.dataset.orig +
        '</td><td>' +
        (final || '-') +
        '</td><td><span class="stat ' +
        cls +
        '">' +
        res +
        '</span></td><td>' +
        (who || '○○○') +
        '</td></tr>',
    )
  }
  function done(c, res, cls, final, who) {
    hist(c, res, cls, final, who)
    c.remove()
    upd()
  }
  function paint(c) {
    var s = +c.dataset.sec
    c.querySelector('.bar b').style.width = (s / LIMIT) * 100 + '%'
    c.querySelector('.tl-txt').textContent = '남은 시간 0:' + (s < 10 ? '0' : '') + s
    c.classList.toggle('urgent', s <= 10)
  }
  cards().forEach(paint)
  setInterval(function () {
    cards().forEach(function (c) {
      var s = +c.dataset.sec - 1
      c.dataset.sec = s
      if (s <= 0) {
        done(c, '시간 초과 · 자동 넘김', '', '', '시스템')
        toast('시간 초과로 1건이 자동으로 넘어갔어요')
      } else paint(c)
    })
  }, 1000)
  grid.addEventListener('input', function (e) {
    if (!e.target.classList.contains('plate')) return
    var c = e.target.closest('.pcard')
    var ch = e.target.value.trim() !== c.dataset.orig
    e.target.classList.toggle('edited', ch)
    c.querySelector('.b-ok').disabled = ch
    c.querySelector('.b-fix').disabled = !ch
  })
  grid.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList.contains('plate')) {
      var c = e.target.closest('.pcard')
      ;(c.querySelector('.b-ok').disabled
        ? c.querySelector('.b-fix')
        : c.querySelector('.b-ok')
      ).click()
    }
  })
  grid.addEventListener('click', function (e) {
    var c = e.target.closest('.pcard')
    if (!c) return
    if (e.target.classList.contains('b-ok')) done(c, '맞음', 'done', c.dataset.orig)
    else if (e.target.classList.contains('b-fix'))
      done(c, '수정', 'work', c.querySelector('.plate').value.trim())
    else if (e.target.classList.contains('b-no')) done(c, '판별 불가', 'ack', '')
  })
  $('f-site').addEventListener('change', function () {
    var v = this.value
    cards().forEach(function (c) {
      c.hidden = v && c.dataset.site !== v
    })
  })
  $('sim').addEventListener('click', function () {
    var i = n++ % 4
    var h =
      '<article class="pcard" data-sec="60" data-site="' +
      SI[i] +
      '" data-orig="' +
      PL[i] +
      '"><div class="pmeta"><strong>' +
      SI[i] +
      '</strong></div><div class="pimg">번호판 이미지 (잘라서 전송)</div><div class="timer" role="timer"><div class="bar"><b></b></div><span class="tl-txt"></span></div><input class="plate" value="' +
      PL[i] +
      '" aria-label="인식된 번호판 (수정 가능)"><div class="pbtns"><button type="button" class="btn sm b-ok">맞음</button><button type="button" class="btn sm primary b-fix" disabled>수정 후 확정</button><button type="button" class="btn sm b-no">판별 불가</button></div></article>'
    grid.insertAdjacentHTML('beforeend', h)
    paint(grid.lastElementChild)
    upd()
  })
  function tab(k) {
    ;['q', 'h', 'm'].forEach(function (x) {
      $('tab-' + x).setAttribute('aria-selected', String(x === k))
      $('sec-' + x).hidden = x !== k
    })
  }
  $('tab-q').addEventListener('click', function () {
    tab('q')
  })
  $('tab-h').addEventListener('click', function () {
    tab('h')
  })
  $('tab-m').addEventListener('click', function () {
    tab('m')
  })
  if (location.hash === '#m') tab('m')
  upd()

  return {}
}
