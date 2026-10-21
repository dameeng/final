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
  $('ok').addEventListener('click', function () {
    if (!$('t').value.trim()) {
      $('t').focus()
      toast('제목을 입력해 주세요')
      return
    }
    if (!$('b').value.trim()) {
      $('b').focus()
      toast('내용을 입력해 주세요')
      return
    }
    toast('문의를 등록했어요')
    setTimeout(function () {
      location.href = 'my-inquiries.html'
    }, 900)
  })

  return {}
}
