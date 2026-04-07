"""
Module AI phân tích chiến dịch marketing
Hỗ trợ 3 provider: Claude (Anthropic), GPT (OpenAI), Gemini (Google)
Fallback: rule-based khi chưa có API key
"""
import os
import json
import logging
import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("smartland.ai")

# Config
AI_PROVIDER = os.getenv("AI_PROVIDER", "auto")  # auto, claude, openai, gemini
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
AVG_ORDER_VALUE = int(os.getenv("AVG_ORDER_VALUE", 50000000))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

SYSTEM_PROMPT = """Bạn là chuyên gia phân tích quảng cáo Facebook Ads cho công ty bất động sản Việt Nam.
Nhiệm vụ: Phân tích dữ liệu chiến dịch và đưa ra nhận xét ngắn gọn, thực tế, bằng tiếng Việt.

Quy tắc:
- Trả lời ngắn gọn, mỗi chiến dịch 1-2 câu
- Chỉ ra vấn đề cụ thể + gợi ý hành động rõ ràng
- CTR tốt >= 2%, CPL tốt < 15K, ROAS tốt >= 3x
- Dùng emoji phù hợp: ✅ tốt, ⚠️ cần chú ý, 🔴 cần xử lý ngay
- Kết thúc bằng 1 đoạn tổng kết ngắn cho toàn bộ campaigns
- KHÔNG dùng markdown, chỉ dùng text thuần"""


def _build_campaign_summary(campaigns: list) -> str:
    """Tạo bản tóm tắt dữ liệu campaigns để gửi cho AI."""
    if not campaigns:
        return "Không có dữ liệu chiến dịch nào."

    lines = ["DỮ LIỆU CHIẾN DỊCH FACEBOOK ADS:\n"]
    total_spend = 0
    total_purchases = 0

    for i, c in enumerate(campaigns, 1):
        spend = c.get("spend", 0)
        imp = c.get("imp", 0) or c.get("impressions", 0)
        clicks = c.get("clicks", 0)
        eng = c.get("engagements", 0)
        pur = c.get("purchases", 0)
        ctr = (clicks / imp * 100) if imp > 0 else 0
        cpl = (spend / pur) if pur > 0 else 0
        roas = (pur * AVG_ORDER_VALUE / spend) if spend > 0 else 0

        total_spend += spend
        total_purchases += pur

        lines.append(f"{i}. {c.get('name', 'N/A')}")
        lines.append(f"   Chi tiêu: {spend:,.0f}đ | Hiển thị: {imp:,} | Click: {clicks:,} | Tương tác: {eng:,} | Đơn hàng: {pur}")
        lines.append(f"   CTR: {ctr:.2f}% | CPL: {cpl:,.0f}đ | ROAS: {roas:.1f}x | Trạng thái: {c.get('status', 'N/A')}")
        lines.append("")

    total_roas = (total_purchases * AVG_ORDER_VALUE / total_spend) if total_spend > 0 else 0
    avg_cpl = (total_spend / total_purchases) if total_purchases > 0 else 0
    lines.append(f"TỔNG: Chi tiêu {total_spend:,.0f}đ | Đơn hàng: {total_purchases} | ROAS: {total_roas:.1f}x | CPL TB: {avg_cpl:,.0f}đ")

    return "\n".join(lines)


def _call_claude(prompt: str) -> str:
    """Gọi Claude API (Anthropic)."""
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        },
        json={
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1024,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": prompt}]
        },
        timeout=30
    )
    r.raise_for_status()
    data = r.json()
    return data["content"][0]["text"]


def _call_openai(prompt: str) -> str:
    """Gọi OpenAI GPT API."""
    r = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 1024
        },
        timeout=30
    )
    r.raise_for_status()
    data = r.json()
    return data["choices"][0]["message"]["content"]


def _call_gemini(prompt: str) -> str:
    """Gọi Google Gemini API (có retry khi bị rate limit)."""
    import time
    models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]

    for model in models:
        for attempt in range(3):
            try:
                r = requests.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}",
                    headers={"Content-Type": "application/json"},
                    json={
                        "contents": [{"parts": [{"text": f"{SYSTEM_PROMPT}\n\n{prompt}"}]}],
                        "generationConfig": {"maxOutputTokens": 1024}
                    },
                    timeout=30
                )
                if r.status_code == 429:
                    logger.warning(f"Gemini rate limit ({model}), retry {attempt+1}/3...")
                    time.sleep(2 * (attempt + 1))
                    continue
                r.raise_for_status()
                data = r.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except requests.HTTPError as e:
                if "404" in str(e):
                    break  # Model không tồn tại, thử model khác
                if attempt == 2:
                    raise
                time.sleep(2)

    raise ValueError("Không thể gọi Gemini API sau nhiều lần thử")


