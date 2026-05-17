import feedparser
import requests
from datetime import datetime, timezone
from typing import Optional
import time


RSS_SOURCES = [
    {
        "url": "https://www.hotpepper.jp/mesitsu/rss/",
        "source": "グルメニュース (Mesitsu)",
    },
    {
        "url": "https://foodbiz.co.jp/feed/",
        "source": "フードビズ",
    },
    {
        "url": "https://www.inshokuten.com/news/rss.php",
        "source": "飲食店.COM",
    },
    {
        "url": "https://news.google.com/rss/search?q=%E9%A3%B2%E9%A3%9F%E6%A5%AD%E7%95%8C&hl=ja&gl=JP&ceid=JP:ja",
        "source": "Google News - 飲食業界",
    },
    {
        "url": "https://news.google.com/rss/search?q=%E5%A4%96%E9%A3%9F%E7%94%A3%E6%A5%AD&hl=ja&gl=JP&ceid=JP:ja",
        "source": "Google News - 外食産業",
    },
]

ITEMS_PER_SOURCE = 5
REQUEST_TIMEOUT = 10


def _parse_published_at(entry: feedparser.FeedParserDict) -> Optional[str]:
    """Extract and normalise the publication timestamp from a feed entry."""
    # feedparser populates published_parsed as a time.struct_time in UTC
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        try:
            dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            return dt.isoformat()
        except (TypeError, ValueError):
            pass

    # Fall back to the raw string if available
    raw = getattr(entry, "published", None) or getattr(entry, "updated", None)
    return raw if raw else None


def _get_summary(entry: feedparser.FeedParserDict) -> str:
    """Return a plain-text summary for the entry, truncated to 500 chars."""
    summary = (
        getattr(entry, "summary", None)
        or getattr(entry, "description", None)
        or ""
    )
    # Strip any embedded HTML tags with a simple approach
    import re
    summary = re.sub(r"<[^>]+>", "", summary).strip()
    return summary[:500]


def _fetch_feed(source: dict, items_per_source: int) -> list[dict]:
    """Fetch and parse a single RSS feed, returning up to items_per_source items."""
    url = source["url"]
    source_name = source["source"]
    results: list[dict] = []

    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT, headers={
            "User-Agent": "FoodNewsMailer/1.0 (RSS reader)"
        })
        response.raise_for_status()
        feed = feedparser.parse(response.content)
    except requests.exceptions.Timeout:
        print(f"[news_scraper] Timeout fetching {url}")
        return results
    except requests.exceptions.RequestException as exc:
        print(f"[news_scraper] Request error for {url}: {exc}")
        return results
    except Exception as exc:
        print(f"[news_scraper] Unexpected error for {url}: {exc}")
        return results

    for entry in feed.entries[:items_per_source]:
        try:
            title = getattr(entry, "title", "").strip()
            link = getattr(entry, "link", "").strip()
            if not title or not link:
                continue

            results.append({
                "title": title,
                "url": link,
                "summary": _get_summary(entry),
                "source": source_name,
                "published_at": _parse_published_at(entry),
            })
        except Exception as exc:
            print(f"[news_scraper] Error parsing entry from {source_name}: {exc}")
            continue

    return results


def fetch_food_news(max_items: int = 20) -> list[dict]:
    """Scrape food industry news from multiple RSS feeds.

    Returns a list of dicts with keys:
        title        – article headline
        url          – canonical URL
        summary      – plain-text excerpt (up to 500 chars)
        source       – human-readable source name
        published_at – ISO-8601 string (UTC) or None
    """
    all_items: list[dict] = []

    for source in RSS_SOURCES:
        if len(all_items) >= max_items:
            break

        remaining_slots = max_items - len(all_items)
        per_source_limit = min(ITEMS_PER_SOURCE, remaining_slots)

        items = _fetch_feed(source, per_source_limit)
        all_items.extend(items)

        # Small courtesy delay between requests
        time.sleep(0.5)

    return all_items[:max_items]


if __name__ == "__main__":
    news = fetch_food_news()
    print(f"Fetched {len(news)} articles")
    for item in news:
        print(f"  [{item['source']}] {item['title']} — {item['published_at']}")
