package com.mbc.puf.car.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.car.dto.Car;

@Mapper
public interface CarDao {

    // 같은 차량번호 수 (번호판 1개당 등록 고객 1명 — car_num UNIQUE)
    int countByCarNum(@Param("carNum") String carNum);

    // 그 고객이 지금 등록해둔 차량 수 (최대 3대 제한 체크용)
    int countByCustomerId(@Param("customerId") Long customerId);

    // 차량 등록. 생성된 id가 car.id 에 채워진다
    int insertCar(Car car);

    // 그 고객이 등록한 차량 목록 (등록일순)
    List<Car> selectCarsByCustomerId(@Param("customerId") Long customerId);

    // 소유자 본인의 차량만 지울 수 있도록 customerId 도 조건에 건다. 반환값이 0이면 본인 소유가 아니거나 없는 것
    int deleteCarByIdAndCustomerId(@Param("id") Long id, @Param("customerId") Long customerId);

    // 번호판 인식 결과와 매칭할 때 쓰는 차량번호 완전일치 조회 (없으면 null)
    Car selectCarByCarNum(@Param("carNum") String carNum);

    // 본인 소유 차량 단건 조회 (수정 결과 응답용, 없으면 null)
    Car selectCarByIdAndCustomerId(@Param("id") Long id, @Param("customerId") Long customerId);

    // 차량번호 수정. 본인 소유가 아니거나 없으면 0. car_num UNIQUE라 다른 사람이 쓰는 번호면 DuplicateKeyException
    int updateCarByIdAndCustomerId(@Param("id") Long id, @Param("customerId") Long customerId,
                                     @Param("carNum") String carNum);

    // 소유자 상관없이 id로만 조회 (알림 발송 시 customerId를 알아내는 용도, 없으면 null)
    Car selectCarById(@Param("id") Long id);
}