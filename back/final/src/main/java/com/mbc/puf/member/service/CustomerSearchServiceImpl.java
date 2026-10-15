package com.mbc.puf.member.service;

import java.util.Arrays;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.request.PageParams;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.util.LikePattern;
import com.mbc.puf.common.util.SearchKeyword;
import com.mbc.puf.member.dao.CustomerDao;
import com.mbc.puf.member.dao.CustomerSearchDao;
import com.mbc.puf.member.dto.Customer;
import com.mbc.puf.member.dto.CustomerListItem;
import com.mbc.puf.member.dto.CustomerListRow;
import com.mbc.puf.member.dto.CustomerProfileUpdateRequest;
import com.mbc.puf.member.dto.CustomerSearchCondition;

@Service
public class CustomerSearchServiceImpl implements CustomerSearchService {

    private final CustomerSearchDao customerSearchDao;
    private final CustomerDao customerDao;

    public CustomerSearchServiceImpl(CustomerSearchDao customerSearchDao, CustomerDao customerDao) {
        this.customerSearchDao = customerSearchDao;
        this.customerDao = customerDao;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CustomerListItem> search(String keyword, String loginId, String name, String email,
                                                 String phone, String carNum, boolean includeWithdrawn,
                                                 int page, int size) {
        PageParams pageParams = PageParams.of(page, size);

        CustomerSearchCondition condition = new CustomerSearchCondition();

        // 통합 검색어: 비어 있으면 검색어 없이 전체 조회
        SearchKeyword searchKeyword = SearchKeyword.of(keyword);
        if (searchKeyword != null) {
            condition.setKeyword(searchKeyword.getText());
            condition.setKeywordPhone(searchKeyword.getPhone());
            condition.setKeywordCar(searchKeyword.getCar());
        }

        // 항목별 조건: 비어 있으면 null → 조건에서 빠진다
        condition.setLoginId(LikePattern.of(loginId));
        condition.setName(LikePattern.of(name));
        condition.setEmail(LikePattern.of(email));
        condition.setPhone(LikePattern.ofPhone(phone));
        condition.setCarNum(LikePattern.ofCar(carNum));

        condition.setIncludeWithdrawn(includeWithdrawn);
        condition.setSize(pageParams.getSize());
        condition.setOffset(pageParams.getOffset());

        long total = customerSearchDao.countCustomerList(condition);
        List<CustomerListItem> items = (total == 0)
                ? List.of()
                : customerSearchDao.selectCustomerList(condition).stream().map(this::toItem).toList();

        return new PageResponse<>(items, pageParams.getPage(), pageParams.getSize(), total);
    }

    @Override
    @Transactional
    public void updateCustomer(Long customerId, CustomerProfileUpdateRequest request) {
        requireExistingCustomer(customerId);
        // 고객 본인의 마이페이지 수정(CustomerServiceImpl.updateProfile)과 같은 정규화 규칙을 적용한다.
        // 이게 없으면 관리자가 수정한 건만 하이픈이 남아 저장 형식이 경로별로 달라진다
        // (검색 자체는 REPLACE(phone,'-','')로 비교해서 깨지지 않지만, 데이터 형식을 통일해두는 게 맞다)
        customerDao.updateCustomerProfile(customerId,
                normalizePhone(request.getPhone()),
                normalizePhone(request.getEmergency()),
                request.getZipcode().trim(),
                request.getRoadAddress().trim(),
                blankToNull(request.getDetailAddress()));
    }

    @Override
    @Transactional
    public void forceWithdraw(Long customerId) {
        Customer customer = requireExistingCustomer(customerId);
        if (customer.isWithdrawn()) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 탈퇴한 회원입니다.");
        }
        customerDao.updateWithdraw(customerId);
    }

    // ---- 내부 메서드 ----

    // 하이픈을 제거해 숫자만 저장한다. 값이 없으면 null. 형식 검증은 요청 DTO에서 끝났다.
    private String normalizePhone(String phone) {
        String value = blankToNull(phone);
        return value == null ? null : value.replace("-", "");
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    private Customer requireExistingCustomer(Long customerId) {
        Customer customer = customerDao.selectCustomerById(customerId);
        if (customer == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 고객입니다. id=" + customerId);
        }
        return customer;
    }

    private CustomerListItem toItem(CustomerListRow row) {
        List<String> carNums = (row.getCarNumsCsv() == null)
                ? List.of()
                : Arrays.asList(row.getCarNumsCsv().split(","));
        return new CustomerListItem(row.getId(), row.getLoginId(), row.getName(), row.getEmail(),
                row.getPhone(), carNums, row.getCreatedAt(), row.isWithdrawn());
    }
}