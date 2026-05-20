import feedparser
import requests
from datetime import datetime, timezone
from typing import Optional
import time


RSS_SOURCES = [
    {
        "url": "https://rss.itmedia.co.jp/rss/2.0/soho.xml",
        "source": "ITmedia (飲食関連含む)",
    },
    {
        "url": "https://www.nikkei.com/rss/industry/food.rdf",
        "source": "日経 食品",
    },
    {
        "url": "https://news.yahoo.co.jp/rss/topics/domestic.xml",
        "source": "Yahoo!ニュース 国内",
    },
    {
        "url": "https://www3.nhk.or.jp/rss/news/cat5.xml",
        "source": "NHKニュース 経済",
    },
]

# Keywords used to filter relevant food/restaurant industry articles
FOOD_KEYWORDS = [
    "飲食", "外食", "レストラン", "食品", "フード", "居酒屋", "カフェ",
    "料理", "食事", "グルメ", "食材", "飲料", "ファストフード", "コンビニ",
    "スーパー", "食料",
]

# Minimum number of items to return even if keyword filtering yields fewer
MIN_ITEMS_FALLBACK = 5

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

    feed = None
    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT, headers={
            "User-Agent": "FoodNewsMailer/1.0 (RSS reader)"
        })
        response.raise_for_status()
        feed = feedparser.parse(response.content)
    except requests.exceptions.Timeout:
        print(f"[news_scraper] Timeout fetching {url}, trying feedparser directly")
    except requests.exceptions.RequestException as exc:
        print(f"[news_scraper] Request error for {url}: {exc}, trying feedparser directly")
    except Exception as exc:
        print(f"[news_scraper] Unexpected error for {url}: {exc}, trying feedparser directly")

    # Fallback: let feedparser use its own HTTP client
    if feed is None or feed.bozo and not feed.entries:
        try:
            feed = feedparser.parse(url)
        except Exception as exc:
            print(f"[news_scraper] feedparser direct parse also failed for {url}: {exc}")
            return results

    if feed is None:
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


def _is_food_related(item: dict) -> bool:
    """Return True if the item title or summary contains a food-related keyword."""
    text = (item.get("title") or "") + " " + (item.get("summary") or "")
    return any(kw in text for kw in FOOD_KEYWORDS)


def fetch_food_news(max_items: int = 20) -> list[dict]:
    """Scrape food industry news from multiple RSS feeds.

    Returns a list of dicts with keys:
        title        – article headline
        url          – canonical URL
        summary      – plain-text excerpt (up to 500 chars)
        source       – human-readable source name
        published_at – ISO-8601 string (UTC) or None

    Items are filtered to those whose title or summary contain food/restaurant
    keywords.  If fewer than MIN_ITEMS_FALLBACK pass the filter, unfiltered
    items are appended to ensure the email is not empty.
    """
    all_items: list[dict] = []

    for source in RSS_SOURCES:
        # Fetch up to ITEMS_PER_SOURCE per source regardless of running total
        # so filtering has enough candidates.
        items = _fetch_feed(source, ITEMS_PER_SOURCE)
        all_items.extend(items)

        # Small courtesy delay between requests
        time.sleep(0.5)

    # Apply keyword filter
    filtered = [item for item in all_items if _is_food_related(item)]

    # Fallback: if filtering left too few items, top-up with unfiltered ones
    if len(filtered) < MIN_ITEMS_FALLBACK:
        seen_urls = {item["url"] for item in filtered}
        for item in all_items:
            if item["url"] not in seen_urls:
                filtered.append(item)
                seen_urls.add(item["url"])
            if len(filtered) >= MIN_ITEMS_FALLBACK:
                break

    return filtered[:max_items]


if __name__ == "__main__":
    news = fetch_food_news()
    print(f"Fetched {len(news)} articles")
    for item in news:
        print(f"  [{item['source']}] {item['title']} — {item['published_at']}")
