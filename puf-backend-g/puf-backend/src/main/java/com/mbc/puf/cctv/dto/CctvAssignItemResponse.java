package com.mbc.puf.cctv.dto;

/**
 * 카메라 영상 주소 일괄 채우기에서 카메라 1대의 결과.
 * source: OCR(OCR 서버 영상 → /api/cctv/{id}/stream) / BUSAN(가까운 부산시 CCTV 의 HLS) / NONE(반경 안에 CCTV 없음, after 는 null)
 */
public record CctvAssignItemResponse(Long cameraId, Long underpassId, String underpassName, String role,
                                     String before, String after, String source, String cctvName, Double distance) {
}
