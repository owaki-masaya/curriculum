#!/usr/bin/env python3
"""
飲食業界ニュース定期メール自動配信システム
毎日指定時刻に飲食業界ニュースとIR情報をメール送信します
"""

import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import schedule
import time

from dotenv import load_dotenv

from scrapers.news_scraper import fetch_food_news
from scrapers.ir_scraper import fetch_ir_news
from email_sender.composer import compose_email
from email_sender.sender import send_email

load_dotenv()

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(Path(__file__).parent / "delivery.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)


def _parse_recipients() -> list[str]:
    raw = os.getenv("TO_ADDRESSES", "")
    return [addr.strip() for addr in raw.split(",") if addr.strip()]


def run_delivery() -> None:
    logger.info("配信ジョブ開始")

    recipients = _parse_recipients()
    if not recipients:
        logger.error("TO_ADDRESSES が設定されていません。.env を確認してください。")
        return

    logger.info("飲食業界ニュース収集中...")
    try:
        max_news = int(os.getenv("MAX_NEWS_ITEMS", "20"))
        news_items = fetch_food_news(max_items=max_news)
        logger.info(f"ニュース {len(news_items)} 件取得")
    except Exception as e:
        logger.error(f"ニュース取得エラー: {e}")
        news_items = []

    logger.info("IR・決算情報収集中...")
    try:
        max_ir = int(os.getenv("MAX_IR_ITEMS", "10"))
        ir_items = fetch_ir_news(max_items=max_ir)
        logger.info(f"IR情報 {len(ir_items)} 件取得")
    except Exception as e:
        logger.error(f"IR情報取得エラー: {e}")
        ir_items = []

    subject, html_body = compose_email(
        news_items=news_items,
        ir_items=ir_items,
        report_date=datetime.now(),
    )

    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if not smtp_user or not smtp_password:
        logger.error("SMTP_USER または SMTP_PASSWORD が未設定です。")
        return

    success = send_email(
        to_addresses=recipients,
        subject=subject,
        html_body=html_body,
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_user=smtp_user,
        smtp_password=smtp_password,
    )

    if success:
        logger.info(f"配信完了: {recipients}")
    else:
        logger.error("メール送信に失敗しました")


def main() -> None:
    # 即時実行モード: python main.py --now
    if "--now" in sys.argv:
        logger.info("即時実行モードで起動")
        run_delivery()
        return

    # スケジューラーモード
    send_time = os.getenv("SEND_TIME", "08:00")
    logger.info(f"スケジューラー起動: 毎日 {send_time} に配信")

    schedule.every().day.at(send_time).do(run_delivery)

    # 起動直後にも1回実行するか確認
    if "--run-now-and-schedule" in sys.argv:
        run_delivery()

    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    main()
