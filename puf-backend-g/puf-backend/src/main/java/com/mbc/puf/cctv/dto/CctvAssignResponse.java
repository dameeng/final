package com.mbc.puf.cctv.dto;

import java.util.List;

/** 카메라 영상 주소 일괄 채우기 결과. dryRun=true 이면 저장하지 않고 바꿀 내용만 담는다 */
public record CctvAssignResponse(boolean dryRun, int total, int changed, int skipped, int noCandidate,
                                 List<CctvAssignItemResponse> items) {
}
