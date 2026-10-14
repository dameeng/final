package com.mbc.puf.internal.service;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.mbc.puf.alert.service.AlertService;
import com.mbc.puf.car.dao.CarDao;
import com.mbc.puf.car.dto.Car;
import com.mbc.puf.common.enums.CameraRole;
import com.mbc.puf.common.enums.RecognitionStatus;
import com.mbc.puf.common.enums.ReviewStatus;
import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.TransitStatus;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;
import com.mbc.puf.common.enums.UnderpassEventType;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.internal.dao.PlateLogDao;
import com.mbc.puf.internal.dao.RiskScoreDao;
import com.mbc.puf.internal.dto.PlateLog;
import com.mbc.puf.internal.dto.PlateLogCreateRequest;
import com.mbc.puf.internal.dto.PlateLogResponse;
import com.mbc.puf.internal.dto.RiskScore;
import com.mbc.puf.internal.dto.RiskScoreCreateRequest;
import com.mbc.puf.internal.dto.RiskScoreResponse;
import com.mbc.puf.threshold.dao.ThresholdDao;
import com.mbc.puf.threshold.dto.Threshold;
import com.mbc.puf.underpass.dao.CameraDao;
import com.mbc.puf.underpass.dao.UnderpassDao;
import com.mbc.puf.underpass.dao.UnderpassEventDao;
import com.mbc.puf.underpass.dao.UnderpassTransitDao;
import com.mbc.puf.underpass.dto.Camera;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.dto.UnderpassEvent;
import com.mbc.puf.underpass.dto.UnderpassTransit;

@Service
public class InternalIngestServiceImpl implements InternalIngestService {

	private static final Logger log = LoggerFactory.getLogger(InternalIngestServiceImpl.class);

	// confidence가 이 값 미만이면(매칭은 됐어도) LOW_CONFIDENCE로 본다. 정식 기준이 정해지면 조정
	private static final BigDecimal LOW_CONFIDENCE_THRESHOLD = new BigDecimal("0.600");

	// 출구 보조 매칭(숫자만 같은 번호)을 허용할 입구 인식 후 시간(초). 같은 숫자의 다른 차와 잘못 짝짓지 않게 짧게 둔다
	private static final long SIMILAR_MATCH_WINDOW_SEC = 60;

	// detected_num은 DB에서 NOT NULL이라, OCR이 아예 못 읽은 경우(null) 저장용으로 대신 넣는 값
	private static final String FAILED_PLACEHOLDER = "FAILED";

	// 캡처 이미지를 저장할 하위 폴더명 (file.upload-dir 아래)
	private static final String IMAGE_SUBDIR = "plate-logs";

	private final RiskScoreDao riskScoreDao;
	private final PlateLogDao plateLogDao;
	private final UnderpassDao underpassDao;
	private final UnderpassEventDao underpassEventDao;
	private final UnderpassTransitDao underpassTransitDao;
	private final ThresholdDao thresholdDao;
	private final CameraDao cameraDao;
	private final CarDao carDao;
	private final AlertService alertService;

	// 첨부파일 저장 위치. application.properties의 file.upload-dir (board 도메인 첨부와 같은 설정을 공유)
	@Value("${file.upload-dir}")
	private String uploadDir;

	public InternalIngestServiceImpl(RiskScoreDao riskScoreDao, PlateLogDao plateLogDao, UnderpassDao underpassDao,
			UnderpassEventDao underpassEventDao, UnderpassTransitDao underpassTransitDao, ThresholdDao thresholdDao,
			CameraDao cameraDao, CarDao carDao, AlertService alertService) {
		this.riskScoreDao = riskScoreDao;
		this.plateLogDao = plateLogDao;
		this.underpassDao = underpassDao;
		this.underpassEventDao = underpassEventDao;
		this.underpassTransitDao = underpassTransitDao;
		this.thresholdDao = thresholdDao;
		this.cameraDao = cameraDao;
		this.carDao = carDao;
		this.alertService = alertService;
	}

