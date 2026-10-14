package com.mbc.puf.member.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** customer 테이블 INSERT/SELECT용 (내부용, API로 그대로 내보내지 않는다) */
public class Customer {

    private Long id;
    private String loginId;
    private String password;       // BCrypt 해시 (조회 시 필요할 때만 채워진다)
    private String name;
    private LocalDate birthDate;
    private String email;
    private String phone;
    private String emergency;
    private String zipcode;
    private String roadAddress;
    private String detailAddress;
    private boolean withdrawn;
    private LocalDateTime createdAt;

    public Customer() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getLoginId() { return loginId; }
    public void setLoginId(String loginId) { this.loginId = loginId; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public LocalDate getBirthDate() { return birthDate; }
    public void setBirthDate(LocalDate birthDate) { this.birthDate = birthDate; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmergency() { return emergency; }
    public void setEmergency(String emergency) { this.emergency = emergency; }

    public String getZipcode() { return zipcode; }
    public void setZipcode(String zipcode) { this.zipcode = zipcode; }

    public String getRoadAddress() { return roadAddress; }
    public void setRoadAddress(String roadAddress) { this.roadAddress = roadAddress; }

    public String getDetailAddress() { return detailAddress; }
    public void setDetailAddress(String detailAddress) { this.detailAddress = detailAddress; }

    public boolean isWithdrawn() { return withdrawn; }
    public void setWithdrawn(boolean withdrawn) { this.withdrawn = withdrawn; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
