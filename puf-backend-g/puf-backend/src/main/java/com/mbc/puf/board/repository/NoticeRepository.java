package com.mbc.puf.board.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.mbc.puf.board.entity.Notice;

public interface NoticeRepository extends JpaRepository<Notice, Long> {

    Optional<Notice> findByIdAndDeletedFalse(Long id);
}
