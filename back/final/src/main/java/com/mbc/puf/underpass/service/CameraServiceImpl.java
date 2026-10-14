package com.mbc.puf.underpass.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.underpass.dao.CameraDao;
import com.mbc.puf.underpass.dao.UnderpassDao;
import com.mbc.puf.underpass.dto.Camera;
import com.mbc.puf.underpass.dto.CameraCreateRequest;
import com.mbc.puf.underpass.dto.CameraResponse;
import com.mbc.puf.underpass.dto.CameraUpdateRequest;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;

@Service
public class CameraServiceImpl implements CameraService {

    private static final String REGIONAL_ADMIN = "REGIONAL_ADMIN";

    private final CameraDao cameraDao;
    private final UnderpassDao underpassDao;

    public CameraServiceImpl(CameraDao cameraDao, UnderpassDao underpassDao) {
        this.cameraDao = cameraDao;
        this.underpassDao = underpassDao;
    }

    @Override
    @Transactional(readOnly = true)
    public List<CameraResponse> getCameras(LoginUser loginUser, Long underpassId) {
        requireExistingUnderpass(underpassId);   // 지역 제한 없이 존재만 확인 (조회는 관리자 모두 허용)
        return cameraDao.selectCamerasByUnderpassId(underpassId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CameraResponse getCamera(LoginUser loginUser, Long underpassId, Long id) {
        return toResponse(requireCameraOfUnderpass(underpassId, id));
    }

    @Override
    @Transactional
    public CameraResponse createCamera(LoginUser loginUser, Long underpassId, CameraCreateRequest request) {
        UnderpassDetailResponse underpass = requireExistingUnderpass(underpassId);
        requireOwnableRegion(loginUser, underpass.getRegionId());

        Camera camera = new Camera();
        camera.setUnderpassId(underpassId);
        camera.setCameraRole(request.getCameraRole());
        camera.setStreamUrl(request.getStreamUrl());
        camera.setDistanceM(request.getDistanceM());
        camera.setLatitude(request.getLatitude());
        camera.setLongitude(request.getLongitude());

        cameraDao.insertCamera(camera);   // 생성된 id가 camera.id 에 채워진다

        return toResponse(requireCameraOfUnderpass(underpassId, camera.getId()));
    }

    @Override
    @Transactional
    public CameraResponse updateCamera(LoginUser loginUser, Long underpassId, Long id, CameraUpdateRequest request) {
        requireCameraOfUnderpass(underpassId, id);   // 존재 + 해당 지하차도 소속 확인

        UnderpassDetailResponse underpass = requireExistingUnderpass(underpassId);
        requireOwnableRegion(loginUser, underpass.getRegionId());

        Camera camera = new Camera();
        camera.setId(id);
        camera.setCameraRole(request.getCameraRole());
        camera.setStreamUrl(request.getStreamUrl());
        camera.setDistanceM(request.getDistanceM());
        camera.setLatitude(request.getLatitude());
        camera.setLongitude(request.getLongitude());

        cameraDao.updateCamera(camera);

        return toResponse(requireCameraOfUnderpass(underpassId, id));
    }

    @Override
    @Transactional
    public void deleteCamera(LoginUser loginUser, Long underpassId, Long id) {
        requireCameraOfUnderpass(underpassId, id);

        UnderpassDetailResponse underpass = requireExistingUnderpass(underpassId);
        requireOwnableRegion(loginUser, underpass.getRegionId());

        cameraDao.softDeleteCamera(id);
    }

    // ---- 내부 메서드 ----

    private UnderpassDetailResponse requireExistingUnderpass(Long underpassId) {
        UnderpassDetailResponse underpass = underpassDao.selectUnderpassById(underpassId);
        if (underpass == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 지하차도입니다. id=" + underpassId);
        }
        return underpass;
    }

    // 카메라가 존재하고, 지정된 underpassId 소속인지 확인. 아니면 404 (다른 지하차도의 카메라 id로 접근 차단)
    private Camera requireCameraOfUnderpass(Long underpassId, Long id) {
        Camera camera = cameraDao.selectCameraById(id);
        if (camera == null || !camera.getUnderpassId().equals(underpassId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 카메라입니다. id=" + id);
        }
        return camera;
    }

    // REGIONAL_ADMIN이 자기 담당 지역이 아닌 지하차도의 카메라를 등록/수정/삭제하려 하면 차단
    private void requireOwnableRegion(LoginUser loginUser, Long regionId) {
        if (REGIONAL_ADMIN.equals(loginUser.role()) && !loginUser.regionId().equals(regionId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "담당 지역 외에는 등록·수정·삭제할 수 없습니다.");
        }
    }

    private CameraResponse toResponse(Camera camera) {
        return new CameraResponse(camera.getId(), camera.getUnderpassId(), camera.getCameraRole(),
                camera.getStreamUrl(), camera.getDistanceM(), camera.getLatitude(), camera.getLongitude(),
                camera.getCreatedAt());
    }
}
