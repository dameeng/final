package com.mbc.puf.common.pdf;

import com.itextpdf.io.font.PdfEncodings;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.font.PdfFontFactory.EmbeddingStrategy;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.Style;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.HorizontalAlignment;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * 통제정보 이관 PDF 생성기
 * - 경찰 이관: 차단/해제 정보
 * - 소방 이관: 잔류차량 목록
 * iText 9.x 기준 (setBold() 없음 → 폰트 사이즈/색상으로 강조)
 */
@Component
public class TransferPdfGenerator {

    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("yyyy년 MM월 dd일 HH시 mm분");
    private static final DeviceRgb HEADER_BG = new DeviceRgb(0x1A, 0x56, 0xDB);
    private static final DeviceRgb ROW_ALT_BG = new DeviceRgb(0xF3, 0xF4, 0xF6);
    private static final DeviceRgb DARK = new DeviceRgb(0x11, 0x18, 0x27);
    private static final DeviceRgb LABEL_COLOR = new DeviceRgb(0x37, 0x40, 0x51);
    private static final DeviceRgb MUTED = new DeviceRgb(0x6B, 0x72, 0x80);
    private static final float[] COL_LABEL_CONTENT = {3f, 7f};
    private static final float MARGIN = 50f;

    /**
     * 경찰 이관 PDF (차단 또는 해제 정보)
     */
    public byte[] generatePolicePdf(
            String underpassName, String eventType, String reason,
            String managerName, String managerRegion,
            LocalDateTime eventAt, LocalDateTime transferAt,
            String memo) {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (PdfDocument pdf = new PdfDocument(new PdfWriter(baos));
             Document doc = new Document(pdf)) {

            doc.setMargins(MARGIN, MARGIN, MARGIN, MARGIN);
            PdfFont font = loadFont();

            addTitle(doc, font, "경찰청 통제정보 이관 보고서");
            addSubtitle(doc, font, "지하차도 " + eventType + " 신호조정 협조 요청");

            Table table = twoColTable();
            addRow(table, font, "지하차도", underpassName, false);
            addRow(table, font, "이벤트", eventType, true);
            addRow(table, font, "사유", reason != null ? reason : "-", false);
            addRow(table, font, "발생 일시", eventAt != null ? eventAt.format(DT_FMT) : "-", true);
            addRow(table, font, "이관 일시", transferAt.format(DT_FMT), false);
            addRow(table, font, "담당 관리자", managerName + " (" + managerRegion + ")", true);
            addRow(table, font, "비고", memo != null && !memo.isBlank() ? memo : "-", false);
            doc.add(table);

            addFooterNote(doc, font);
        } catch (Exception e) {
            throw new RuntimeException("경찰 이관 PDF 생성 실패", e);
        }
        return baos.toByteArray();
    }

    /**
     * 소방 이관 PDF (잔류차량 목록)
     */
    public byte[] generateFirePdf(
            String underpassName, List<String> carNums,
            String managerName, String managerRegion,
            LocalDateTime transferAt, String memo) {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (PdfDocument pdf = new PdfDocument(new PdfWriter(baos));
             Document doc = new Document(pdf)) {

            doc.setMargins(MARGIN, MARGIN, MARGIN, MARGIN);
            PdfFont font = loadFont();

            addTitle(doc, font, "소방서 잔류차량 구조 요청 보고서");
            addSubtitle(doc, font, "지하차도 내 잔류차량 현황 이관");

            Table infoTable = twoColTable();
            addRow(infoTable, font, "지하차도", underpassName, false);
            addRow(infoTable, font, "이관 일시", transferAt.format(DT_FMT), true);
            addRow(infoTable, font, "잔류차량 수", carNums.size() + "대", false);
            addRow(infoTable, font, "담당 관리자", managerName + " (" + managerRegion + ")", true);
            addRow(infoTable, font, "비고", memo != null && !memo.isBlank() ? memo : "-", false);
            doc.add(infoTable);

            // 잔류차량 목록 헤더
            doc.add(new Paragraph("\n").setFont(font).setFontSize(6));
            doc.add(new Paragraph("■ 잔류차량 번호 목록")
                    .setFont(font).setFontSize(12)
                    .setFontColor(DARK));

            Table carTable = new Table(UnitValue.createPercentArray(new float[]{1f, 9f}))
                    .setWidth(UnitValue.createPercentValue(100))
                    .setHorizontalAlignment(HorizontalAlignment.CENTER);

            carTable.addHeaderCell(headerCell("No.", font));
            carTable.addHeaderCell(headerCell("차량번호", font));

            if (carNums.isEmpty()) {
                Cell emptyCell = new Cell(1, 2)
                        .add(new Paragraph("잔류차량 없음").setFont(font).setFontSize(10)
                                .setTextAlignment(TextAlignment.CENTER).setFontColor(ColorConstants.GRAY))
                        .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 0.5f))
                        .setPadding(10f);
                carTable.addCell(emptyCell);
            } else {
                for (int i = 0; i < carNums.size(); i++) {
                    boolean alt = i % 2 != 0;
                    carTable.addCell(dataCell(String.valueOf(i + 1), font, alt, TextAlignment.CENTER));
                    carTable.addCell(dataCell(carNums.get(i), font, alt, TextAlignment.LEFT));
                }
            }
            doc.add(carTable);

