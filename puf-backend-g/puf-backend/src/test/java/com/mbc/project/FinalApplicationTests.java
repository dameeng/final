package com.mbc.project;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import com.mbc.puf.FinalApplication;

/**
 * 스프링 전체(DB 연결 포함)가 뜨는지 확인. application.properties 의 DB가 실제로 켜져 있어야 통과한다.
 * (테스트 패키지가 com.mbc.project 라서 메인 클래스를 직접 지정해야 한다 — 예전엔 이게 없어서 항상 실패했음)
 */
@SpringBootTest(classes = FinalApplication.class)
class FinalApplicationTests {

	@Test
	void contextLoads() {
	}

}
