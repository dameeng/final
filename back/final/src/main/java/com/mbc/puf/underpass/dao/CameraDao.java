package com.mbc.puf.underpass.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.underpass.dto.Camera;

@Mapper
public interface CameraDao {

    // 특정 지하차도에 속한 카메라 전체 (삭제된 건 제외, 등록순)
    List<Camera> selectCamerasByUnderpassId(@Param("underpassId") Long underpassId);

    // 카메라 단건 (삭제된 건 제외, 없으면 null)
    Camera selectCameraById(@Param("id") Long id);

    // 카메라 등록. 생성된 id가 underpass_camera.id 에 채워진다
    int insertCamera(Camera camera);

    // 카메라 수정 (cameraRole/streamUrl/distanceM/latitude/longitude만)
    int updateCamera(Camera camera);

    // 카메라 삭제 (소프트 삭제, plate_log 참조 보존용)
    int softDeleteCamera(@Param("id") Long id);
}
