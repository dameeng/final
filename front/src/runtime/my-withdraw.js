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
  function chk() {
    $('go').disabled = !($('ag').checked && $('pw').value.length > 0)
  }
  $('ag').addEventListener('change', chk)
  $('pw').addEventListener('input', chk)
  $('go').addEventListener('click', function () {
    $('dg').showModal()
  })
  $('dg-ok').addEventListener('click', function () {
    $('dg').close()
    toast('탈퇴 처리됐어요')
  })

  return {}
}
