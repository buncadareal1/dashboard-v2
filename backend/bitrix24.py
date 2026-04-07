"""
Module tích hợp Bitrix24 CRM - SmartLand/SmartRealtors
Kéo leads từ Facebook Ads, map trạng thái chi tiết, thống kê theo campaign
"""

import logging
from collections import defaultdict

import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("smartland.bitrix24")

# Map STATUS_ID Bitrix24 → Dashboard
STATUS_MAP = {
    "NEW": "MỚI",
    "IN_PROCESS": "ĐANG TƯ VẤN",
    "PROCESSED": "ĐANG TƯ VẤN",
    "CONVERTED": "CHỐT ĐƠN",
    "JUNK": "THẤT BẠI",
}

# Map Old Status (UF_CRM_1683781220) → trạng thái chi tiết
OLD_STATUS_MAP = {
    "4301": "New (10p)",
    "4331": "Đang Chăm (6h)",
    "4319": "MKT Cũ",
    "4323": "Không SĐT",
    "4325": "Thuê bao KLL",
    "4327": "Không Bắt Máy",
    "4329": "Chào dự án khác",
    "4333": "Spam Lead",
    "4335": "Môi giới",
    "4339": "Đã mua",
    "4321": "Sale phone",
    "4407": "F1 (QT dự án)",
    "4847": "Data thô",
    "4337": "Flash (Chuyển sale)",
}

# Map Loại Lead (UF_CRM_1693291879)
LEAD_TYPE_MAP = {
    "4633": "MKT cũ",
    "4831": "MKT mới",
    "4833": "Data Công ty",
}


def build_vietnamese_name(lead_data: dict, fallback: str = "Không rõ") -> str:
    """
    Lấy tên đầy đủ từ lead Bitrix24, ưu tiên trường custom từ Facebook Lead Form.

    Thứ tự ưu tiên:
      1. UF_CRM_FACEBOOK_FULLNAME - trường custom "Họ và tên đầy đủ" từ Facebook form
      2. NAME + SECOND_NAME + LAST_NAME - ghép từ các trường mặc định
      3. TITLE - tên tự sinh bởi Bitrix24
    """
    # 1. Ưu tiên trường custom chứa họ tên đầy đủ từ Facebook form
    fullname = (lead_data.get("UF_CRM_FACEBOOK_FULLNAME") or "").strip()
    if fullname:
        return fullname

    # 2. Ghép từ các trường mặc định: NAME + SECOND_NAME + LAST_NAME
    first_name = (lead_data.get("NAME") or "").strip()
    second_name = (lead_data.get("SECOND_NAME") or "").strip()
    last_name = (lead_data.get("LAST_NAME") or "").strip()

    parts = [p for p in (first_name, second_name, last_name) if p]
    name = " ".join(parts)

    if not name or name in ("None", "None None"):
        name = (lead_data.get("TITLE") or "").strip() or fallback

    return name


# Trường cần select từ Bitrix24
SELECT_FIELDS = [
    "ID",
    "TITLE",
    "NAME",
    "SECOND_NAME",
    "LAST_NAME",
    "STATUS_ID",
    "STATUS_SEMANTIC_ID",
    "SOURCE_ID",
    "SOURCE_DESCRIPTION",
    "DATE_CREATE",
    "DATE_CLOSED",
    "ASSIGNED_BY_ID",
    "UTM_SOURCE",
    "UTM_CAMPAIGN",
    "UTM_MEDIUM",
    "UF_CRM_1693291879",  # Loại Lead
    "UF_CRM_1683781220",  # Old Status (chi tiết)
    "UF_CRM_1688789753",  # Nhân viên phụ trách (tên)
    "UF_CRM_1714923195418",  # Facebook Ad ID
    "UF_CRM_FACEBOOK_FULLNAME",  # Họ tên đầy đủ từ Facebook Lead Form (custom field)
]


def _get_all_leads(webhook_url: str, max_leads: int = 50000) -> list:
    """Kéo toàn bộ leads từ Bitrix24 (tự phân trang)."""
    webhook_url = webhook_url.rstrip("/")
    all_leads = []
    start = 0

    while True:
        params = {
            "select[]": SELECT_FIELDS,
            "order[ID]": "DESC",
            "start": start,
        }

        try:
            r = requests.get(f"{webhook_url}/crm.lead.list", params=params, timeout=15)
            r.raise_for_status()
            data = r.json()
        except requests.RequestException as e:
            logger.error(f"Bitrix24 API error: {e}")
            raise ValueError(f"Không thể kết nối Bitrix24: {str(e)}")

        if "error" in data:
            raise ValueError(
                f"Bitrix24 lỗi: {data.get('error_description', data['error'])}"
            )

        results = data.get("result", [])
        all_leads.extend(results)

        next_start = data.get("next")
        if not next_start or len(all_leads) >= max_leads:
            break
        start = next_start

    return all_leads


def _get_user_names(webhook_url: str, user_ids: list) -> dict:
    """Lấy tên nhân viên từ Bitrix24 theo danh sách user ID."""
    if not user_ids:
        return {}

    webhook_url = webhook_url.rstrip("/")
    user_map = {}
    unique_ids = list(set(uid for uid in user_ids if uid))

    try:
        # Bitrix24 cho phép lấy nhiều user 1 lần
        params = {}
        for i, uid in enumerate(unique_ids[:50]):  # Max 50 users
            params[f"ID[{i}]"] = uid

        r = requests.get(f"{webhook_url}/user.get", params=params, timeout=15)
        r.raise_for_status()
        data = r.json()

        for u in data.get("result", []):
            uid = str(u.get("ID", ""))
            name = f"{u.get('NAME', '')} {u.get('LAST_NAME', '')}".strip()
            if not name:
                email = u.get("EMAIL", "")
                name = email.split("@")[0] if email else f"NV #{uid}"
            user_map[uid] = name
    except Exception as e:
        logger.warning(f"Không thể lấy danh sách nhân viên: {e}")

    return user_map


