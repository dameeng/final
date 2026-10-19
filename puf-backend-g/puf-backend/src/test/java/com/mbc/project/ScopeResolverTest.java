package com.mbc.project;

import static com.mbc.project.TestEntities.withId;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.request.ScopeQuery;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.common.security.ScopeResolver;
import com.mbc.puf.member.repository.ManagerRegionRepository;
import com.mbc.puf.underpass.entity.Underpass;
import com.mbc.puf.underpass.repository.UnderpassRepository;

/**
 * [공통 조건 묶음: Scope] 관리자 조회·조작 범위 결정 규칙.
 * 관리자는 모두 지역담당자이고 담당 지역은 manager_region 에 여러 개 있을 수 있다.
 */
@ExtendWith(MockitoExtension.class)
class ScopeResolverTest {

    private static final Long REGION_A = 11L;
    private static final Long REGION_B = 22L;
    private static final Long REGION_C = 33L;

    @Mock private UnderpassRepository underpassRepository;
    @Mock private ManagerRegionRepository managerRegionRepository;
    @InjectMocks private ScopeResolver scopeResolver;

    private final LoginUser managerAB = new LoginUser(1L, "MANAGER", "REGIONAL_ADMIN");   // A·B 담당
    private final LoginUser managerNone = new LoginUser(2L, "MANAGER", "REGIONAL_ADMIN"); // 담당 지역 없음
    private final LoginUser customer = new LoginUser(9L, "CUSTOMER", "CUSTOMER");

    @BeforeEach
    void setUp() {
        lenient().when(managerRegionRepository.findRegionIds(1L)).thenReturn(List.of(REGION_A, REGION_B));
        lenient().when(managerRegionRepository.findRegionIds(2L)).thenReturn(List.of());
    }

    private void givenUnderpass(Long id, Long regionId) {
        Underpass u = withId(new Underpass(), id);
        u.setRegionId(regionId);
        when(underpassRepository.findByIdAndDeletedFalse(id)).thenReturn(Optional.of(u));
    }

    @Test
    @DisplayName("지역을 안 주면 담당 지역 전체(A·B)로 조회한다")
    void noRegion_usesAllOwnRegions() {
        assertEquals(List.of(REGION_A, REGION_B), scopeResolver.resolve(managerAB, ScopeQuery.of(null, null)).getRegionIds());
    }

    @Test
    @DisplayName("담당 지역 중 하나를 주면 그 지역만")
    void ownRegion_narrowsToIt() {
        assertEquals(List.of(REGION_B), scopeResolver.resolve(managerAB, ScopeQuery.of(REGION_B, null)).getRegionIds());
    }

    @Test
    @DisplayName("담당하지 않는 지역을 주면 403")
    void otherRegion_isForbidden() {
        BusinessException e = assertThrows(BusinessException.class,
                () -> scopeResolver.resolve(managerAB, ScopeQuery.of(REGION_C, null)));

        assertEquals(HttpStatus.FORBIDDEN, e.getStatus());
    }

    @Test
    @DisplayName("담당 지역이 하나도 없으면 결과가 0건이 되는 값([-1])으로 조회한다 (IN 절이 비지 않게)")
    void noAssignedRegion_matchesNothing() {
        assertEquals(List.of(-1L), scopeResolver.resolve(managerNone, ScopeQuery.of(null, null)).getRegionIds());
    }

    @Test
    @DisplayName("담당 지역 밖 지하차도를 지정하면 403, 담당 지역 지하차도면 통과")
    void underpassScope() {
        givenUnderpass(3L, REGION_C);
        givenUnderpass(1L, REGION_A);

        BusinessException e = assertThrows(BusinessException.class,
                () -> scopeResolver.resolve(managerAB, ScopeQuery.of(null, 3L)));
        assertEquals(HttpStatus.FORBIDDEN, e.getStatus());

        assertEquals(1L, scopeResolver.resolve(managerAB, ScopeQuery.of(null, 1L)).getUnderpassId());
    }

    @Test
    @DisplayName("없는(삭제된) 지하차도를 지정하면 404")
    void unknownUnderpass_isNotFound() {
        when(underpassRepository.findByIdAndDeletedFalse(99L)).thenReturn(Optional.empty());

        BusinessException e = assertThrows(BusinessException.class,
                () -> scopeResolver.resolve(managerAB, ScopeQuery.of(null, 99L)));

        assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
    }

    @Test
    @DisplayName("관리자가 아니면 요청값 그대로 (안 주면 전국)")
    void nonManager_isNotLimited() {
        assertNull(scopeResolver.resolve(customer, ScopeQuery.of(null, null)).getRegionIds());
        assertEquals(List.of(REGION_C), scopeResolver.resolve(customer, ScopeQuery.of(REGION_C, null)).getRegionIds());
    }

    @Test
    @DisplayName("조작(등록·수정·차단)은 담당 지역 안에서만 허용")
    void requireOwnable() {
        assertDoesNotThrow(() -> scopeResolver.requireOwnable(managerAB, REGION_B));
        BusinessException e = assertThrows(BusinessException.class,
                () -> scopeResolver.requireOwnable(managerAB, REGION_C));
        assertEquals(HttpStatus.FORBIDDEN, e.getStatus());
    }
}
