"""Import budget report CSV into the database.

Usage:
    cd backend
    python -m scripts.import_budget_report <csv_file> <campaign_name>
"""
import csv
import sys
from datetime import datetime

from app.database import SessionLocal
from app.models.budget_report import BudgetReport


def parse_currency(value: str) -> float:
    """Parse Vietnamese currency string like '2.270.065 đ' to float."""
    if not value or not value.strip():
        return 0.0
    cleaned = value.replace(" đ", "").replace("đ", "").replace(".", "").strip()
    if not cleaned:
        return 0.0
    return float(cleaned)


def parse_percentage(value: str) -> float | None:
    """Parse percentage string like '50%' to float 0.50."""
    if not value or not value.strip():
        return None
    cleaned = value.replace("%", "").strip()
    if not cleaned:
        return None
    return float(cleaned) / 100.0


def parse_date(value: str) -> datetime | None:
    """Parse date string DD/MM/YYYY."""
    if not value or not value.strip():
        return None
    try:
        return datetime.strptime(value.strip(), "%d/%m/%Y").date()
    except ValueError:
        return None


def import_csv(csv_path: str, campaign_name: str) -> None:
    db = SessionLocal()
    inserted = 0
    skipped = 0

    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader)  # Skip header row

            for row in reader:
                if len(row) < 9:
                    continue

                stt = row[0].strip()
                if not stt or not stt.isdigit():
                    continue

                date = parse_date(row[1])
                if date is None:
                    continue

                total_leads = int(row[3]) if row[3].strip() else 0
                f1_leads = int(row[4]) if row[4].strip() else 0

                # Skip rows with no data at all
                if total_leads == 0 and f1_leads == 0:
                    skipped += 1
                    continue

                report = BudgetReport(
                    campaign_name=campaign_name,
                    date=date,
                    spend=parse_currency(row[2]),
                    total_leads=total_leads,
                    f1_leads=f1_leads,
                    nurturing_leads=int(row[5]) if row[5].strip() else 0,
                    cpl=parse_currency(row[6]),
                    cost_per_f1=parse_currency(row[7]),
                    qualify_rate=parse_percentage(row[8]),
                )

                # Upsert: check if record exists
                existing = (
                    db.query(BudgetReport)
                    .filter_by(campaign_name=campaign_name, date=date)
                    .first()
                )
                if existing:
                    existing.spend = report.spend
                    existing.total_leads = report.total_leads
                    existing.f1_leads = report.f1_leads
                    existing.nurturing_leads = report.nurturing_leads
                    existing.cpl = report.cpl
                    existing.cost_per_f1 = report.cost_per_f1
                    existing.qualify_rate = report.qualify_rate
                else:
                    db.add(report)
                inserted += 1

        db.commit()
        print(f"Done! {inserted} records imported/updated, {skipped} skipped.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m scripts.import_budget_report <csv_file> [campaign_name]")
        sys.exit(1)

    csv_file = sys.argv[1]
    campaign = sys.argv[2] if len(sys.argv) > 2 else "Thấp Tầng Sun Hà Nam - Ái Linh"
    print(f"Importing '{csv_file}' as campaign '{campaign}'...")
    import_csv(csv_file, campaign)
