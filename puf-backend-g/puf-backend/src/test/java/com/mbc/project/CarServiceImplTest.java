package com.mbc.project;

import static com.mbc.project.TestEntities.withId;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import com.mbc.puf.car.dto.CarRegisterRequest;
import com.mbc.puf.car.dto.CarResponse;
import com.mbc.puf.car.dto.CarUpdateRequest;
import com.mbc.puf.car.entity.Car;
import com.mbc.puf.car.repository.CarRepository;
import com.mbc.puf.car.service.CarServiceImpl;
import com.mbc.puf.common.exception.BusinessException;

/**
 * CarServiceImpl 단위 테스트.
 * DB도 스프링도 띄우지 않는다. CarRepository 자리를 Mockito 가짜(@Mock)로 채워서
 * "서비스 로직만" 빠르게 확인한다.
 */
@ExtendWith(MockitoExtension.class)
class CarServiceImplTest {

    private static final Long CUSTOMER_ID = 1L;

    @Mock
    private CarRepository carRepository;

    @InjectMocks
    private CarServiceImpl carService;

    private CarRegisterRequest registerRequest(String carNum) {
        CarRegisterRequest request = new CarRegisterRequest();
        request.setCarNum(carNum);
        return request;
    }

    private CarUpdateRequest updateRequest(String carNum) {
        CarUpdateRequest request = new CarUpdateRequest();
        request.setCarNum(carNum);
        return request;
    }

    private Car myCar(Long id, String carNum) {
        Car car = withId(new Car(), id);
        car.setCustomerId(CUSTOMER_ID);
        car.setCarNum(carNum);
        return car;
    }

    @Test
    @DisplayName("이미 3대 등록된 고객이 4번째 차량을 등록하면 409로 거절되고 저장하지 않는다")
    void registerCar_fourthCar_isRejected() {
        when(carRepository.countByCustomerIdAndDeletedFalse(CUSTOMER_ID)).thenReturn(3L);

        BusinessException e = assertThrows(BusinessException.class,
                () -> carService.registerCar(CUSTOMER_ID, registerRequest("12가3456")));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        verify(carRepository, never()).saveAndFlush(any(Car.class));
    }

    @Test
    @DisplayName("2대 등록된 고객은 3번째 차량을 등록할 수 있다")
    void registerCar_thirdCar_succeeds() {
        when(carRepository.countByCustomerIdAndDeletedFalse(CUSTOMER_ID)).thenReturn(2L);

        CarResponse response = carService.registerCar(CUSTOMER_ID, registerRequest("12가3456"));

        assertEquals("12가3456", response.getCarNum());
        verify(carRepository).saveAndFlush(any(Car.class));
    }

    @Test
    @DisplayName("내가 이미 등록한 번호를 또 등록하면 409 (다른 고객의 같은 번호는 허용)")
    void registerCar_myDuplicate_isRejected() {
        when(carRepository.countByCustomerIdAndDeletedFalse(CUSTOMER_ID)).thenReturn(1L);
        when(carRepository.existsByCustomerIdAndCarNumAndDeletedFalse(CUSTOMER_ID, "12가3456")).thenReturn(true);

        BusinessException e = assertThrows(BusinessException.class,
                () -> carService.registerCar(CUSTOMER_ID, registerRequest("12가3456")));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        verify(carRepository, never()).saveAndFlush(any(Car.class));
    }

    @Test
    @DisplayName("번호판 사이·앞뒤 공백은 모두 제거되어 저장된다")
    void registerCar_removesWhitespace() {
        when(carRepository.countByCustomerIdAndDeletedFalse(CUSTOMER_ID)).thenReturn(0L);

        carService.registerCar(CUSTOMER_ID, registerRequest("  서울 12 가 3456 "));

        ArgumentCaptor<Car> captor = ArgumentCaptor.forClass(Car.class);
        verify(carRepository).saveAndFlush(captor.capture());
        assertEquals("서울12가3456", captor.getValue().getCarNum());
        assertEquals(CUSTOMER_ID, captor.getValue().getCustomerId());
    }

    @ParameterizedTest
    @ValueSource(strings = { "1234", "12A3456", "가12나3456", "1가3456", "12가345", "서울1가3456", "독도12가3456" })
    @DisplayName("형식에 맞지 않는 차량번호는 400 (저장 안 함)")
    void registerCar_invalidFormat_isBadRequest(String carNum) {
        BusinessException e = assertThrows(BusinessException.class,
                () -> carService.registerCar(CUSTOMER_ID, registerRequest(carNum)));

        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        verify(carRepository, never()).saveAndFlush(any(Car.class));
    }

    @Test
    @DisplayName("동시에 같은 번호가 등록돼 DB 부분 유니크에 걸리면 409로 바뀐다")
    void registerCar_dbUniqueViolation_becomesConflict() {
        when(carRepository.countByCustomerIdAndDeletedFalse(CUSTOMER_ID)).thenReturn(0L);
        when(carRepository.saveAndFlush(any(Car.class))).thenThrow(new DataIntegrityViolationException("uq_car"));

        BusinessException e = assertThrows(BusinessException.class,
                () -> carService.registerCar(CUSTOMER_ID, registerRequest("12가3456")));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
    }

    @Test
    @DisplayName("삭제는 행을 지우지 않고 is_deleted = TRUE 로 표시한다")
    void deleteCar_isSoftDelete() {
        Car car = myCar(10L, "12가3456");
        when(carRepository.findByIdAndCustomerIdAndDeletedFalse(10L, CUSTOMER_ID)).thenReturn(Optional.of(car));

        carService.deleteCar(CUSTOMER_ID, 10L);

        assertTrue(car.isDeleted());
        verify(carRepository, never()).delete(any(Car.class));
    }

    @Test
    @DisplayName("본인 소유가 아니거나 이미 삭제된 차량을 삭제하면 404")
    void deleteCar_notOwner_isNotFound() {
        when(carRepository.findByIdAndCustomerIdAndDeletedFalse(99L, CUSTOMER_ID)).thenReturn(Optional.empty());

        BusinessException e = assertThrows(BusinessException.class,
                () -> carService.deleteCar(CUSTOMER_ID, 99L));

        assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
    }

    @Test
    @DisplayName("내 다른 차량과 같은 번호로 수정하면 409")
    void updateCar_myDuplicate_isRejected() {
        when(carRepository.findByIdAndCustomerIdAndDeletedFalse(10L, CUSTOMER_ID))
                .thenReturn(Optional.of(myCar(10L, "12가3456")));
        when(carRepository.existsByCustomerIdAndCarNumAndDeletedFalse(CUSTOMER_ID, "34나5678")).thenReturn(true);

        BusinessException e = assertThrows(BusinessException.class,
                () -> carService.updateCar(CUSTOMER_ID, 10L, updateRequest("34나5678")));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
    }

    @Test
    @DisplayName("동시 수정으로 DB 부분 유니크에 걸리면 409")
    void updateCar_dbUniqueViolation_becomesConflict() {
        when(carRepository.findByIdAndCustomerIdAndDeletedFalse(10L, CUSTOMER_ID))
                .thenReturn(Optional.of(myCar(10L, "12가3456")));
        doThrow(new DataIntegrityViolationException("uq_car")).when(carRepository).flush();

        BusinessException e = assertThrows(BusinessException.class,
                () -> carService.updateCar(CUSTOMER_ID, 10L, updateRequest("34나5678")));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
    }
}
