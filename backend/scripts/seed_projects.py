"""
Seed 6 real estate projects matching Readdy preview + frontend mock.

Run inside backend container:
    docker compose exec backend python scripts/seed_projects.py

Idempotent: skips projects that already exist by slug.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models import Project

SEED_PROJECTS = [
    {
        "slug": "vinhomes-grand-park",
        "name": "Vinhomes Grand Park",
        "location": "Quận 9, TP.HCM",
        "status": "running",
        "total_units": 250,
        "sold_units": 87,
        "total_budget": 850_000_000,
        "total_revenue": 12_450_000_000,
        "channels": "facebook,google",
    },
    {
        "slug": "masteri-waterfront",
        "name": "Masteri Waterfront",
        "location": "Quận 2, TP.HCM",
        "status": "running",
        "total_units": 200,
        "sold_units": 64,
        "total_budget": 620_000_000,
        "total_revenue": 8_920_000_000,
        "channels": "tiktok,facebook",
    },
    {
        "slug": "metropole-thu-thiem",
        "name": "The Metropole Thu Thiem",
        "location": "Thủ Thiêm, TP.HCM",
        "status": "warning",
        "total_units": 180,
        "sold_units": 52,
        "total_budget": 480_000_000,
        "total_revenue": 7_560_000_000,
        "channels": "google,youtube",
    },
    {
        "slug": "eco-green-saigon",
        "name": "Eco Green Saigon",
        "location": "Quận 7, TP.HCM",
        "status": "running",
        "total_units": 220,
        "sold_units": 48,
        "total_budget": 320_000_000,
        "total_revenue": 5_680_000_000,
        "channels": "facebook",
    },
    {
        "slug": "sunshine-city",
        "name": "Sunshine City",
        "location": "Hà Nội",
        "status": "paused",
        "total_units": 160,
        "sold_units": 42,
        "total_budget": 280_000_000,
        "total_revenue": 4_850_000_000,
        "channels": "zalo,facebook",
    },
    {
        "slug": "manor-central-park",
        "name": "The Manor Central Park",
        "location": "Quận Bình Thạnh, TP.HCM",
        "status": "running",
        "total_units": 300,
        "sold_units": 58,
        "total_budget": 450_000_000,
        "total_revenue": 7_120_000_000,
        "channels": "google,facebook",
    },
]


def main() -> None:
    db = SessionLocal()
    created = 0
    skipped = 0
    try:
        for data in SEED_PROJECTS:
            exists = db.query(Project).filter(Project.slug == data["slug"]).first()
            if exists:
                skipped += 1
                print(f"  ↳ skip: {data['slug']} (already exists)")
                continue
            db.add(Project(**data))
            created += 1
            print(f"  ✓ created: {data['slug']}")
        db.commit()
        print(f"\nDone. created={created}, skipped={skipped}, total={len(SEED_PROJECTS)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
