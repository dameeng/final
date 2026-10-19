package com.mbc.puf.board.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.mbc.puf.board.entity.Faq;

public interface FaqRepository extends JpaRepository<Faq, Long> {

    Optional<Faq> findByIdAndDeletedFalse(Long id);
}
