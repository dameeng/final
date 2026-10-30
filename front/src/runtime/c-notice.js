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
  const examples = {
    '우장춘지하차도 호우 통제 안내':
      '호우로 인한 침수 위험이 있을 때는 지하차도 진입을 피하고 현장 통제 안내에 따라 우회해 주세요.\n\n통제 여부와 해제 상태는 지하차도 현황 지도에서 확인할 수 있습니다. 현장의 차단 시설과 안내 표지, 담당자의 지시를 우선 확인해 주세요.',
    '시스템 정기 점검 안내 (10/15 02:00~04:00)':
      '서비스 안정화를 위한 정기 점검 안내 예시입니다.\n\n점검 시간: 10월 15일 02:00~04:00\n점검 항목: 지도 조회, 알림 발송 및 회원 서비스 연결 상태 확인\n\n점검 중에는 일부 기능 이용이 제한될 수 있습니다. 실제 점검 일정은 운영 공지를 확인해 주세요.',
    '앱 v1.1 업데이트 · 길 안내 추가':
      '업데이트 안내 예시입니다.\n\n지하차도 위치를 확인하고 길 안내로 연결할 수 있는 기능을 안내합니다. 지도에서 시설을 선택한 뒤 시설 주소와 상태를 확인해 주세요.\n\n실제 배포 버전과 제공 기능은 앱 설치 화면의 안내를 확인해 주세요.',
    '위험 단계 기준 안내 (안전·주의·위험)':
      '지하차도 현황은 안전·주의·위험 단계와 통제 상태로 표시됩니다.\n\n안전: 현재 표시된 위험 점수가 안전 구간에 해당합니다.\n주의: 수위·강수량 등의 변화를 주의해서 확인해야 합니다.\n위험: 침수 위험에 유의하고 우회 및 현장 안내를 확인해 주세요.\n통제: 도로 진입이 제한된 상태입니다.\n\n통제 상태는 위험 단계와 별도로 확인해야 하며, 정보가 지연될 수 있으므로 현장 안내를 우선해 주세요.',
    '휴대폰 번호 인증 방식으로 바뀌어요':
      '휴대폰 번호 인증 방식 안내 예시입니다.\n\n회원가입 또는 비밀번호 재설정 화면에서 본인 명의의 휴대폰 번호로 인증을 진행합니다. 입력한 번호로 받은 인증번호를 입력하고 확인해 주세요.\n\n인증 문자를 받지 못한 경우 번호와 문자 수신 설정을 확인해 주세요. 해결되지 않으면 문의하기를 이용해 주세요.',
  }
  const dialog = document.createElement('dialog')
  dialog.className = 'notice-detail-dialog'
  dialog.setAttribute('aria-labelledby', 'notice-detail-title')
  const header = document.createElement('header'),
    title = document.createElement('h2'),
    close = document.createElement('button'),
    meta = document.createElement('p'),
    body = document.createElement('div')
  title.id = 'notice-detail-title'
  close.type = 'button'
  close.textContent = '닫기'
  meta.className = 'notice-detail-meta'
  body.className = 'notice-detail-body'
  header.append(title, close)
  dialog.append(header, meta, body)
  ctx.root.append(dialog)
  ctx.on(close, 'click', () => dialog.close())
  ctx.on(dialog, 'click', (event) => {
    if (event.target !== dialog) return
    const rect = dialog.getBoundingClientRect()
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close()
  })
  ctx.on(ctx.root, 'page-dispose', () => dialog.close())
  document.querySelectorAll('table tbody tr').forEach((row) => {
    const cell = row.children[1]
    if (!cell) return
    const label = cell.textContent.trim(),
      saved = store.notices.find((n) => n.title === label),
      content = saved?.body || examples[label] || '등록된 본문이 없습니다.'
    row.dataset.noticeBody = content
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'notice-title-button'
    button.textContent = label
    cell.replaceChildren(button)
    ctx.on(button, 'click', () => {
      title.textContent = label
      meta.textContent = [
        row.children[0]?.textContent?.trim(),
        row.children[2]?.textContent?.trim(),
        saved ? '' : '구성 예시',
      ]
        .filter(Boolean)
        .join(' · ')
      body.textContent = content
      dialog.showModal()
    })
  })

  return {}
}
