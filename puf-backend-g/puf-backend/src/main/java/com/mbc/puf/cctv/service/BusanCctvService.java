package com.mbc.puf.cctv.service;

import java.util.List;

import com.mbc.puf.cctv.dto.BusanCctvNearbyResponse;
import com.mbc.puf.cctv.dto.BusanCctvResponse;

/** 부산광역시 교통 CCTV 설치 현황(공공데이터) 조회. 목록은 한 번 받아 두고 거리만 계산한다 */
public interface BusanCctvService {

    /** 전체 목록. 받아 둔 목록이 없고 새로 받기도 실패하면 503 */
    List<BusanCctvResponse> getAll();

    /**
     * 기준 좌표에서 radiusM 안의 CCTV 를 가까운 순으로 limit 개.
     * nameHint 가 있으면 설치 위치 이름에 그 말이 들어간 CCTV 를 먼저 둔다
     */
    List<BusanCctvNearbyResponse> getNearby(double lat, double lng, double radiusM, int limit, String nameHint);
}
