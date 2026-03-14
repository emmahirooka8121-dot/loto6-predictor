"""ロト6当選番号データ取得モジュール"""

import csv
import io
import logging
import re
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from src.config import load_config
from src.database import get_connection, get_latest_draw_id, insert_draws_bulk

logger = logging.getLogger(__name__)

# データソースURL
SOURCES = [
    {
        "name": "mk-mode.com CSV",
        "url": "https://www.mk-mode.com/rails/loto/loto6/csv",
        "type": "csv",
    },
    {
        "name": "loto-life.net CSV",
        "url": "https://loto-life.net/csv/download?type=loto6",
        "type": "csv_alt",
    },
]


def _get_session(config: dict = None) -> requests.Session:
    """リトライ付きセッションを作成"""
    if config is None:
        config = load_config()
    scraper_cfg = config.get("scraper", {})
    session = requests.Session()
    session.headers.update({
        "User-Agent": scraper_cfg.get("user_agent", "Loto6Predictor/1.0 (personal-use)"),
    })
    return session


def _fetch_with_retry(session: requests.Session, url: str, config: dict = None) -> requests.Response:
    """指数バックオフ付きHTTPリクエスト"""
    if config is None:
        config = load_config()
    scraper_cfg = config.get("scraper", {})
    max_retries = scraper_cfg.get("max_retries", 3)
    retry_delay = scraper_cfg.get("retry_delay", 1)

    for attempt in range(max_retries):
        try:
            response = session.get(url, timeout=30)
            response.raise_for_status()
            return response
        except requests.RequestException as e:
            if attempt < max_retries - 1:
                wait = retry_delay * (2 ** attempt)
                logger.warning("リトライ %d/%d (待機 %ds): %s", attempt + 1, max_retries, wait, e)
                time.sleep(wait)
            else:
                raise


def parse_csv_data(text: str) -> list[dict]:
    """CSVテキストを解析して抽選結果リストを返す"""
    draws = []
    reader = csv.reader(io.StringIO(text))

    for row in reader:
        if not row or len(row) < 8:
            continue
        # ヘッダー行やコメント行をスキップ
        try:
            draw_id = int(row[0].strip())
        except (ValueError, IndexError):
            continue

        # 日付解析（複数フォーマット対応）
        date_str = row[1].strip()
        draw_date = _parse_date(date_str)
        if not draw_date:
            logger.warning("日付解析失敗 (回号 %d): %s", draw_id, date_str)
            continue

        try:
            numbers = [int(row[i].strip()) for i in range(2, 8)]
            bonus = int(row[8].strip()) if len(row) > 8 else 0
        except (ValueError, IndexError) as e:
            logger.warning("数値解析失敗 (回号 %d): %s", draw_id, e)
            continue

        # 番号の妥当性チェック
        if not all(1 <= n <= 43 for n in numbers):
            logger.warning("範囲外の番号 (回号 %d): %s", draw_id, numbers)
            continue
        if bonus and not (1 <= bonus <= 43):
            bonus = 0

        numbers.sort()
        set_ball = row[9].strip() if len(row) > 9 and row[9].strip() else None

        draws.append({
            "id": draw_id,
            "draw_date": draw_date,
            "num1": numbers[0],
            "num2": numbers[1],
            "num3": numbers[2],
            "num4": numbers[3],
            "num5": numbers[4],
            "num6": numbers[5],
            "bonus": bonus if bonus else 0,
            "set_ball": set_ball,
        })

    return draws


def _parse_date(date_str: str) -> str | None:
    """様々な日付フォーマットをYYYY-MM-DDに変換"""
    formats = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y年%m月%d日",
    ]
    # 全角数字を半角に変換
    date_str = date_str.translate(str.maketrans("０１２３４５６７８９", "0123456789"))

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def fetch_all_draws(config: dict = None, db_path: str = None) -> int:
    """全履歴を取得してDBに挿入。挿入数を返す。"""
    if config is None:
        config = load_config()
    session = _get_session(config)

    for source in SOURCES:
        try:
            logger.info("データ取得中: %s", source["name"])
            response = _fetch_with_retry(session, source["url"], config)

            # エンコーディング対応
            response.encoding = response.apparent_encoding or "utf-8"
            draws = parse_csv_data(response.text)

            if not draws:
                logger.warning("データが空です: %s", source["name"])
                continue

            logger.info("%d 件の抽選データを取得しました", len(draws))

            conn = get_connection(db_path)
            try:
                count = insert_draws_bulk(conn, draws)
                logger.info("%d 件を新規挿入しました", count)
                return count
            finally:
                conn.close()

        except Exception as e:
            logger.warning("データソース '%s' の取得に失敗: %s", source["name"], e)
            continue

    logger.error("すべてのデータソースからの取得に失敗しました")
    return 0


def fetch_latest_draws(config: dict = None, db_path: str = None) -> int:
    """差分データのみ取得してDBに追記。挿入数を返す。"""
    latest_id = get_latest_draw_id(db_path)
    logger.info("DB内の最新回号: %d", latest_id)

    if config is None:
        config = load_config()
    session = _get_session(config)

    for source in SOURCES:
        try:
            logger.info("差分取得中: %s", source["name"])
            response = _fetch_with_retry(session, source["url"], config)
            response.encoding = response.apparent_encoding or "utf-8"
            draws = parse_csv_data(response.text)

            # 差分のみフィルタ
            new_draws = [d for d in draws if d["id"] > latest_id]
            if not new_draws:
                logger.info("新しいデータはありません")
                return 0

            logger.info("%d 件の新規データがあります", len(new_draws))

            conn = get_connection(db_path)
            try:
                count = insert_draws_bulk(conn, new_draws)
                logger.info("%d 件を挿入しました", count)
                return count
            finally:
                conn.close()

        except Exception as e:
            logger.warning("データソース '%s' の取得に失敗: %s", source["name"], e)
            continue

    logger.error("すべてのデータソースからの取得に失敗しました")
    return 0
