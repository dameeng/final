package com.mbc.project;

import org.springframework.test.util.ReflectionTestUtils;

/** 테스트용: JPA 엔티티의 id는 DB가 만들어서 setter가 없으므로, 테스트에서만 리플렉션으로 채운다 */
final class TestEntities {

    private TestEntities() {
    }

    static <T> T withId(T entity, Long id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
