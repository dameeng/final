package com.mbc.puf.control.service;

import com.mbc.puf.common.enums.TransferAgency;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;
import com.mbc.puf.common.enums.UnderpassEventType;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.pdf.TransferPdfGenerator;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.common.security.ScopeResolver;
import com.mbc.puf.control.dto.BlockRequest;
import com.mbc.puf.control.dto.CtrlTransferItem;
import com.mbc.puf.control.dto.FireTransferRequest;
import com.mbc.puf.control.dto.ReasonPresetItem;
import com.mbc.puf.control.entity.CtrlTransfer;
import com.mbc.puf.control.entity.CtrlTransferCar;
import com.mbc.puf.control.entity.ReasonPreset;
import com.mbc.puf.control.repository.CtrlTransferCarRepository;
import com.mbc.puf.control.repository.CtrlTransferRepository;
import com.mbc.puf.control.repository.ReasonPresetRepository;
import com.mbc.puf.member.entity.Employee;
import com.mbc.puf.member.entity.Manager;
import com.mbc.puf.member.repository.EmployeeRepository;
import com.mbc.puf.member.repository.ManagerRegionRepository;
import com.mbc.puf.member.repository.ManagerRepository;
import com.mbc.puf.region.repository.RegionRepository;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.entity.Underpass;
import com.mbc.puf.underpass.entity.UnderpassEvent;
import com.mbc.puf.underpass.repository.UnderpassEventRepository;
import com.mbc.puf.underpass.repository.UnderpassRepository;
import com.mbc.puf.underpass.repository.TransitRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ControlServiceImpl implements ControlService {

    private static final DateTimeFormatter FILE_DT = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private final ReasonPresetRepository reasonPresetRepository;
    private final CtrlTransferRepository ctrlTransferRepository;
    private final CtrlTransferCarRepository ctrlTransferCarRepository;
    private final UnderpassRepository underpassRepository;
    private final UnderpassEventRepository eventRepository;
    private final TransitRepository transitRepository;
    private final ManagerRepository managerRepository;
    private final EmployeeRepository employeeRepository;
    private final ManagerRegionRepository managerRegionRepository;
    private final RegionRepository regionRepository;
    private final TransferPdfGenerator pdfGenerator;
    private final ScopeResolver scopeResolver;

    public ControlServiceImpl(
            ReasonPresetRepository reasonPresetRepository,
            CtrlTransferRepository ctrlTransferRepository,
            CtrlTransferCarRepository ctrlTransferCarRepository,
            UnderpassRepository underpassRepository,
            UnderpassEventRepository eventRepository,
            TransitRepository transitRepository,
            ManagerRepository managerRepository,
            EmployeeRepository employeeRepository,
            ManagerRegionRepository managerRegionRepository,
            RegionRepository regionRepository,
            TransferPdfGenerator pdfGenerator,
            ScopeResolver scopeResolver) {
        this.reasonPresetRepository = reasonPresetRepository;
        this.ctrlTransferRepository = ctrlTransferRepository;
        this.ctrlTransferCarRepository = ctrlTransferCarRepository;
        this.underpassRepository = underpassRepository;
        this.eventRepository = eventRepository;
        this.transitRepository = transitRepository;
        this.managerRepository = managerRepository;
        this.employeeRepository = employeeRepository;
        this.managerRegionRepository = managerRegionRepository;
        this.regionRepository = regionRepository;
        this.pdfGenerator = pdfGenerator;
        this.scopeResolver = scopeResolver;
    }

    // ─────────────────────────── 사유 프리셋 ───────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<ReasonPresetItem> getReasonPresets() {
        return reasonPresetRepository.findAll().stream()
                .map(p -> new ReasonPresetItem(p.getId(), p.getContent()))
                .collect(Collectors.toList());
    }

    // ─────────────────────────── 차단 ───────────────────────────

    @Override
    @Transactional
    public PdfResult blockUnderpass(LoginUser loginUser, Long underpassId, BlockRequest request) {
        Underpass underpass = requireUnderpass(underpassId);
        scopeResolver.requireOwnable(loginUser, underpass.getRegionId());

        if (underpass.getCurrentStatus() == UnderpassCurrentStatus.BLOCKED) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 차단된 지하차도입니다.");
        }

        String reason = resolveReason(request);

        // 1) 차단 이벤트 저장
        UnderpassEvent event = new UnderpassEvent();
        event.setUnderpassId(underpassId);
        event.setEventType(UnderpassEventType.BLOCK);
        event.setOperatorId(loginUser.id());
        event.setReason(reason);
        eventRepository.saveAndFlush(event);

        // 2) 지하차도 상태 갱신
        underpass.setCurrentStatus(UnderpassCurrentStatus.BLOCKED);
        underpass.setCurrentBlockEventId(event.getId());

        // 3) IN_TRANSIT → REMAINING 일괄 처리
        transitRepository.markRemaining(underpassId);

        // 4) 경찰 이관 기록 저장
        CtrlTransfer transfer = saveTransfer(event.getId(), TransferAgency.POLICE, null, loginUser.id());

        // 5) PDF 생성
        ManagerInfo mgr = managerInfo(loginUser.id());
        LocalDateTime now = transfer.getCreatedAt() != null ? transfer.getCreatedAt() : LocalDateTime.now();
        byte[] pdf = pdfGenerator.generatePolicePdf(
                underpass.getName(), "차단", reason,
                mgr.name(), mgr.regionName(),
                event.getCreatedAt() != null ? event.getCreatedAt() : now,
                now, null);

        // 6) 최신 상태 다시 조회해서 응답 구성
        UnderpassDetailResponse detail = toDetail(underpassRepository.findByIdAndDeletedFalse(underpassId).orElseThrow());
        String filename = String.format("경찰이관_차단_%s_%s.pdf", underpass.getName(), FILE_DT.format(now));
        return new PdfResult(filename, pdf, detail);
    }

    // ─────────────────────────── 해제 ───────────────────────────

    @Override
    @Transactional
    public PdfResult releaseUnderpass(LoginUser loginUser, Long underpassId, BlockRequest request) {
        Underpass underpass = requireUnderpass(underpassId);
        scopeResolver.requireOwnable(loginUser, underpass.getRegionId());

        if (underpass.getCurrentStatus() == UnderpassCurrentStatus.NORMAL) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 정상 상태인 지하차도입니다.");
        }

        // 차단 이벤트 조회 (PDF에 차단 시각 표시용)
        UnderpassEvent blockEvent = underpass.getCurrentBlockEventId() != null
                ? eventRepository.findById(underpass.getCurrentBlockEventId()).orElse(null)
                : null;

        String reason = resolveReason(request);

        // 1) 해제 이벤트 저장
        UnderpassEvent event = new UnderpassEvent();
        event.setUnderpassId(underpassId);
        event.setEventType(UnderpassEventType.RELEASE);
        event.setOperatorId(loginUser.id());
        event.setReason(reason);
        eventRepository.saveAndFlush(event);

        // 2) 지하차도 상태 갱신
        underpass.setCurrentStatus(UnderpassCurrentStatus.NORMAL);
        underpass.setCurrentBlockEventId(null);

        // 3) 경찰 이관 기록 저장
        CtrlTransfer transfer = saveTransfer(event.getId(), TransferAgency.POLICE, null, loginUser.id());

        // 4) PDF 생성
        ManagerInfo mgr = managerInfo(loginUser.id());
        LocalDateTime now = transfer.getCreatedAt() != null ? transfer.getCreatedAt() : LocalDateTime.now();
        LocalDateTime blockAt = blockEvent != null && blockEvent.getCreatedAt() != null
                ? blockEvent.getCreatedAt() : now;
        byte[] pdf = pdfGenerator.generatePolicePdf(
                underpass.getName(), "해제", reason,
                mgr.name(), mgr.regionName(),
                blockAt, now, null);

        UnderpassDetailResponse detail = toDetail(underpassRepository.findByIdAndDeletedFalse(underpassId).orElseThrow());
        String filename = String.format("경찰이관_해제_%s_%s.pdf", underpass.getName(), FILE_DT.format(now));
        return new PdfResult(filename, pdf, detail);
    }

    // ─────────────────────────── 소방 이관 ───────────────────────────

    @Override
    @Transactional
    public PdfResult fireTransfer(LoginUser loginUser, Long underpassId, FireTransferRequest request) {
        Underpass underpass = requireUnderpass(underpassId);
        scopeResolver.requireOwnable(loginUser, underpass.getRegionId());

        // 이관 기록 저장
        CtrlTransfer transfer = saveTransfer(request.getEventId(), TransferAgency.FIRE, request.getMemo(), loginUser.id());

        // 차량번호 저장
        for (String carNum : request.getCarNums()) {
            CtrlTransferCar car = new CtrlTransferCar();
            car.setCtrlTransferId(transfer.getId());
            car.setCarNum(carNum.trim());
            ctrlTransferCarRepository.save(car);
        }

        // PDF 생성
        ManagerInfo mgr = managerInfo(loginUser.id());
        LocalDateTime now = transfer.getCreatedAt() != null ? transfer.getCreatedAt() : LocalDateTime.now();
        byte[] pdf = pdfGenerator.generateFirePdf(
                underpass.getName(), request.getCarNums(),
                mgr.name(), mgr.regionName(),
                now, request.getMemo());

        UnderpassDetailResponse detail = toDetail(underpass);
        String filename = String.format("소방이관_%s_%s.pdf", underpass.getName(), FILE_DT.format(now));
        return new PdfResult(filename, pdf, detail);
    }

    // ─────────────────────────── 이관 기록 조회 ───────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<CtrlTransferItem> getTransferHistory(Long underpassId) {
        requireUnderpass(underpassId);

        // event → underpass_id 역추적이 필요하므로 native query로 event.underpass_id = underpassId 필터링
        List<CtrlTransfer> transfers = ctrlTransferRepository.findByUnderpassId(underpassId);
        return transfers.stream().map(this::toItem).collect(Collectors.toList());
    }

    // ─────────────────────────── PDF 재출력 ───────────────────────────

    @Override
    @Transactional(readOnly = true)
    public PdfResult redownloadPdf(Long transferId) {
        CtrlTransfer transfer = ctrlTransferRepository.findById(transferId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "이관 기록을 찾을 수 없습니다. id=" + transferId));

        UnderpassEvent event = eventRepository.findById(transfer.getEventId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "이벤트를 찾을 수 없습니다."));

        Underpass underpass = underpassRepository.findByIdAndDeletedFalse(event.getUnderpassId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "지하차도를 찾을 수 없습니다."));

        ManagerInfo mgr = managerInfo(transfer.getManagerId());
        LocalDateTime transferAt = transfer.getCreatedAt() != null ? transfer.getCreatedAt() : LocalDateTime.now();

        byte[] pdf;
        String filename;

        if (transfer.getAgency() == TransferAgency.POLICE) {
            String eventTypeLabel = event.getEventType() == UnderpassEventType.BLOCK ? "차단" : "해제";

            // 해제 이벤트라면 해당 차단 이벤트의 시각도 참조
            LocalDateTime blockAt = transferAt;
            if (event.getEventType() == UnderpassEventType.RELEASE && underpass.getCurrentBlockEventId() != null) {
                blockAt = eventRepository.findById(underpass.getCurrentBlockEventId())
                        .map(UnderpassEvent::getCreatedAt).orElse(transferAt);
            }

            pdf = pdfGenerator.generatePolicePdf(
                    underpass.getName(), eventTypeLabel, event.getReason(),
                    mgr.name(), mgr.regionName(),
                    event.getCreatedAt() != null ? event.getCreatedAt() : blockAt,
                    transferAt, transfer.getMemo());
            filename = String.format("경찰이관_%s_%s_%s.pdf", eventTypeLabel, underpass.getName(), FILE_DT.format(transferAt));
        } else {
            List<String> carNums = ctrlTransferCarRepository.findByCtrlTransferId(transferId)
                    .stream().map(CtrlTransferCar::getCarNum).collect(Collectors.toList());
            pdf = pdfGenerator.generateFirePdf(
                    underpass.getName(), carNums,
                    mgr.name(), mgr.regionName(),
                    transferAt, transfer.getMemo());
            filename = String.format("소방이관_%s_%s.pdf", underpass.getName(), FILE_DT.format(transferAt));
        }

        UnderpassDetailResponse detail = toDetail(underpass);
        return new PdfResult(filename, pdf, detail);
    }

    // ─────────────────────────── 내부 헬퍼 ───────────────────────────

    private Underpass requireUnderpass(Long id) {
        return underpassRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 지하차도입니다. id=" + id));
    }

    /** 프리셋 또는 직접 입력 사유 결정 */
    private String resolveReason(BlockRequest request) {
        if (request == null) return null;
        if (request.getPresetId() != null) {
            ReasonPreset preset = reasonPresetRepository.findById(request.getPresetId())
                    .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "사유 프리셋을 찾을 수 없습니다."));
            return preset.getContent();
        }
        return request.getReason();
    }

    private CtrlTransfer saveTransfer(Long eventId, TransferAgency agency, String memo, Long managerId) {
        CtrlTransfer transfer = new CtrlTransfer();
        transfer.setEventId(eventId);
        transfer.setAgency(agency);
        transfer.setMemo(memo);
        transfer.setManagerId(managerId);
        return ctrlTransferRepository.saveAndFlush(transfer);
    }

    /** 관리자 이름 + 첫 번째 담당 지역명 */
    private ManagerInfo managerInfo(Long managerId) {
        Manager manager = managerRepository.findById(managerId).orElse(null);
        String name = "알 수 없음";
        if (manager != null && manager.getEmployeeId() != null) {
            Employee emp = employeeRepository.findById(manager.getEmployeeId()).orElse(null);
            if (emp != null) name = emp.getName();
        }

        String regionName = managerRegionRepository.findRegionIds(managerId).stream()
                .findFirst()
                .flatMap(regionRepository::findById)
                .map(r -> r.getName())
                .orElse("-");

        return new ManagerInfo(name, regionName);
    }

    private CtrlTransferItem toItem(CtrlTransfer t) {
        CtrlTransferItem item = new CtrlTransferItem();
        item.setId(t.getId());
        item.setEventId(t.getEventId());
        item.setAgency(t.getAgency());
        item.setMemo(t.getMemo());
        item.setManagerId(t.getManagerId());
        item.setCreatedAt(t.getCreatedAt());

        // 관리자 이름
        ManagerInfo mgr = managerInfo(t.getManagerId());
        item.setManagerName(mgr.name());

        // 소방 이관이면 차량번호 목록 포함
        if (t.getAgency() == TransferAgency.FIRE) {
            List<String> cars = ctrlTransferCarRepository.findByCtrlTransferId(t.getId())
                    .stream().map(CtrlTransferCar::getCarNum).collect(Collectors.toList());
            item.setCarNums(cars);
        }
        return item;
    }

    private UnderpassDetailResponse toDetail(Underpass u) {
        // UnderpassDetailResponse 생성자 / 팩토리 메서드가 없으므로 setter 방식 사용
        // (UnderpassServiceImpl 의 toDetail 이 private 이라 여기서는 간략하게 채운다)
        UnderpassDetailResponse r = new UnderpassDetailResponse();
        r.setId(u.getId());
        r.setName(u.getName());
        r.setRegionId(u.getRegionId());
        r.setRoadAddress(u.getRoadAddress());
        r.setCurrentStatus(u.getCurrentStatus());
        r.setCurrentRiskLevel(u.getCurrentRiskLevel());
        r.setCurrentRiskScore(u.getCurrentRiskScore());
        return r;
    }

    private record ManagerInfo(String name, String regionName) {}
}