            addFooterNote(doc, font);
        } catch (Exception e) {
            throw new RuntimeException("소방 이관 PDF 생성 실패", e);
        }
        return baos.toByteArray();
    }

    // ---- 내부 헬퍼 ----

    // 프로젝트 내장 한글 폰트 (OS에 설치된 폰트에 의존하지 않도록 classpath 리소스로 번들)
    // Noto Sans CJK KR 에서 한글 음절/자모 + 라틴/기호만 추출한 서브셋 (약 1.9MB)
    private static final String FONT_RESOURCE_PATH = "fonts/NotoSansKR.ttf";

    private PdfFont loadFont() throws Exception {
        try (InputStream is = new ClassPathResource(FONT_RESOURCE_PATH).getInputStream()) {
            byte[] fontBytes = is.readAllBytes();
            return PdfFontFactory.createFont(fontBytes, PdfEncodings.IDENTITY_H, EmbeddingStrategy.PREFER_EMBEDDED);
        } catch (Exception ignored) {
            // 내장 폰트 로드 실패 시 최후 수단 (한글은 깨지지만 PDF 생성 자체는 실패하지 않게)
            return PdfFontFactory.createFont(StandardFonts.HELVETICA);
        }
    }

    private void addTitle(Document doc, PdfFont font, String text) {
        doc.add(new Paragraph(text)
                .setFont(font).setFontSize(18)
                .setTextAlignment(TextAlignment.CENTER)
                .setFontColor(DARK)
                .setMarginBottom(4f));
    }

    private void addSubtitle(Document doc, PdfFont font, String text) {
        doc.add(new Paragraph(text)
                .setFont(font).setFontSize(11)
                .setTextAlignment(TextAlignment.CENTER)
                .setFontColor(MUTED)
                .setMarginBottom(16f));
    }

    private Table twoColTable() {
        return new Table(UnitValue.createPercentArray(COL_LABEL_CONTENT))
                .setWidth(UnitValue.createPercentValue(100))
                .setHorizontalAlignment(HorizontalAlignment.CENTER);
    }

    private void addRow(Table table, PdfFont font, String label, String value, boolean alt) {
        table.addCell(labelCell(label, font, alt));
        table.addCell(dataCell(value, font, alt, TextAlignment.LEFT));
    }

    private Cell labelCell(String text, PdfFont font, boolean alt) {
        return new Cell()
                .add(new Paragraph(text).setFont(font).setFontSize(10)
                        .setFontColor(LABEL_COLOR))
                .setBackgroundColor(alt ? ROW_ALT_BG : ColorConstants.WHITE)
                .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 0.5f))
                .setPaddingTop(8f).setPaddingBottom(8f).setPaddingLeft(12f);
    }

    private Cell dataCell(String text, PdfFont font, boolean alt, TextAlignment align) {
        return new Cell()
                .add(new Paragraph(text).setFont(font).setFontSize(10)
                        .setTextAlignment(align)
                        .setFontColor(DARK))
                .setBackgroundColor(alt ? ROW_ALT_BG : ColorConstants.WHITE)
                .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 0.5f))
                .setPaddingTop(8f).setPaddingBottom(8f).setPaddingLeft(12f);
    }

    private Cell headerCell(String text, PdfFont font) {
        return new Cell()
                .add(new Paragraph(text).setFont(font).setFontSize(10)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setFontColor(ColorConstants.WHITE))
                .setBackgroundColor(HEADER_BG)
                .setBorder(Border.NO_BORDER)
                .setPadding(8f);
    }

    private void addFooterNote(Document doc, PdfFont font) {
        doc.add(new Paragraph("\n").setFont(font).setFontSize(4));
        doc.add(new Paragraph("※ 본 문서는 PUF 지하차도 침수 예방 시스템에서 자동 생성된 이관 기록입니다.")
                .setFont(font).setFontSize(8)
                .setFontColor(new DeviceRgb(0x9C, 0xA3, 0xAF))
                .setTextAlignment(TextAlignment.CENTER));
    }
}