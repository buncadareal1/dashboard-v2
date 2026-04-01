import csv
import os
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")


def fetch_public_sheet_csv(file_name: str) -> list[dict]:
    """Đọc dữ liệu từ file CSV — hỗ trợ nhiều format khác nhau."""
    # Chặn path traversal
    if os.sep in file_name or "/" in file_name or "\\" in file_name or ".." in file_name:
        raise ValueError("Tên file không hợp lệ")

    upload_dir = os.path.realpath(UPLOAD_DIR)
    file_path = os.path.realpath(os.path.join(upload_dir, file_name))

    if not file_path.startswith(upload_dir + os.sep):
        raise ValueError("Không được phép truy cập ngoài thư mục uploads")

    if not os.path.exists(file_path):
        raise ValueError(f"Không tìm thấy file dataset: {file_name}")

    max_size = int(os.getenv("MAX_UPLOAD_SIZE_MB", 10)) * 1024 * 1024
    if os.path.getsize(file_path) > max_size:
        raise ValueError(f"File vượt quá giới hạn {max_size // (1024*1024)}MB")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            csv_data = list(csv.DictReader(f))

        if not csv_data:
            return []

        headers = set(csv_data[0].keys())

        # Detect format: Facebook Ads raw export (có ad_id, campaign_id, spent)
        if 'campaign_id' in headers and 'spent' in headers:
            return _parse_facebook_raw(csv_data)

        # Format chuẩn dashboard
        return _parse_standard(csv_data)

    except csv.Error as e:
        raise ValueError(f"Lỗi đọc CSV {file_name}: {str(e)}")


def _parse_standard(rows: list[dict]) -> list[dict]:
    """Parse format chuẩn: Campaign Name, Spend, Status, Impressions, Clicks, Engagements, Purchases"""
    results = []
    for row in rows:
        name = row.get("Campaign Name") or row.get("campaign_name") or row.get("name") or "Không rõ"
        spend = _safe_float(row.get("Spend") or row.get("spend") or "0")
        status = (row.get("Status") or row.get("status") or "ACTIVE").upper()
        imp = _safe_int(row, ["Impressions", "impressions", "imp"])
        clicks = _safe_int(row, ["Clicks", "clicks"])
        engagements = _safe_int(row, ["Engagements", "engagements", "Shares", "Comments"])
        purchases = _safe_int(row, ["Purchases", "purchases", "buy", "Buy", "total_conversion"])

        results.append({
            "name": name,
            "spend": spend,
            "status": status,
            "imp": imp,
            "clicks": clicks,
            "engagements": engagements,
            "purchases": purchases
        })
    return results


def _parse_facebook_raw(rows: list[dict]) -> list[dict]:
    """
    Parse format Facebook Ads raw export:
    ad_id, reporting_start, reporting_end, campaign_id, fb_campaign_id,
    age, gender, interest1-3, impressions, clicks, spent, total_conversion, approved_conversion

    Gom nhóm theo campaign_id, tổng hợp metrics.
    """
    campaigns = defaultdict(lambda: {
        "spend": 0, "imp": 0, "clicks": 0, "engagements": 0,
        "purchases": 0, "approved": 0, "ads_count": 0,
        "ages": set(), "genders": set()
    })

    for row in rows:
        cid = row.get("campaign_id") or row.get("fb_campaign_id") or "unknown"

        # Bỏ qua dòng bị lệch cột: campaign_id chứa giá trị age (30-34, 35-39...)
        if "-" in str(cid) and not str(cid).isdigit():
            continue

        data = campaigns[cid]

        data["spend"] += _safe_float(row.get("spent") or "0")
        data["imp"] += _safe_int(row, ["impressions"])
        data["clicks"] += _safe_int(row, ["clicks"])
        data["purchases"] += _safe_int(row, ["total_conversion"])
        data["approved"] += _safe_int(row, ["approved_conversion"])
        data["ads_count"] += 1

        age = row.get("age", "")
        gender = row.get("gender", "")
        if age:
            data["ages"].add(age)
        if gender:
            data["genders"].add(gender)

    results = []
    for cid, data in campaigns.items():
        # Tính engagements ước lượng = clicks * 2.5 (vì raw data không có cột riêng)
        engagements = data["engagements"] or int(data["clicks"] * 2.5)

        # Tạo tên campaign mô tả
        age_range = ", ".join(sorted(data["ages"])) if data["ages"] else "All"
        gender_label = ", ".join(sorted(data["genders"])) if data["genders"] else "All"

        results.append({
            "name": f"Campaign #{cid} ({age_range} | {gender_label})",
            "spend": round(data["spend"], 2),
            "status": "ACTIVE",
            "imp": data["imp"],
            "clicks": data["clicks"],
            "engagements": engagements,
            "purchases": data["purchases"]
        })

    # Sắp xếp theo spend giảm dần
    results.sort(key=lambda x: x["spend"], reverse=True)
    return results


def _safe_float(value) -> float:
    try:
        return float(str(value).replace(",", ""))
    except (ValueError, TypeError):
        return 0.0


def _safe_int(row: dict, keys: list) -> int:
    for k in keys:
        if k in row and str(row[k]).strip():
            try:
                return int(float(str(row[k]).replace(",", "")))
            except (ValueError, TypeError):
                pass
    return 0