def fetch_facebook_leads(webhook_url: str) -> dict:
    """
    Kéo leads từ Bitrix24, map trạng thái chi tiết, thống kê theo campaign.
    """
    if not webhook_url:
        raise ValueError("Chưa cấu hình Bitrix24 Webhook URL")

    raw_leads = _get_all_leads(webhook_url)

    # Lấy tên nhân viên từ ASSIGNED_BY_ID
    assigned_ids = [
        str(l.get("ASSIGNED_BY_ID", "")) for l in raw_leads if l.get("ASSIGNED_BY_ID")
    ]
    user_names = _get_user_names(webhook_url, assigned_ids)

    leads = []
    campaign_stats = defaultdict(
        lambda: {"total": 0, "moi": 0, "dang_tu_van": 0, "chot_don": 0, "that_bai": 0}
    )

    for l in raw_leads:
        # Tên KH - ghép theo thứ tự Việt Nam: Họ + Tên đệm + Tên
        name = build_vietnamese_name(l)

        # Trạng thái chính
        status_raw = l.get("STATUS_ID", "NEW")
        semantic = l.get("STATUS_SEMANTIC_ID", "P")  # S=success, F=fail, P=processing
        if semantic == "S":
            status = "CHỐT ĐƠN"
        elif semantic == "F":
            status = "THẤT BẠI"
        else:
            status = STATUS_MAP.get(status_raw, "MỚI")

        # Trạng thái chi tiết (Old Status)
        old_status_id = str(l.get("UF_CRM_1683781220", "") or "")
        old_status = OLD_STATUS_MAP.get(old_status_id, "")

        # Loại Lead
        lead_type_id = str(l.get("UF_CRM_1693291879", "") or "")
        lead_type = LEAD_TYPE_MAP.get(lead_type_id, "")

        # Nhân viên phụ trách: ưu tiên custom field → fallback user.get từ ASSIGNED_BY_ID
        resp_person = l.get("UF_CRM_1688789753", "") or ""
        if not resp_person:
            assigned_id = str(l.get("ASSIGNED_BY_ID", "") or "")
            resp_person = user_names.get(assigned_id, "")

        # Campaign: lấy từ UTM hoặc TITLE (format: "Tên - Dự án")
        campaign = l.get("UTM_CAMPAIGN") or ""
        if not campaign:
            title = l.get("TITLE", "")
            if " - " in title:
                campaign = title.split(" - ", 1)[1].strip()
            else:
                campaign = title or "Không xác định"

        # Facebook Ad ID
        fb_ad_id = (
            l.get("UF_CRM_1714923195418", "") or l.get("SOURCE_DESCRIPTION", "") or ""
        )

        lead_data = {
            "id": l["ID"],
            "name": name,
            "status": status,
            "status_raw": status_raw,
            "old_status": old_status,
            "lead_type": lead_type,
            "campaign": campaign,
            "resp_person": resp_person,
            "fb_ad_id": fb_ad_id,
            "utm_source": l.get("UTM_SOURCE", ""),
            "utm_campaign": l.get("UTM_CAMPAIGN", ""),
            "source_id": l.get("SOURCE_ID", ""),
            "created_at": l.get("DATE_CREATE", ""),
            "closed_at": l.get("DATE_CLOSED", ""),
        }
        leads.append(lead_data)

        # Thống kê theo campaign
        cs = campaign_stats[campaign]
        cs["total"] += 1
        if status == "MỚI":
            cs["moi"] += 1
        elif status == "ĐANG TƯ VẤN":
            cs["dang_tu_van"] += 1
        elif status == "CHỐT ĐƠN":
            cs["chot_don"] += 1
        elif status == "THẤT BẠI":
            cs["that_bai"] += 1

    # Campaign summary
    campaign_summary = []
    for camp_name, stats in campaign_stats.items():
        close_rate = (
            (stats["chot_don"] / stats["total"] * 100) if stats["total"] > 0 else 0
        )
        campaign_summary.append(
            {
                "campaign": camp_name,
                "total": stats["total"],
                "moi": stats["moi"],
                "dang_tu_van": stats["dang_tu_van"],
                "chot_don": stats["chot_don"],
                "that_bai": stats["that_bai"],
                "close_rate": round(close_rate, 1),
            }
        )
    campaign_summary.sort(key=lambda x: x["total"], reverse=True)

    # Tổng đơn hàng (chốt đơn)
    total_orders = sum(1 for l in leads if l["status"] == "CHỐT ĐƠN")

    return {
        "leads": leads,
        "total": len(leads),
        "total_orders": total_orders,
        "campaign_summary": campaign_summary,
    }


def test_connection(webhook_url: str) -> dict:
    """Test kết nối webhook Bitrix24."""
    if not webhook_url:
        raise ValueError("URL webhook trống")

    webhook_url = webhook_url.rstrip("/")
    try:
        r = requests.get(
            f"{webhook_url}/crm.lead.list",
            params={"select[]": ["ID"], "start": 0},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()

        if "error" in data:
            return {
                "success": False,
                "error": data.get("error_description", data["error"]),
            }

        total = data.get("total", 0)
        return {
            "success": True,
            "message": f"Kết nối thành công. Có {total} leads trong CRM.",
        }
    except requests.RequestException as e:
        return {"success": False, "error": str(e)}
