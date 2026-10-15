package com.mbc.puf.region.service;

import java.util.List;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.region.dao.RegionDao;
import com.mbc.puf.region.dto.RegionCreateRequest;
import com.mbc.puf.region.dto.RegionResponse;
import com.mbc.puf.region.dto.RegionUpdateRequest;

@Service
public class RegionServiceImpl implements RegionService {

    // 지역 삭제 시 소속 데이터를 옮겨두는 특수 지역 (수정/삭제 금지)
    private static final String UNASSIGNED_REGION_NAME = "미배정";

    private final RegionDao regionDao;

    public RegionServiceImpl(RegionDao regionDao) {
        this.regionDao = regionDao;
    }

    @Override
    @Transactional(readOnly = true)
    public List<RegionResponse> getRegionList() {
        return regionDao.selectRegionList();
    }

    @Override
    @Transactional
    public RegionResponse createRegion(RegionCreateRequest request) {
        String name = request.getName().trim();

        if (regionDao.selectRegionByName(name) != null) {
            throw duplicateName(name);
        }

        RegionResponse region = new RegionResponse();
        region.setName(name);
        try {
            regionDao.insertRegion(region);      // 생성된 id가 region.id 에 채워진다
        } catch (DuplicateKeyException e) {      // 위 확인과 insert 사이에 동시 요청이 들어온 경우
            throw duplicateName(name);
        }
        return region;
    }

    @Override
    @Transactional
    public RegionResponse updateRegion(Long id, RegionUpdateRequest request) {
        RegionResponse region = getActiveRegion(id);
        blockIfUnassigned(region, "'미배정' 지역은 이름을 변경할 수 없습니다.");

        String name = request.getName().trim();

        RegionResponse sameName = regionDao.selectRegionByName(name);
        if (sameName != null && !sameName.getId().equals(id)) {   // 자기 자신과 같은 이름은 허용
            throw duplicateName(name);
        }

        try {
            regionDao.updateRegionName(id, name);
        } catch (DuplicateKeyException e) {
            throw duplicateName(name);
        }
        region.setName(name);
        return region;
    }

    @Override
    @Transactional
    public void deleteRegion(Long id) {
        RegionResponse region = getActiveRegion(id);
        blockIfUnassigned(region, "'미배정' 지역은 삭제할 수 없습니다.");

        RegionResponse unassigned = regionDao.selectRegionByName(UNASSIGNED_REGION_NAME);
        if (unassigned == null) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "'미배정' 지역이 존재하지 않습니다. 시드 데이터를 확인해주세요.");
        }

        // 세 쿼리는 한 트랜잭션: 중간에 실패하면 전부 롤백된다
        regionDao.updateUnderpassRegion(id, unassigned.getId());
        regionDao.updateManagerRegion(id, unassigned.getId());
        regionDao.softDeleteRegion(id);
    }

    // ---- 내부 메서드 ----

    // 삭제되지 않은 지역 조회, 없으면 404
    private RegionResponse getActiveRegion(Long id) {
        RegionResponse region = regionDao.selectRegionById(id);
        if (region == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 지역입니다. id=" + id);
        }
        return region;
    }

    // '미배정' 이면 400
    private void blockIfUnassigned(RegionResponse region, String message) {
        if (UNASSIGNED_REGION_NAME.equals(region.getName())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private BusinessException duplicateName(String name) {
        return new BusinessException(HttpStatus.CONFLICT, "이미 존재하는 지역 이름입니다. name=" + name);
    }
}