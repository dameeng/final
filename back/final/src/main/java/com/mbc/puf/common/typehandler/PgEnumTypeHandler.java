package com.mbc.puf.common.typehandler;

import com.mbc.puf.common.enums.DbEnum;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;

/**
 * PostgreSQL native ENUM ↔ Java enum 변환 핸들러.
 * - 저장: Types.OTHER 로 보내서 PG가 enum 타입으로 해석하게 함 (varchar 불일치 에러 방지)
 * - DbEnum 구현 enum(RiskLevel)은 getDbValue(), 나머지는 name() 사용
 */
public class PgEnumTypeHandler<E extends Enum<E>> extends BaseTypeHandler<E> {

    private final Class<E> type;

    // MyBatis가 default-enum-type-handler 로 인스턴스를 만들 때 이 생성자를 호출한다
    public PgEnumTypeHandler(Class<E> type) {
        if (type == null) {
            throw new IllegalArgumentException("type must not be null");
        }
        this.type = type;
    }

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, E parameter, JdbcType jdbcType)
            throws SQLException {
        ps.setObject(i, toDbValue(parameter), Types.OTHER);
    }

    @Override
    public E getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return toEnum(rs.getString(columnName));
    }

    @Override
    public E getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return toEnum(rs.getString(columnIndex));
    }

    @Override
    public E getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return toEnum(cs.getString(columnIndex));
    }

    private String toDbValue(E e) {
        return (e instanceof DbEnum dbEnum) ? dbEnum.getDbValue() : e.name();
    }

    private E toEnum(String dbValue) {
        if (dbValue == null) {
            return null;
        }
        for (E e : type.getEnumConstants()) {
            if (toDbValue(e).equals(dbValue)) {
                return e;
            }
        }
        throw new IllegalArgumentException(
                "Unknown DB enum value '" + dbValue + "' for " + type.getSimpleName());
    }
}
