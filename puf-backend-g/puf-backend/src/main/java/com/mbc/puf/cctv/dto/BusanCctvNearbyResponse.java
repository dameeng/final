package com.mbc.puf.cctv.dto;

/** 기준 좌표 주변 부산시 CCTV 1대. distance 는 기준 좌표까지의 거리(m) */
public record BusanCctvNearbyResponse(String id, String name, String address, String url, double lat, double lng, double distance) {
}
