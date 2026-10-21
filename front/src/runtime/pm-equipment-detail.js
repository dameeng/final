import seeds from '../data/pm-equipment-detail.json'
import equipmentSeeds from '../data/pm-equipment.json'
import { watch } from 'vue'
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

  var D = store.pageData('pm-equipment-detail', 'D', seeds.D)
  var equipment = equipmentSeeds.EQ[0]
  function renderEquipment() {
    var id = ctx.router.currentRoute.value.query.equipment || 'P-01'
    equipment = equipmentSeeds.EQ.find((e) => e.id === id) || equipmentSeeds.EQ[0]
    var summary = document.querySelector('[aria-label="설비 요약"]'),
      heading = summary.querySelector('h2')
    heading.textContent = equipment.id + ' · ' + equipment.site
    heading.previousElementSibling.textContent = equipment.type
    var crumb = document.querySelector('.crumb strong')
    if (crumb) crumb.textContent = equipment.id
    var badge = summary.querySelector('.badge'),
      level = equipment.score >= 70 ? 'danger' : equipment.score >= 40 ? 'warn' : 'safe'
    badge.className = 'badge ' + level
    badge.textContent = equipment.score >= 70 ? '위험' : equipment.score >= 40 ? '주의' : '안전'
    var score = badge.nextElementSibling
    score.textContent = equipment.score
    score.nextElementSibling.nextElementSibling.textContent =
      '· 7일 전 ' + equipment.series[0] + ' → 현재 ' + equipment.score
    var metadata = summary.querySelectorAll('.kv2 strong')
    metadata[0].textContent = equipment.rx
    metadata[1].textContent = '미등록'
    metadata[2].textContent = '미제공'
    metadata[3].textContent = equipment.insp === '-' ? '해당 없음' : equipment.insp
    summary.querySelector('.row a').href =
      '/fac-detail?facility=' + encodeURIComponent(equipment.site)
    D.score = {
      u: '점',
      v: equipment.series,
      lines: [
        [70, '위험 기준'],
        [40, '주의 기준'],
      ],
    }
    document.querySelectorAll('#mtabs button').forEach((b) => {
      b.hidden = b.dataset.m !== 'score'
      b.setAttribute('aria-pressed', String(b.dataset.m === 'score'))
    })
    var reasons = document.querySelector('[aria-label="판단 근거"]')
    reasons.querySelector('thead tr').innerHTML = '<th>항목</th><th>기여 점수</th>'
    var body = reasons.querySelector('tbody')
    body.replaceChildren()
    equipment.reasons.forEach((reason) => {
      var row = document.createElement('tr'),
        label = document.createElement('td'),
        points = document.createElement('td')
      label.textContent = reason[0]
      points.textContent = '+' + reason[1]
      row.append(label, points)
      body.append(row)
    })
    if (!equipment.reasons.length) {
      var row = document.createElement('tr'),
        cell = document.createElement('td')
      cell.colSpan = 2
      cell.textContent = '특이 사유 없음'
      row.append(cell)
      body.append(row)
    }
    reasons.querySelector('.ro').textContent =
      '권장 조치 · ' + equipment.type + '의 표시된 이상 항목을 확인하고 점검해 주세요.'
    draw('score')
  }
  function draw(k) {
    var d = D[k],
      all = d.v.concat(
        d.lines.map(function (l) {
          return l[0]
        }),
      )
    var mn = Math.min.apply(null, all),
      mx = Math.max.apply(null, all)
    var pad = (mx - mn) * 0.1 || 1
    mn -= pad
    mx += pad
    function y(v) {
      return 200 - ((v - mn) / (mx - mn)) * 170
    }
    function x(i) {
      return 90 + i * (960 / 6)
    }
    var s = '<line x1="50" y1="210" x2="1070" y2="210" stroke="#8a93a0"/>'
    d.lines.forEach(function (l, i) {
      s +=
        '<line x1="50" y1="' +
        y(l[0]) +
        '" x2="1070" y2="' +
        y(l[0]) +
        '" stroke="' +
        (i ? '#8a93a0' : '#1f2630') +
        '" stroke-width="1.5" stroke-dasharray="6 5"/><text x="56" y="' +
        (y(l[0]) - 6) +
        '" font-size="13" fill="#5b6572">' +
        l[1] +
        ' ' +
        l[0] +
        d.u +
        '</text>'
    })
    s +=
      '<polyline fill="none" stroke="#2b5c8a" stroke-width="3" points="' +
      d.v
        .map(function (v, i) {
          return x(i) + ',' + y(v)
        })
        .join(' ') +
      '"/>'
    d.v.forEach(function (v, i) {
      s +=
        '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="' + (i === 6 ? 6 : 4) + '" fill="#2b5c8a"/>'
    })
    s +=
      '<text x="50" y="232" font-size="13" fill="#5b6572">7일 전</text><text x="1030" y="232" font-size="13" fill="#5b6572">오늘</text><text x="' +
      (x(6) - 20) +
      '" y="' +
      (y(d.v[6]) - 12) +
      '" font-size="14" font-weight="700">' +
      d.v[6] +
      d.u +
      '</text>'
    $('trend').innerHTML = s
  }
  renderEquipment()
  const stopEquipment = watch(() => ctx.router.currentRoute.value.query.equipment, renderEquipment)
  ctx.on(ctx.root, 'page-dispose', stopEquipment)
  document.querySelectorAll('.page-head button').forEach((button, index) => {
    button.addEventListener('click', () => {
      const at = equipmentSeeds.EQ.findIndex((e) => e.id === equipment.id),
        next = (at + (index === 0 ? -1 : 1) + equipmentSeeds.EQ.length) % equipmentSeeds.EQ.length
      ctx.route('/pm-equipment-detail?equipment=' + equipmentSeeds.EQ[next].id)
    })
  })
  document.querySelectorAll('#mtabs .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      document.querySelectorAll('#mtabs .chip').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === c))
      })
      draw(c.dataset.m)
    })
  })
  $('d-reg').addEventListener('click', function () {
    openReg(equipment.id + ' · ' + equipment.type + ' · ' + equipment.site)
  })

  return {}
}
