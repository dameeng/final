package com.mbc.puf.dbtest;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.enums.UnderpassCurrentStatus;

/** [임시] 확인 끝나면 삭제 */
@RestController
public class DbTestController {

    private final DbTestDao dbTestDao;

    public DbTestController(DbTestDao dbTestDao) {
        this.dbTestDao = dbTestDao;
    }

    @GetMapping("/test/db")
    public Map<String, Object> testDb() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dbVersion", dbTestDao.selectVersion());
        result.put("regionCount", dbTestDao.countRegion());
        result.put("riskLevels", dbTestDao.selectRiskLevels());
        result.put("normalUnderpassCount", dbTestDao.countUnderpassByStatus(UnderpassCurrentStatus.NORMAL));
        return result;
    }
    
}