	@Override
	@Transactional
	public RiskScoreResponse receiveRiskScore(RiskScoreCreateRequest request) {
		if (underpassDao.selectUnderpassById(request.getUnderpassId()) == null) {
			throw new BusinessException(HttpStatus.BAD_REQUEST,
					"존재하지 않는 지하차도입니다. underpassId=" + request.getUnderpassId());
		}

		RiskScore riskScore = new RiskScore();
		riskScore.setUnderpassId(request.getUnderpassId());
		riskScore.setRiskScore(request.getRiskScore());
		riskScore.setRainfallMm(request.getRainfallMm());
		riskScore.setRainfall1hMm(request.getRainfall1hMm());
		riskScore.setRainfall3hMm(request.getRainfall3hMm());
		riskScore.setRainfall6hMm(request.getRainfall6hMm());
		riskScore.setRainfall12hMm(request.getRainfall12hMm());
		riskScore.setRainfall24hMm(request.getRainfall24hMm());
		riskScore.setPredictedAt(request.getPredictedAt());

		riskScoreDao.insertRiskScore(riskScore); // 생성된 id가 riskScore.id 에 채워진다

		updateRiskLevel(request.getUnderpassId(), request.getRiskScore());

		return new RiskScoreResponse(riskScore.getId(), riskScore.getUnderpassId(), riskScore.getRiskScore(),
				riskScore.getPredictedAt());
	}

	@Override
	@Transactional
	public PlateLogResponse receivePlateLog(PlateLogCreateRequest request, MultipartFile image) {
		Camera camera = cameraDao.selectCameraById(request.getCameraId());
		if (camera == null) {
			throw new BusinessException(HttpStatus.BAD_REQUEST, "존재하지 않는 카메라입니다. cameraId=" + request.getCameraId());
		}

		Long carId = null;
		if (request.getDetectedNum() != null) {
			Car matched = carDao.selectCarByCarNum(request.getDetectedNum());
			carId = (matched != null) ? matched.getId() : null;
		}

		RecognitionStatus recognitionStatus = determineRecognitionStatus(request.getDetectedNum(),
				request.getConfidence(), carId);

		// detected_num은 NOT NULL이라, OCR이 못 읽었으면(null) FAILED_PLACEHOLDER로 대신 저장한다.
		// recognitionStatus 판정과 차량 매칭은 원래 값(null 여부)을 기준으로 이미 끝낸 뒤라 영향 없다
		String storedDetectedNum = (request.getDetectedNum() != null) ? request.getDetectedNum() : FAILED_PLACEHOLDER;

		PlateLog plateLog = new PlateLog();
		plateLog.setCameraId(request.getCameraId());
		plateLog.setDetectedNum(storedDetectedNum);
		plateLog.setConfidence(request.getConfidence());
		plateLog.setImagePath(saveImage(image));
		plateLog.setRecognitionStatus(recognitionStatus);
		plateLog.setCarId(carId);
		plateLog.setDetectedAt(request.getDetectedAt());

		// 신뢰도가 기준 미만이면 판별대기로 건다. 등록 차량 매칭 여부(LOW_CONFIDENCE/UNMATCHED)와는 무관하고,
		// 신뢰도가 충분한 UNMATCHED나 OCR 실패(FAIL)는 걸지 않는다. recognition_status 값 자체는 그대로 둔다
		if (isLowConfidence(request.getDetectedNum(), request.getConfidence())) {
			plateLog.setReviewStatus(ReviewStatus.PENDING);
			plateLog.setReviewDeadline(request.getDetectedAt().plusMinutes(1)); // 만료되면 스케줄러가 AUTO_PROCESSED로 바꿈
		} else {
			plateLog.setReviewStatus(ReviewStatus.NONE);
			plateLog.setReviewDeadline(null);
		}

		plateLogDao.insertPlateLog(plateLog); // 생성된 id가 plateLog.id 에 채워진다

		UnderpassDetailResponse underpass = underpassDao.selectUnderpassById(camera.getUnderpassId());
		if (underpass != null) {
			// 입출구 매칭: 이 카메라가 소속 지하차도의 entry_camera_id/exit_camera_id로 지정돼 있을 때만 처리
			// (아직 지정 안 된 지하차도라면 조용히 건너뛴다 — 이건 "실제 게이트가 어디냐"의 문제라 camera_role과는 무관)
			processTransit(underpass, camera, plateLog, storedDetectedNum);

			boolean matched = carId != null && (recognitionStatus == RecognitionStatus.SUCCESS
					|| recognitionStatus == RecognitionStatus.LOW_CONFIDENCE);

			// PREDICTIVE 알림: APPROACH_LPR(원거리 접근로) 카메라가 매칭했는데, 그 지하차도 위험도가
			// 지금 WARNING/DANGER면 "아직 시간 있을 때" 경고로 발송
			if (matched && camera.getCameraRole() == CameraRole.APPROACH_LPR
					&& (underpass.getCurrentRiskLevel() == RiskLevel.WARNING
							|| underpass.getCurrentRiskLevel() == RiskLevel.DANGER)) {
				// 알림 로그에 남길 계기 이벤트: "지금 이 단계로 올라간" 가장 최근 RISK_LEVEL_UP 행
				// (currentRiskLevel 자체는 컬럼에서 바로 읽고, 이 조회는 event_id 확보용으로만 쓴다)
				UnderpassEvent latestRiskUpEvent = underpassEventDao.selectLatestRiskLevelUpEvent(underpass.getId());
				if (latestRiskUpEvent != null) {
					alertService.sendPredictiveAlert(latestRiskUpEvent.getId(), carId, storedDetectedNum);
				}
			}

			// ROI_FINAL 알림: ROI_LPR(입구 바로 앞, 마지막으로 돌아갈 수 있는 지점) 카메라가 매칭했는데
			// 그 지하차도가 지금 BLOCKED면, 진입 직전 최후 확인으로 그 차주에게 발송
			if (matched && camera.getCameraRole() == CameraRole.ROI_LPR
					&& underpass.getCurrentStatus() == UnderpassCurrentStatus.BLOCKED
					&& underpass.getCurrentBlockEventId() != null) {
				alertService.sendRoiFinalAlert(underpass.getCurrentBlockEventId(), carId, storedDetectedNum);
			}
		}

		return new PlateLogResponse(plateLog.getId(), plateLog.getCameraId(), plateLog.getRecognitionStatus(),
				plateLog.getCarId(), plateLog.getReviewStatus(), plateLog.getImagePath(), plateLog.getDetectedAt());
	}

