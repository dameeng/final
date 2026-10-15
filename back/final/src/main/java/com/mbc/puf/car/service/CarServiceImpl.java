package com.mbc.puf.car.service;

import java.util.List;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.car.dao.CarDao;
import com.mbc.puf.car.dto.Car;
import com.mbc.puf.car.dto.CarRegisterRequest;
import com.mbc.puf.car.dto.CarResponse;
import com.mbc.puf.car.dto.CarUpdateRequest;
import com.mbc.puf.common.exception.BusinessException;

@Service
public class CarServiceImpl implements CarService {

    // CP-03 스펙: 차량은 고객당 최대 3대까지
    private static final int MAX_CARS_PER_CUSTOMER = 3;

    private final CarDao carDao;

    public CarServiceImpl(CarDao carDao) {
        this.carDao = carDao;
    }

    @Override
    @Transactional(readOnly = true)
    public List<CarResponse> getMyCars(Long customerId) {
        return carDao.selectCarsByCustomerId(customerId).stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public CarResponse registerCar(Long customerId, CarRegisterRequest request) {
        if (carDao.countByCustomerId(customerId) >= MAX_CARS_PER_CUSTOMER) {
            throw new BusinessException(HttpStatus.CONFLICT, "차량은 최대 " + MAX_CARS_PER_CUSTOMER + "대까지 등록할 수 있습니다.");
        }

        String carNum = request.getCarNum().trim();

        if (carDao.countByCarNum(carNum) > 0) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 등록된 차량번호입니다.");
        }

        Car car = new Car();
        car.setCustomerId(customerId);
        car.setCarNum(carNum);
        try {
            carDao.insertCar(car);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 등록된 차량번호입니다.");
        }
        return toResponse(car);
    }

    @Override
    @Transactional
    public CarResponse updateCar(Long customerId, Long carId, CarUpdateRequest request) {
        String carNum = request.getCarNum().trim();

        try {
            if (carDao.updateCarByIdAndCustomerId(carId, customerId, carNum) == 0) {
                throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 차량이거나 본인 소유가 아닙니다.");
            }
        } catch (DuplicateKeyException e) {
            // car_num은 UNIQUE라, 같은 번호로 "수정 안 함"이면 자기 자신 행이라 충돌 안 나고,
            // 다른 사람이 이미 쓰는 번호로 바꾸려 할 때만 여기 걸린다
            throw new BusinessException(HttpStatus.CONFLICT, "이미 등록된 차량번호입니다.");
        }

        return toResponse(carDao.selectCarByIdAndCustomerId(carId, customerId));
    }

    @Override
    @Transactional
    public void deleteCar(Long customerId, Long carId) {
        if (carDao.deleteCarByIdAndCustomerId(carId, customerId) == 0) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 차량이거나 본인 소유가 아닙니다.");
        }
    }

    private CarResponse toResponse(Car car) {
        return new CarResponse(car.getId(), car.getCarNum(), car.getCreatedAt());
    }
}