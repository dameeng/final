# PUF 백엔드 (Spring Boot 4.1 + Gradle + Spring Data JPA)

## 처음 세팅
1. **DB 만들기**: PostgreSQL 에서 `db/puf_db_schema_rename_only.sql` 실행 (⚠️ public 스키마를 통째로 지움 — 개발 DB에서만)
   - 그 다음 시드 데이터(직원·관리자·지역·날씨지역 등)를 넣어주세요. 테이블/컬럼명이 바뀌었으니 예전 시드 SQL은 이름을 맞춰야 해요.
2. **비밀 설정**: `src/main/resources/application-secret.properties.example` 을 복사해서 `application-secret.properties` 로 만들고 메일 계정 입력
3. DB 비밀번호가 다르면 `application.properties` 의 `spring.datasource.password` 수정

## STS(Eclipse)로 열기
`File > Import > Gradle > Existing Gradle Project` → 압축 푼 폴더 선택 → Finish
- Gradle Wrapper(gradlew)가 들어 있어서 Gradle을 따로 설치할 필요 없어요 (처음 한 번 인터넷으로 내려받음).
- 실행: `FinalApplication` 우클릭 → Run As → Spring Boot App (포트 5555)

## 터미널로
```
./gradlew bootRun        # 실행 (Windows: gradlew.bat bootRun)
./gradlew test           # 테스트 (FinalApplicationTests 는 DB가 켜져 있어야 통과)
./gradlew bootJar        # build/libs/puf-0.0.1-SNAPSHOT.jar 생성
```

## 문서
- `docs/API_변경사항.md` — 프론트가 맞춰야 할 API 변경 목록
- `docs/JPA_전환_가이드.md` — 코드 구조와 JPA 사용 규칙
