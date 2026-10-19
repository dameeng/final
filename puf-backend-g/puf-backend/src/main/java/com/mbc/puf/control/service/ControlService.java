package com.mbc.puf.control.service;

import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.control.dto.BlockRequest;
import com.mbc.puf.control.dto.CtrlTransferItem;
import com.mbc.puf.control.dto.FireTransferRequest;
import com.mbc.puf.control.dto.ReasonPresetItem;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import java.util.List;

public interface ControlService {

    /** 사유 프리셋 전체 목록 */
    List<ReasonPresetItem> getReasonPresets();

    /**
     * 지하차도 차단 (차단 이벤트 저장 + 경찰 이관 PDF 바이트 반환)
     * @return PDF 바이트 배열
     */
    PdfResult blockUnderpass(LoginUser loginUser, Long underpassId, BlockRequest request);

    /**
     * 지하차도 해제 (해제 이벤트 저장 + 경찰 이관 PDF 바이트 반환)
     * @return PDF 바이트 배열
     */
    PdfResult releaseUnderpass(LoginUser loginUser, Long underpassId, BlockRequest request);

    /**
     * 소방 이관 (잔류차량 목록 저장 + PDF 바이트 반환)
     */
    PdfResult fireTransfer(LoginUser loginUser, Long underpassId, FireTransferRequest request);

    /**
     * 이관 기록 목록 조회 (특정 지하차도 기준)
     */
    List<CtrlTransferItem> getTransferHistory(Long underpassId);

    /**
     * 이관 기록 단건 PDF 재출력
     */
    PdfResult redownloadPdf(Long transferId);

    /** PDF 파일명과 바이트를 묶는 값 객체 */
    record PdfResult(String filename, byte[] bytes, UnderpassDetailResponse underpassDetail) {}
}
