"""분 단위 원본 CSV → 10분 평균 데이터 + 고장 시각 목록"""
import pandas as pd

from pump_config import DATA_DIR, DROP_SENSORS, RAW_CSV, RESAMPLE

STATUS_CODE = {"NORMAL": 0, "RECOVERING": 1, "BROKEN": 2}


def load_raw(path):
    df = pd.read_csv(path, parse_dates=["timestamp"])
    df = df.drop(columns=[c for c in df.columns if c.startswith("Unnamed")])
    return df.set_index("timestamp").sort_index()


def resample(raw, sensors=None):
    """센서 결측 보간 후 10분 평균. status는 구간 내 최악 상태(BROKEN > RECOVERING > NORMAL)."""
    if sensors is None:
        sensors = [c for c in raw.columns if c.startswith("sensor_") and c not in DROP_SENSORS]
    x = raw[sensors].interpolate(method="time", limit_direction="both")
    out = x.resample(RESAMPLE).mean()
    if "machine_status" in raw:
        out["status"] = raw["machine_status"].map(STATUS_CODE).resample(RESAMPLE).max()
    return out, sensors


def failure_times(raw):
    return raw.index[raw["machine_status"] == "BROKEN"].tolist()


if __name__ == "__main__":
    raw = load_raw(RAW_CSV)
    data, sensors = resample(raw)
    failures = failure_times(raw)

    DATA_DIR.mkdir(exist_ok=True)
    pd.to_pickle({"data": data, "sensors": sensors, "failures": failures}, DATA_DIR / "pump_10min.pkl")
    print(f"rows: {len(raw):,} → {len(data):,} ({RESAMPLE}), sensors: {len(sensors)}")
    print("failures:", [str(t) for t in failures])
