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

  $('add').addEventListener('click', function () {
    $('dc-t').textContent = '차량 등록'
    $('dc-p').value = ''
    $('dc').showModal()
  })
  document.addEventListener('click', function (e) {
    var a = e.target.closest('.ed'),
      d = e.target.closest('.del')
    if (a) {
      $('dc-t').textContent = '차량 수정'
      $('dc-p').value = a.dataset.p
      $('dc').showModal()
    }
    if (d) {
      $('dd-m').textContent = d.dataset.p + ' 차량을 삭제할까요?'
      $('dd').showModal()
    }
  })
  $('dc-ok').addEventListener('click', function () {
    if (!$('dc-p').value.trim()) {
      $('dc-p').focus()
      return
    }
    $('dc').close()
    toast('저장했어요')
  })
  $('dd-ok').addEventListener('click', function () {
    $('dd').close()
    toast('삭제했어요')
  })

  return {}
}
