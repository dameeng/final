export function managerGuideSteps(facilityId='',equipmentId='') {
  const overview='/admin-app/screen-3',facilities='/admin-app/screen-4',equipment='/admin-app/screen-9',queue='/admin-app/screen-11',profile='/admin-app/screen-14'
  const detail=(tab='overview')=>facilityId?`/admin-app/screen-5?id=${encodeURIComponent(facilityId)}&tab=${tab}`:facilities
  const device=equipmentId?`/admin-app/screen-10?id=${encodeURIComponent(equipmentId)}`:equipment
  const s=(title:string,body:string,path:string,target:string,action?:'start'|'note'|'resolve')=>({title,body,path,target,action,hint:'',icon:'help'})
  return [
    s('관리자 업무를 루와 함께 살펴봐요','시설 상태를 확인하고, 통제 상황에 대응하고, 설비 점검을 기록하는 순서로 안내할게요. 실제 담당 시설의 조회 화면을 둘러봅니다. 안내가 통제·해제, 판별 확정, 점검 상태 변경이나 저장을 대신 실행하지는 않아요.','', ''),
    s('담당 범위부터 확인하세요','관리자 계정의 담당 지역에 따라 시설과 업무 대상이 달라져요. 마이페이지에서 담당 지역과 근무조를 확인하세요. 다른 구역의 시설이 보이지 않으면 검색 조건과 담당 권한을 함께 확인하세요.',profile,'.manager-mypage-profile||.manager-account-page'),
    s('종합 현황에서 상황을 먼저 파악해요','종합 현황 지도에서 시설 분포와 통제·위험 상태를 확인하세요. 한 시설만 보지 말고 주변 시설의 상태와 연결 도로 상황도 함께 살펴보세요.',overview,'.map-only-live .customer-map-canvas||.app-overview'),
    s('검색과 상태 필터로 시설을 찾으세요','지하차도명·주소를 검색하고 지역과 상태를 선택해 필요한 시설을 찾으세요. 검색 추천에서 시설명과 상태를 함께 확인하세요. 검색 결과가 없다면 선택한 지역과 필터를 확인하세요.',overview,'.admin-map-search||.map-only-live .map-overlay-toolbar||.app-overview'),
    s('마커를 누르면 시설 요약이 열려요','단일 마커는 해당 시설 요약을, 숫자로 묶인 마커는 시설 선택 목록을 보여 줘요. 시설을 선택한 뒤 위험 점수, 수위, 통제 상태와 관측 시각을 확인하세요.',overview,'.map-only-live .customer-map-canvas||.app-overview'),
    s('관측 시각과 수신 상태도 중요해요','점수와 수위가 낮아도 관측 시각이 오래됐거나 수신이 끊겼다면 현재 상태를 확신할 수 없어요. 갱신 지연·미수신 표시를 확인하고 필요하면 현장이나 담당자에게 확인하세요.',overview,'.app-overview'),
    s('주변 CCTV와 전광판을 확인해요','지도에서 CCTV·VMS 표시를 켜고 마커를 선택하면 주변 영상과 전광판 정보를 확인할 수 있어요. 지하차도 상태와 주변 교통 상황을 함께 판단할 때 활용하세요.',overview,'.traffic-layer-switches||.app-overview'),
    s('지하차도 목록에서 업무 대상을 고르세요','지하차도 목록에는 담당 시설의 상태와 차량 현황이 나와요. 시설 카드를 누르면 상세 정보를 볼 수 있어요. 목록은 5개씩 표시되므로 아래 페이지 번호로 다음 시설을 확인하세요.',facilities,'.app-facility-rows||.service-workspace'),
    s('지역·통제 상태·이름으로 좁혀 보세요','위험 단계 버튼, 담당 지역, 통제 상태와 이름 검색을 조합해 대상을 찾으세요. 조건을 바꾼 뒤 조회하고 결과 건수를 확인하세요. 목록이 적으면 이전 검색 조건이 남아 있는지도 확인하세요.',facilities,'.restored-facility-filters||.service-workspace'),
    s('시설 개요에서 위험과 통제를 구분해요','시설을 선택하면 위험 점수·단계, 수위와 통제 여부를 함께 확인할 수 있어요. 위험 단계와 실제 통제 여부는 서로 다른 정보예요. 시설명과 주소를 먼저 확인해 다른 시설을 조작하지 않도록 하세요.',detail(),'.restored-overview-grid||.app-facility-detail||.service-workspace'),
    s('통제·해제 전 대상과 사유를 확인하세요','통제나 해제는 실제 운영 상태에 영향을 주는 작업이에요. 시설과 현재 상태, 현장 상황을 확인한 뒤 해당 작업을 실행하세요. 해제는 수위뿐 아니라 현장 안전이 확보됐는지도 확인해야 해요. 이 안내에서는 버튼을 누르지 않아요.',detail(),'.restored-overview-grid||.app-facility-detail||.service-workspace'),
    s('차량 잔류와 이관 업무를 함께 확인해요','통제 상황에서는 입출구 기록과 잔류 차량을 함께 확인하세요. 경찰·소방 이관 문서가 생성된 경우 안전 대응 메뉴에서 대상과 내용을 검토하세요. 문서 생성과 실제 기관 전달 여부는 따로 확인해야 해요.',detail(),'.app-facility-records||.app-facility-rows'),
    s('OCR 기록에서 인식 근거를 확인해요','시설·카메라·차량 번호·인식 시각과 번호판 이미지를 함께 보세요. 검색 조건으로 담당 시설과 기간을 좁히고, 인식 상태와 판별 상태를 구분해 확인하세요.', '/admin-app/ocr','.service-filters||.service-workspace'),
    s('번호판 판별은 이미지와 비교해서 확정해요','아래 판별 대기 결과에서 차량과 원본 이미지를 확인하세요. 상세·처리를 열어 인식 번호를 비교하고, 맞으면 그대로 확정하거나 수정한 뒤 확정하세요. 확정은 실제 결과를 바꾸므로 대상 차량을 확인하세요. 대기가 없으면 비어 있는 결과가 표시돼요.', '/admin-app/reviews','.restored-review-grid .pcard||.service-table-wrap tbody tr||.restored-review-grid+.empty||.service-result-count'),
    s('입출구 로그로 차량 흐름을 확인해요','입구·출구 기록을 시설과 시간대로 조회하세요. 차량 번호만 보지 말고 카메라 위치와 인식 시각도 비교해야 해요. 누락이나 중복이 의심되면 CCTV와 OCR 기록을 함께 확인하세요.', '/admin-app/transits','.service-filters||.service-workspace'),
    s('예지보전은 장비 현황부터 확인해요','장비 현황의 위험·주의·안전·점검 대기 수를 확인하세요. 종류 필터로 수위계·배수펌프·CCTV·전광판 등 필요한 장비를 좁힐 수 있어요. 엔진 상태와 마지막 수신 시각도 함께 보세요.',equipment,'.pm-engine||.pm-equipment-live'),
    s('장비 카드는 점수와 시설을 함께 봐요','카드에서 장비명·설비 종류·지하차도·위험 점수를 확인하세요. 점수만 보고 판단하지 말고 해당 장비를 눌러 주요 원인과 최근 추이를 확인하세요. 데이터가 없으면 점수 대신 미수신 표시가 나올 수 있어요.',equipment,'.pm-equipment-cards||.pm-equipment-live'),
    s('상세 분석에서 판단 근거를 확인해요','판단 근거 영역까지 내려왔어요. 특징값의 정상 범위·평소 값·현재 값을 비교하세요. 같은 위험 점수라도 원인이 다를 수 있어요. 근거가 아직 없다면 분석 수신 여부를 먼저 확인하세요.',device,'.pm-evidence-card||.pm-facts-card||.pm-equipment-live'),
    s('센서 현재값과 분석값은 다를 수 있어요','현재값은 최근 수신 측정값이고, 최근 분석 센서 비교는 해당 분석 시점의 값과 평소 범위를 비교한 정보예요. 시각과 단위를 확인하세요. 미수신은 0이라는 뜻이 아니에요.',device,'.pm-current-sensors||.pm-sensor-table-card||.pm-evidence-card||.pm-equipment-live'),
    s('원인 센서 추이에서 변화를 살펴봐요','센서 항목을 바꾸면 해당 센서의 최근 추이와 평소 범위를 볼 수 있어요. 최근 구간의 변화, 범위를 벗어난 값과 관측 시각을 확인하세요. 장비 종류에 따라 센서 항목이 다르게 표시돼요.',device,'.pm-sensor-card||.pm-evidence-card||.pm-equipment-live'),
    s('점검 대기에서 처리할 건을 고르세요','처리 중 목록은 확인 필요와 점검 중인 건을 포함해요. 장비와 시설, 발생 사유, 발생 당시 점수와 현재 점수를 비교하세요. 이미 점수가 낮아졌더라도 필요한 점검·기록이 남아 있을 수 있어요.',queue,'.pm-equipment-cards||.pm-queue-live'),
    s('점검 시작으로 담당 작업을 남기세요','확인 필요 건의 점검 시작 입력 화면을 열었어요. 대상과 작업 내용을 확인한 뒤 저장하면 점검 중으로 바뀌어요. 단순 조회만으로 시작되지는 않으며, 안내에서는 저장하지 않아요. 처리할 건이 없으면 빈 목록을 보여 줘요.',queue,'.pm-action-field||.pm-equipment-cards||.pm-queue-live','start'),
    s('기록 추가로 진행 상황을 연결하세요','기록 추가 입력란에 확인한 현상·원인·현장 조치와 후속 확인 사항을 적으세요. 기록 추가는 점검 종료와 다른 작업이에요. 다른 관리자가 읽어도 무엇을 확인했는지 알 수 있게 작성하세요. 안내 중에는 입력·저장하지 않아요.',queue,'.pm-action-field||.pm-equipment-cards||.pm-queue-live','note'),
    s('점검 종료 시 조치 내용을 확인하세요','점검 종료 화면에서 조치 완료 또는 기타 종료를 선택하고 내용을 입력해요. 종료된 점검은 다시 열 수 없으므로 시설·장비·조치 내용을 검토한 뒤 저장하세요. 이 안내에서는 선택이나 저장을 실행하지 않아요.',queue,'.pm-action-field||.pm-equipment-cards||.pm-queue-live','resolve'),
    s('점검 이력에서 시작부터 종료까지 봐요','기간·종류·설비 조건으로 이력을 찾으세요. 이력 구분과 기록 시각, 조치 내용·등록자를 확인하고 점검 전후 점수를 비교하세요. 점검 뒤 새 점수가 아직 오지 않았다면 수신 대기일 수 있어요.', '/admin-app/history','.pm-filter-card||.pm-history-live'),
    s('설비 기준은 선택 대상을 먼저 확인해요','설비·기준 설정에서 지하차도와 종류로 대상을 좁히고 변경할 장비를 선택하세요. 주의·위험 시작 점수와 선택 개수를 확인한 뒤 저장하세요. 등록·삭제와 기준 저장은 실제 설정을 바꾸므로 신중히 실행하세요.', '/admin-app/pm-settings','.pm-settings-card||.pm-admin-tools'),
    s('데일리 리포트로 하루를 정리해요','종류별 그래프까지 내려왔어요. 각 막대의 길이는 장비 수, 색은 안전·주의·위험·미수신 상태를 뜻해요. 아래 점검 목록과 함께 비교하세요. 다른 날을 보려면 위 조회 날짜를 바꿔 조회하고, 필요한 경우 PDF로 내려받을 수 있어요.', '/admin-app/pm-daily','.daily-mobile-chart||.daily-section||.service-workspace'),
    s('알림은 상세와 연결된 업무까지 확인해요','종에서 최근 알림을 확인하거나 알림 목록에서 검색하세요. 알림을 누르면 상세 내용이 열리고 읽음 처리돼요. 관련 내용 확인을 누르면 연결된 시설·판별·점검 업무로 이동할 수 있어요.', '/admin-app/notifications','.manager-notification-filters||.service-workspace'),
    s('담당자 연락처로 현장 대응을 연결해요','목록 왼쪽에서 담당 기관과 역할을, 오른쪽에서 연락처를 확인하세요. ‘임시 번호’는 시연용 예시이므로 실제 연락에 사용하지 마세요. 정식 연락처가 등록되면 대응할 시설의 관할을 확인한 뒤 연락하세요. 이 안내에서는 전화를 걸지 않아요.', '/admin-app/contacts','.jurisdiction-phone-list||.contacts-page'),
    s('기기 알림과 내 정보를 관리하세요','마이페이지에서 내 정보 관리와 알림 기기 관리를 열어 연락처·이메일과 기기 상태를 확인하세요. 담당 지역·근무조는 지정된 권한으로 변경돼요. 비밀번호 변경과 회원탈퇴는 계정 관리에서 실행할 수 있어요.',profile,'.manager-account-page'),
    s('관리자 사용법은 언제든 다시 볼 수 있어요','마이페이지의 ‘루와 관리자 사용법 보기’에서 이 안내를 다시 열 수 있어요. 업무는 현황 확인 → 대상 선택 → 근거 확인 → 작업 실행 → 기록 확인 순서로 진행하세요. 완료하면 안내를 시작했던 화면으로 돌아갑니다.',profile,'.manager-guide-launch||.manager-account-page'),
  ]
}
