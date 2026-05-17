import feedparser
import requests
from datetime import datetime, timezone
from typing import Optional


# Major listed food companies (証券コード: 会社名)
FOOD_COMPANIES = {
    "2702": "日本マクドナルドHD",
    "3197": "すかいらーくHD",
    "7550": "ゼンショーHD",
    "9861": "吉野家HD",
    "7581": "サイゼリヤ",
    "2695": "くら寿司",
    "3563": "FOOD & LIFE COMPANIES",
    "3543": "コメダHD",
    "3053": "ペッパーフードサービス",
    "7611": "ハイデイ日高",
    "9887": "松屋フーズHD",
}

TDNET_RSS_URL = "https://www.release.tdnet.info/inbs/I_rssfeed.rss"
REQUEST_TIMEOUT = 10

# Keywords used to filter entries whose company name is not directly matched
# by a security code embedded in the feed item.
FOOD_KEYWORDS = [
    "フード", "food", "Food", "FOOD",
    "飲食", "外食", "レストラン", "フランチャイズ",
    "マクドナルド", "すかいらーく", "ゼンショー", "吉野家",
    "サイゼリヤ", "くら寿司", "スシロー", "コメダ",
    "ペッパー", "ハイデイ", "松屋",
]

# Disclosure type mapping for common TDnet category strings
DISCLOSURE_TYPE_MAP = {
    "決算短信": "決算",
    "有価証券報告書": "有報",
    "四半期報告書": "四半期",
    "適時開示": "適時開示",
    "株主優待": "株主優待",
    "配当": "配当",
    "業績予想": "業績予想",
    "中期経営": "中計",
    "IR": "IR",
}


def _parse_published_at(entry: feedparser.FeedParserDict) -> Optional[str]:
    """Extract and normalise the publication timestamp from a feed entry."""
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        try:
            dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            return dt.isoformat()
        except (TypeError, ValueError):
            pass

    raw = getattr(entry, "published", None) or getattr(entry, "updated", None)
    return raw if raw else None


def _infer_disclosure_type(title: str) -> str:
    """Guess the disclosure type from the entry title."""
    for keyword, label in DISCLOSURE_TYPE_MAP.items():
        if keyword in title:
            return label
    return "適時開示"


def _match_company(entry: feedparser.FeedParserDict) -> Optional[tuple[str, str]]:
    """Return (company_name, security_code) if the entry belongs to a food company.

    TDnet feed entries typically embed the security code and company name in
    the title or description in one of these forms:
        「7550　ゼンショーHD」 …
        「[7550] ゼンショーHD」 …
    We first try a direct code match; then fall back to keyword matching against
    the full text of the entry.
    """
    title = getattr(entry, "title", "") or ""
    description = getattr(entry, "description", "") or getattr(entry, "summary", "") or ""
    full_text = title + " " + description

    # Direct security code match
    for code, name in FOOD_COMPANIES.items():
        if code in full_text:
            return name, code

    # Company name match
    for code, name in FOOD_COMPANIES.items():
        # Try matching the core brand string (first 4+ chars often unique)
        brand = name.replace("HD", "").replace("HD", "").strip()
        if brand and brand in full_text:
            return name, code

    # Broad food keyword match (catches unlisted subsidiaries etc.)
    for keyword in FOOD_KEYWORDS:
        if keyword in full_text:
            # Return generic match without a specific company code
            return full_text.split("　")[0][:20].strip(), "----"

    return None


def _fetch_tdnet_feed() -> list[feedparser.FeedParserDict]:
    """Download and parse the TDnet RSS feed, returning raw entries."""
    try:
        response = requests.get(
            TDNET_RSS_URL,
            timeout=REQUEST_TIMEOUT,
            headers={"User-Agent": "FoodNewsMailer/1.0 (IR reader)"},
        )
        response.raise_for_status()
        feed = feedparser.parse(response.content)
        return feed.entries
    except requests.exceptions.Timeout:
        print(f"[ir_scraper] Timeout fetching TDnet RSS")
        return []
    except requests.exceptions.RequestException as exc:
        print(f"[ir_scraper] Request error fetching TDnet RSS: {exc}")
        return []
    except Exception as exc:
        print(f"[ir_scraper] Unexpected error fetching TDnet RSS: {exc}")
        return []


def fetch_ir_news(max_items: int = 10) -> list[dict]:
    """Collect IR/financial disclosure info for major food companies from TDnet.

    Returns a list of dicts with keys:
        company_name     – company name (日本語)
        title            – disclosure title
        url              – link to the disclosure document
        disclosure_type  – categorised type (e.g. 決算, 適時開示, …)
        published_at     – ISO-8601 string (UTC) or None
    """
    entries = _fetch_tdnet_feed()

    results: list[dict] = []
    seen_urls: set[str] = set()

    for entry in entries:
        if len(results) >= max_items:
            break

        try:
            match = _match_company(entry)
            if match is None:
                continue

            company_name, _code = match
            title = getattr(entry, "title", "").strip()
            url = getattr(entry, "link", "").strip()

            if not title or not url:
                continue

            if url in seen_urls:
                continue
            seen_urls.add(url)

            results.append({
                "company_name": company_name,
                "title": title,
                "url": url,
                "disclosure_type": _infer_disclosure_type(title),
                "published_at": _parse_published_at(entry),
            })
        except Exception as exc:
            print(f"[ir_scraper] Error processing entry: {exc}")
            continue

    return results


if __name__ == "__main__":
    items = fetch_ir_news()
    print(f"Fetched {len(items)} IR disclosures")
    for item in items:
        print(
            f"  [{item['company_name']}] {item['title']}"
            f" ({item['disclosure_type']}) — {item['published_at']}"
        )
