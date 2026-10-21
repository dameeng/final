package com.mbc.puf.cctv.service;

import com.mbc.puf.cctv.dto.CctvAssignResponse;
import com.mbc.puf.common.security.LoginUser;

/**
 * camera.stream_url 일괄 채우기. 카메라 역할로 나누지 않고 카메라마다 판단한다.
 *  1) OCR 서버가 영상을 돌리는 카메라 -> "/api/cctv/{id}/stream" (MJPEG)
 *  2) 그 밖의 카메라 -> 가장 가까운 부산시 CCTV 의 HLS 주소
 */
public interface CctvAssignService {

    /**
     * 담당 지역 카메라의 주소를 채운다. 이미 진짜 주소가 있으면 건드리지 않고(overwrite=false), 시드 더미(rtsp://….puf.local)는 빈 것으로 본다.
     * dryRun=true 이면 저장하지 않고 바꿀 내용만 돌려준다. includeOcr=false 면 OCR 서버를 확인하지 않는다
     */
    CctvAssignResponse assign(LoginUser loginUser, boolean dryRun, boolean overwrite, double radiusM, boolean includeOcr);
}