def _rule_based_analysis(campaigns: list) -> str:
    """Phân tích rule-based khi chưa có AI API key."""
    if not campaigns:
        return "Chưa có dữ liệu chiến dịch để phân tích."

    insights = []
    total_spend = 0
    total_pur = 0
    best_camp = None
    worst_camp = None
    best_roas = 0
    worst_roas = 999999

    for c in campaigns:
        spend = c.get("spend", 0)
        imp = c.get("imp", 0) or c.get("impressions", 0)
        clicks = c.get("clicks", 0)
        pur = c.get("purchases", 0)
        name = c.get("name", "N/A")
        ctr = (clicks / imp * 100) if imp > 0 else 0
        cpl = (spend / pur) if pur > 0 else 0
        roas = (pur * AVG_ORDER_VALUE / spend) if spend > 0 else 0

        total_spend += spend
        total_pur += pur

        if roas > best_roas:
            best_roas = roas
            best_camp = name
        if roas < worst_roas and spend > 0:
            worst_roas = roas
            worst_camp = name

        # Phân tích từng chiến dịch
        issues = []
        if ctr < 1:
            issues.append("CTR rất thấp, cần thay đổi nội dung quảng cáo")
        elif ctr < 2:
            issues.append("CTR dưới trung bình")

        if cpl > 20 and pur > 0:
            issues.append(f"CPL {cpl:,.0f}đ quá cao, cân nhắc tạm dừng")
        elif cpl > 15 and pur > 0:
            issues.append(f"CPL {cpl:,.0f}đ vượt mục tiêu 15K")

        if roas < 1 and spend > 0:
            issues.append("đang lỗ (ROAS < 1x)")
        elif roas >= 3:
            issues.append(f"hiệu quả tốt (ROAS {roas:.1f}x)")

        if issues:
            icon = "✅" if roas >= 3 else "⚠️" if roas >= 1 else "🔴"
            insights.append(f"{icon} {name}: {', '.join(issues)}")

    # Tổng kết
    total_roas = (total_pur * AVG_ORDER_VALUE / total_spend) if total_spend > 0 else 0
    avg_cpl = (total_spend / total_pur) if total_pur > 0 else 0

    summary = f"\n📊 Tổng kết: {len(campaigns)} chiến dịch, chi tiêu {total_spend:,.0f}đ, {total_pur} đơn hàng, ROAS {total_roas:.1f}x, CPL trung bình {avg_cpl:,.0f}đ."

    if best_camp:
        summary += f" Chiến dịch tốt nhất: {best_camp} (ROAS {best_roas:.1f}x)."
    if worst_camp and worst_roas < 2:
        summary += f" Cần xem lại: {worst_camp} (ROAS {worst_roas:.1f}x)."

    return "\n".join(insights) + summary


def _detect_provider() -> str:
    """Tự động detect provider nào có API key."""
    if AI_PROVIDER != "auto":
        return AI_PROVIDER
    if ANTHROPIC_API_KEY:
        return "claude"
    if OPENAI_API_KEY:
        return "openai"
    if GEMINI_API_KEY:
        return "gemini"
    return "rule_based"


def analyze_campaigns(campaigns: list) -> dict:
    """
    Phân tích chiến dịch marketing.
    Tự động chọn AI provider hoặc fallback rule-based.
    Returns: { "provider": str, "analysis": str }
    """
    provider = _detect_provider()
    prompt = _build_campaign_summary(campaigns)

    logger.info(f"AI Analysis: provider={provider}, campaigns={len(campaigns)}")

    if provider == "rule_based":
        return {
            "provider": "rule_based",
            "analysis": _rule_based_analysis(campaigns)
        }

    try:
        if provider == "claude":
            result = _call_claude(prompt)
        elif provider == "openai":
            result = _call_openai(prompt)
        elif provider == "gemini":
            result = _call_gemini(prompt)
        else:
            result = _rule_based_analysis(campaigns)
            provider = "rule_based"

        return {"provider": provider, "analysis": result}

    except Exception as e:
        logger.error(f"AI API error ({provider}): {e}")
        # Fallback sang rule-based nếu AI lỗi
        return {
            "provider": "rule_based",
            "analysis": _rule_based_analysis(campaigns),
            "error": f"AI ({provider}) không phản hồi, đang dùng phân tích tự động."
        }
