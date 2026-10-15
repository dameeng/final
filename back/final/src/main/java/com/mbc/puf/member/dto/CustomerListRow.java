package com.mbc.puf.member.dto;

import java.time.LocalDateTime;

/** 고객 목록 조회 쿼리의 결과 1행 (내부용) */
public class CustomerListRow {

    private Long id;
    private String loginId;
    private String name;
    private String email;
    private String phone;
    private LocalDateTime createdAt;
    private boolean withdrawn;
    private String carNumsCsv;       // 그 고객의 차량번호를 쉼표로 이은 값 (없으면 null)

    public CustomerListRow() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getLoginId() { return loginId; }
    public void setLoginId(String loginId) { this.loginId = loginId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public boolean isWithdrawn() { return withdrawn; }
    public void setWithdrawn(boolean withdrawn) { this.withdrawn = withdrawn; }

    public String getCarNumsCsv() { return carNumsCsv; }
    public void setCarNumsCsv(String carNumsCsv) { this.carNumsCsv = carNumsCsv; }
}
