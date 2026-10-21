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
  $('bot-fab').addEventListener('click', function () {
    var h = $('bot').hidden
    $('bot').hidden = !h
    this.setAttribute('aria-expanded', String(h))
  })
  $('bot-x').addEventListener('click', function () {
    $('bot').hidden = true
  })
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-close]')
    if (c) $(c.dataset.close).close()
  })

  var cc = ''
  ;[].forEach.call(document.querySelectorAll('.chip'), function (b) {
    b.addEventListener('click', function () {
      cc = b.dataset.c
      ;[].forEach.call(document.querySelectorAll('.chip'), function (x) {
        x.setAttribute('aria-pressed', String(x === b))
      })
      ;[].forEach.call(document.querySelectorAll('#al .item'), function (i) {
        i.hidden = cc && i.dataset.c !== cc
      })
    })
  })
  function cnt() {
    var n = document.querySelectorAll('#al .unread').length
    ;[].forEach.call(document.querySelectorAll('.bell b,.side .n'), function (b) {
      if (b.closest('.bell') || b.closest('a[href="my-alerts.html"]')) {
        b.textContent = n
        b.hidden = !n
      }
    })
  }
  document.addEventListener('click', function (e) {
    var i = e.target.closest('#al .item.unread')
    if (i) {
      i.classList.remove('unread')
      cnt()
    }
  })
  $('ra').addEventListener('click', function () {
    ;[].forEach.call(document.querySelectorAll('#al .unread'), function (i) {
      i.classList.remove('unread')
    })
    cnt()
  })
  $('m').addEventListener('change', function () {
    toast(this.checked ? '푸시 알림을 켰어요' : '푸시 알림을 껐어요')
  })

  return {}
}
