package com.mbc.puf.board.dto;

/** inquiry 테이블 원글 INSERT용 (내부용). 생성된 id를 돌려받으려고 쓴다 */
public class Inquiry {

    private Long id;
    private Long customerId;
    private String title;
    private String content;

    public Inquiry() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