	// ---- 내부 메서드 ----

	// FastAPI가 감지 순간 이미지를 같이 보냈으면 uploads/plate-logs/{yyyyMMdd}/{uuid}.{ext}로 저장하고
	// DB/응답에는 upload-dir 기준 상대경로만 남긴다. image가 없거나(null/empty) 저장이 실패하면 null을 반환한다
	// — 이미지 저장 실패가 번호판 인식 자체를 막을 이유는 아니므로, 로그만 남기고 나머지 처리는 계속 진행한다
	private String saveImage(MultipartFile image) {
		if (image == null || image.isEmpty()) {
			return null;
		}
		try {
			String today = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE); // yyyyMMdd
			Path dir = Paths.get(uploadDir, IMAGE_SUBDIR, today);
			Files.createDirectories(dir);

			String original = image.getOriginalFilename();
			String ext = "";
			if (original != null && original.contains(".")) {
				ext = original.substring(original.lastIndexOf('.'));
			}
			String filename = UUID.randomUUID() + ext;

			Path target = dir.resolve(filename);
			image.transferTo(target);

			return IMAGE_SUBDIR + "/" + today + "/" + filename;
		} catch (IOException e) {
			log.warn("번호판 캡처 이미지 저장 실패 (인식 결과 저장은 계속 진행): {}", e.getMessage());
			return null;
		}
	}

	// risk_score를 threshold와 대조해서 단계를 매기고, 지금 저장된 단계(underpass.current_risk_level)와
	// 달라졌을 때만 상태를 갱신 + 이벤트를 남긴다. 오르면 RISK_LEVEL_UP, 내리면 RISK_LEVEL_DOWN으로
	// 기록해서 추이를 전부 추적할 수 있게 한다. 같으면 아무 것도 하지 않는다(이벤트 남발 방지).
	// 알림은 여기서 안 보내고, APPROACH_LPR 카메라가 이 단계를 감지했을 때(receivePlateLog) 보낸다
	// — "이미 들어간 차"가 아니라 "접근 중인 차"에게 경고하는 게 맞아서
	private void updateRiskLevel(Long underpassId, BigDecimal riskScore) {
		List<Threshold> thresholds = thresholdDao.selectThresholdsByUnderpassId(underpassId);
		RiskLevel newLevel = determineRiskLevel(thresholds, riskScore);
		RiskLevel currentLevel = underpassDao.selectCurrentRiskLevel(underpassId);

		if (newLevel == currentLevel) {
			return; // 변화 없으면 상태 갱신도, 이벤트 기록도 하지 않는다
		}

		underpassDao.updateCurrentRiskLevel(underpassId, newLevel);

		UnderpassEvent event = new UnderpassEvent();
		event.setUnderpassId(underpassId);
		event.setEventType(newLevel.ordinal() > currentLevel.ordinal() ? UnderpassEventType.RISK_LEVEL_UP
				: UnderpassEventType.RISK_LEVEL_DOWN);
		event.setRiskLevel(newLevel);
		event.setRiskScoreAtEvent(riskScore);
		underpassEventDao.insertUnderpassEvent(event); // 생성된 id가 event.id 에 채워진다
	}

	// thresholds는 risk_score_min 오름차순(SAFE→WARNING→DANGER)이므로, riskScore 이상인 것 중 가장
	// 마지막(=가장 높은) 단계를 쓴다
	private RiskLevel determineRiskLevel(List<Threshold> thresholds, BigDecimal riskScore) {
		RiskLevel level = RiskLevel.SAFE;
		for (Threshold threshold : thresholds) {
			if (riskScore.compareTo(threshold.getRiskScoreMin()) >= 0) {
				level = threshold.getLevel();
			}
		}
		return level;
	}

	private void processTransit(UnderpassDetailResponse underpass, Camera camera, PlateLog plateLog,
			String storedDetectedNum) {
		if (camera.getId().equals(underpass.getEntryCameraId())) {
			if (FAILED_PLACEHOLDER.equals(storedDetectedNum)) {
				// 입구에서 번호판을 아예 못 읽었으면(OCR 완전 실패) 어느 차인지 식별할 방법이 없다.
				// 여기서 그대로 IN_TRANSIT 기록을 만들면 car_num="FAILED"인 유령 통과기록이 쌓이고,
				// 출구에서도 같은 이유로 절대 매칭·종료되지 않아 차단 시 REMAINING(잔류차량) 목록에
				// 실체 없는 항목으로 계속 남는다. plate_log 자체는 그대로 저장되니 인식 실패 이력은
				// 남되, 통과 추적 대상에서는 제외한다.
				return;
			}
			UnderpassTransit transit = new UnderpassTransit();
			transit.setUnderpassId(underpass.getId());
			transit.setCarNum(storedDetectedNum);
			transit.setEntryPlateLogId(plateLog.getId());
			transit.setStatus(TransitStatus.IN_TRANSIT);
			transit.setEntryAt(plateLog.getDetectedAt());
			underpassTransitDao.insertTransit(transit);
			return;
		}

		if (camera.getId().equals(underpass.getExitCameraId())) {
			if (FAILED_PLACEHOLDER.equals(storedDetectedNum)) {
				return; // 출구에서 번호판을 못 읽었으면 어느 통과 기록인지 특정할 수 없어 매칭을 시도하지 않는다
			}
			UnderpassTransit active = underpassTransitDao.selectActiveTransitByCarNum(underpass.getId(),
					storedDetectedNum);
			if (active == null) {
				// 같은 번호가 없으면: 최근 SIMILAR_MATCH_WINDOW_SEC 안에 들어온 차 중 숫자가 모두 같은 것과 매칭한다.
				// OCR이 입구/출구 중 한쪽에서 가운데 한글만 다르게 읽는 경우(더↔저, 무↔부 등)를 보정하기 위함
				active = underpassTransitDao.selectSimilarActiveTransit(underpass.getId(), storedDetectedNum,
						storedDetectedNum.replaceAll("[^0-9]", ""),
						plateLog.getDetectedAt().minusSeconds(SIMILAR_MATCH_WINDOW_SEC), plateLog.getDetectedAt());
			}
			if (active != null) {
				underpassTransitDao.updateTransitExit(active.getId(), plateLog.getId(), plateLog.getDetectedAt());
			}
		}
	}

	// OCR이 번호를 읽었고(detectedNum != null) 신뢰도가 기준 미만이면 true. 차량 매칭 여부는 보지 않는다
	private boolean isLowConfidence(String detectedNum, BigDecimal confidence) {
		return detectedNum != null && confidence != null && confidence.compareTo(LOW_CONFIDENCE_THRESHOLD) < 0;
	}

	private RecognitionStatus determineRecognitionStatus(String detectedNum, BigDecimal confidence, Long carId) {
		if (detectedNum == null) {
			return RecognitionStatus.FAIL; // OCR이 아예 못 읽음
		}
		if (carId == null) {
			return RecognitionStatus.UNMATCHED; // 읽긴 했는데 등록 차량과 매칭 안 됨
		}
		if (confidence != null && confidence.compareTo(LOW_CONFIDENCE_THRESHOLD) < 0) {
			return RecognitionStatus.LOW_CONFIDENCE; // 매칭은 됐지만 신뢰도가 낮음
		}
		return RecognitionStatus.SUCCESS;
	}
}