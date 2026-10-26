from pathlib import Path
import pandas as pd

source = (
    Path(__file__).resolve().parent
    / "data"
    / "flood_training_dataset.csv"
)

df = pd.read_csv(
    source,
    usecols=["event_id", "source_group_id", "risk_level"],
    encoding="utf-8-sig",
)

risk = df[df["risk_level"] == "위험"]

print("Risk event count:", risk["event_id"].nunique())
print(
    risk.groupby("source_group_id").agg(
        risk_rows=("event_id", "size"),
        risk_events=("event_id", "nunique"),
    ).to_string()
)