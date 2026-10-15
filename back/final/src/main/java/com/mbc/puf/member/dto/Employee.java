package com.mbc.puf.member.dto;

import java.time.LocalDate;

/** employee 테이블 1행 (회사가 사전 등록한 직원 정보. 내부용, API로 그대로 내보내지 않는다) */
public class Employee {

    private Long id;
    private String name;
    private LocalDate birthDate;
    private String phone;
    private String email;

    public Employee() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public LocalDate getBirthDate() { return birthDate; }
    public void setBirthDate(LocalDate birthDate) { this.birthDate = birthDate; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}
