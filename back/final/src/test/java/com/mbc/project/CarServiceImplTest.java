package com.mbc.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;

import com.mbc.puf.car.dao.CarDao;
import com.mbc.puf.car.dto.Car;
import com.mbc.puf.car.dto.CarRegisterRequest;
import com.mbc.puf.car.dto.CarResponse;
import com.mbc.puf.car.dto.CarUpdateRequest;
import com.mbc.puf.car.service.CarServiceImpl;
import com.mbc.puf.common.exception.BusinessException;

/**
 * CarServiceImpl 단위 테스트.
 * DB도 스프링도 띄우지 않는다. CarDao 자리를 Mockito 가짜(@Mock)로 채워서
 * "서비스 로직만" 빠르게 확인한다.
 */
@ExtendWith(MockitoExtension.class)
class CarServiceImplTest {

    private static final Long CUSTOMER_ID = 1L;

    @Mock
    private CarDao carDao;

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

    @Test
    @DisplayName("이미 3대 등록된 고객이 4번째 차량을 등록하면 409로 거절되고 저장하지 않는다")
    void registerCar_fourthCar_isRejected() {
        when(carDao.countByCustomerId(CUSTOMER_ID)).thenReturn(3);

        BusinessException e = assertThrows(BusinessException.class,
                () -> carService.registerCar(CUSTOMER_ID, registerRequest("12가3456")));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        verify(carDao, never()).insertCar(any(Car.class));
    }

    @Test
    @DisplayName("2대 등록된 고객은 3번째 차량을 등록할 수 있다")
    void registerCar_thirdCar_succeeds() {
        when(carDao.countByCustomerId(CUSTOMER_ID)).thenReturn(2);
        when(carDao.countByCarNum("12가3456")).thenReturn(0);

        CarResponse response = carService.registerCar(CUSTOMER_ID, registerRequest("12가3456"));

        assertEquals("12가3456", response.getCarNum());
        verify(carDao).insertCar(any(Car.class));
    }

    @Test
    @DisplayName("다른 고객이 이미 등록한 번호판이면 409로 거절된다")
    void registerCar_duplicateCarNum_isRejected() {
        when(carDao.countByCustomerId(CUSTOMER_ID)).thenReturn(0);
        when(carDao.countByCarNum("12가3456")).thenReturn(1);

        BusinessException e = assertThrows(BusinessException.class,
                () -> carService.registerCar(CUSTOMER_ID, registerRequest("12가3456")));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        verify(carDao, never()).insertCar(any(Car.class));
    }

    @Test
    @DisplayName("번호판 앞뒤 공백은 제거되어 저장된다")
    void registerCar_trimsCarNum() {
        when(carDao.countByCustomerId(CUSTOMER_ID)).thenReturn(0);
        when(carDao.countByCarNum("12가3456")).thenReturn(0);

        carService.registerCar(CUSTOMER_ID, registerRequest("  12가3456  "));

        ArgumentCaptor<Car> captor = ArgumentCaptor.forClass(Car.class);
        verify(carDao).insertCar(captor.capture());
        assertEquals("12가3456", captor.getValue().getCarNum());
        assertEquals(CUSTOMER_ID, captor.getValue().getCustomerId());
    }

    @Test
    @DisplayName("동시에 같은 번호가 등록돼 DB UNIQUE에 걸리면 409로 바뀐다")
    void registerCar_dbUniqueViolation_becomesConflict() {
        when(carDao.countByCustomerId(CUSTOMER_ID)).thenReturn(0);
        when(carDao.countByCarNum("12가3456")).thenReturn(0);
        when(carDao.insertCar(any(Car.class))).thenThrow(new DuplicateKeyException("car_num"));

        BusinessException e = assertThrows(BusinessException.class,
                () -> carService.registerCar(CUSTOMER_ID, registerRequest("12가3456")));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
    }

    @Test
    @DisplayName("본인 소유가 아닌 차량을 삭제하면 404")
    void deleteCar_notOwner_isNotFound() {
        when(carDao.deleteCarByIdAndCustomerId(99L, CUSTOMER_ID)).thenReturn(0);

        BusinessException e = assertThrows(BusinessException.class,
                () -> carService.deleteCar(CUSTOMER_ID, 99L));

        assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
    }

    @Test
    @DisplayName("다른 사람이 쓰는 번호로 수정하면 409")
    void updateCar_duplicateCarNum_isRejected() {
        when(carDao.updateCarByIdAndCustomerId(10L, CUSTOMER_ID, "34나5678"))
                .thenThrow(new DuplicateKeyException("car_num"));

        BusinessException e = assertThrows(BusinessException.class,
                () -> carService.updateCar(CUSTOMER_ID, 10L, updateRequest("34나5678")));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
    }
}
