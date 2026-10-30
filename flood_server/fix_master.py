from pathlib import Path
from datetime import datetime
import shutil
import pandas as pd

DATA = Path(__file__).resolve().parent / "data"
SOURCE = DATA / "busan_underpass_master.csv"

for encoding in ("utf-8-sig", "cp949"):
    try:
        df = pd.read_csv(SOURCE, encoding=encoding)
        break
    except UnicodeDecodeError:
        continue

# 원본 백업
backup = DATA / (
    f"busan_underpass_master_backup_"
    f"{datetime.now():%Y%m%d_%H%M%S_%f}.csv"
)
shutil.copy2(SOURCE, backup)

# 원본 시설명 컬럼에서 이름 복구
names = df[
    ["시설물목록_시설물명", "부산시자료_시설명"]
].replace(r"^\s*$", pd.NA, regex=True)

restored = names.bfill(axis=1).iloc[:, 0]

# 시설명 없이 컬럼명만 잘못 들어간 행 제거
invalid = (
    restored.isna()
    & df["최근접해안선_시군구"].eq("underpass_depth_m")
    & df["거리계산_기준"].eq("깊이_출처")
)
removed = int(invalid.sum())
df = df.loc[~invalid].copy()
restored = restored.loc[df.index]

changed = (
    restored.notna()
    & df["시설물명_통합"].fillna("").ne(restored.fillna(""))
)
df.loc[restored.notna(), "시설물명_통합"] = restored.dropna()

df.to_csv(SOURCE, index=False, encoding="utf-8-sig")

print(f"이름 수정: {int(changed.sum())}행")
print(f"잘못된 행 제거: {removed}행")
print(f"남은 시설 행: {len(df)}행")
print(f"백업: {backup.name}")
print("저장 완료")