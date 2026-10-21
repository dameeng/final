package com.mbc.puf.cctv.dto;

/** 부산시 교통 CCTV 1대. url 은 HLS(.m3u8) 주소 */
public record BusanCctvResponse(String id, String name, String address, String url, double lat, double lng) {
}
