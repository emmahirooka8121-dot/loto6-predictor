"""SQLiteデータベース操作モジュール"""

import json
import logging
import sqlite3
from typing import Optional

from src.config import get_db_path

logger = logging.getLogger(__name__)


def get_connection(db_path: str = None) -> sqlite3.Connection:
    """データベース接続を取得"""
    path = db_path or get_db_path()
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_schema(db_path: str = None) -> None:
    """DBスキーマを作成"""
    conn = get_connection(db_path)
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS draws (
                id INTEGER PRIMARY KEY,
                draw_date TEXT NOT NULL,
                num1 INTEGER NOT NULL CHECK(num1 BETWEEN 1 AND 43),
                num2 INTEGER NOT NULL CHECK(num2 BETWEEN 1 AND 43),
                num3 INTEGER NOT NULL CHECK(num3 BETWEEN 1 AND 43),
                num4 INTEGER NOT NULL CHECK(num4 BETWEEN 1 AND 43),
                num5 INTEGER NOT NULL CHECK(num5 BETWEEN 1 AND 43),
                num6 INTEGER NOT NULL CHECK(num6 BETWEEN 1 AND 43),
                bonus INTEGER NOT NULL CHECK(bonus BETWEEN 1 AND 43),
                set_ball TEXT,
                created_at TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_draw_id INTEGER,
                target_draw_date TEXT NOT NULL,
                strategy TEXT NOT NULL,
                num1 INTEGER NOT NULL,
                num2 INTEGER NOT NULL,
                num3 INTEGER NOT NULL,
                num4 INTEGER NOT NULL,
                num5 INTEGER NOT NULL,
                num6 INTEGER NOT NULL,
                created_at TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS verifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prediction_id INTEGER NOT NULL,
                draw_id INTEGER NOT NULL,
                matched_count INTEGER NOT NULL,
                matched_numbers TEXT,
                bonus_match INTEGER DEFAULT 0,
                prize_tier TEXT,
                verified_at TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (prediction_id) REFERENCES predictions(id),
                FOREIGN KEY (draw_id) REFERENCES draws(id)
            );

            CREATE TABLE IF NOT EXISTS weight_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                strategy TEXT NOT NULL,
                weights_json TEXT NOT NULL,
                avg_match_score REAL,
                created_at TEXT DEFAULT (datetime('now','localtime'))
            );
        """)
        conn.commit()
        logger.info("データベーススキーマを作成しました")
    finally:
        conn.close()


# --- draws テーブル操作 ---

def insert_draw(conn: sqlite3.Connection, draw: dict) -> bool:
    """抽選結果を挿入。重複時はスキップしてFalseを返す。"""
    try:
        conn.execute(
            """INSERT INTO draws (id, draw_date, num1, num2, num3, num4, num5, num6, bonus, set_ball)
               VALUES (:id, :draw_date, :num1, :num2, :num3, :num4, :num5, :num6, :bonus, :set_ball)""",
            draw,
        )
        return True
    except sqlite3.IntegrityError:
        return False


def insert_draws_bulk(conn: sqlite3.Connection, draws: list[dict]) -> int:
    """複数の抽選結果を一括挿入。挿入成功数を返す。"""
    count = 0
    for draw in draws:
        if insert_draw(conn, draw):
            count += 1
    conn.commit()
    return count


def get_latest_draw_id(db_path: str = None) -> int:
    """DB内の最新回号を返す。データなしなら0。"""
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT MAX(id) as max_id FROM draws").fetchone()
        return row["max_id"] or 0
    finally:
        conn.close()


def get_all_draws(db_path: str = None, limit: int = None) -> list[dict]:
    """全抽選結果を取得（新しい順）"""
    conn = get_connection(db_path)
    try:
        query = "SELECT * FROM draws ORDER BY id DESC"
        if limit:
            query += f" LIMIT {limit}"
        rows = conn.execute(query).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_draw_by_id(draw_id: int, db_path: str = None) -> Optional[dict]:
    """特定回号の抽選結果を取得"""
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT * FROM draws WHERE id = ?", (draw_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_draws_count(db_path: str = None) -> int:
    """抽選データ件数を返す"""
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT COUNT(*) as cnt FROM draws").fetchone()
        return row["cnt"]
    finally:
        conn.close()


# --- predictions テーブル操作 ---

def insert_prediction(conn: sqlite3.Connection, prediction: dict) -> int:
    """予想を挿入し、IDを返す"""
    cursor = conn.execute(
        """INSERT INTO predictions (target_draw_id, target_draw_date, strategy, num1, num2, num3, num4, num5, num6)
           VALUES (:target_draw_id, :target_draw_date, :strategy, :num1, :num2, :num3, :num4, :num5, :num6)""",
        prediction,
    )
    return cursor.lastrowid


def get_predictions_for_draw(draw_id: int = None, draw_date: str = None, db_path: str = None) -> list[dict]:
    """特定の回号または日付の予想を取得"""
    conn = get_connection(db_path)
    try:
        if draw_id:
            rows = conn.execute(
                "SELECT * FROM predictions WHERE target_draw_id = ? ORDER BY id", (draw_id,)
            ).fetchall()
        elif draw_date:
            rows = conn.execute(
                "SELECT * FROM predictions WHERE target_draw_date = ? ORDER BY id", (draw_date,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM predictions ORDER BY id DESC LIMIT 5"
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_latest_predictions(db_path: str = None) -> list[dict]:
    """最新の予想セット（5通り）を取得"""
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT target_draw_date FROM predictions ORDER BY id DESC LIMIT 1"
        ).fetchone()
        if not row:
            return []
        target_date = row["target_draw_date"]
        rows = conn.execute(
            "SELECT * FROM predictions WHERE target_draw_date = ? ORDER BY id",
            (target_date,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# --- verifications テーブル操作 ---

def insert_verification(conn: sqlite3.Connection, verification: dict) -> int:
    """検証結果を挿入"""
    cursor = conn.execute(
        """INSERT INTO verifications (prediction_id, draw_id, matched_count, matched_numbers, bonus_match, prize_tier)
           VALUES (:prediction_id, :draw_id, :matched_count, :matched_numbers, :bonus_match, :prize_tier)""",
        verification,
    )
    return cursor.lastrowid


def get_verification_stats(db_path: str = None, last_n: int = None) -> dict:
    """的中統計を返す"""
    conn = get_connection(db_path)
    try:
        query = """
            SELECT
                COUNT(*) as total,
                AVG(matched_count) as avg_match,
                MAX(matched_count) as max_match,
                SUM(CASE WHEN matched_count >= 3 THEN 1 ELSE 0 END) as hits_3plus,
                SUM(CASE WHEN matched_count >= 4 THEN 1 ELSE 0 END) as hits_4plus,
                SUM(CASE WHEN matched_count >= 5 THEN 1 ELSE 0 END) as hits_5plus,
                SUM(CASE WHEN matched_count = 6 THEN 1 ELSE 0 END) as hits_6
            FROM verifications
        """
        if last_n:
            query = f"""
                SELECT
                    COUNT(*) as total,
                    AVG(matched_count) as avg_match,
                    MAX(matched_count) as max_match,
                    SUM(CASE WHEN matched_count >= 3 THEN 1 ELSE 0 END) as hits_3plus,
                    SUM(CASE WHEN matched_count >= 4 THEN 1 ELSE 0 END) as hits_4plus,
                    SUM(CASE WHEN matched_count >= 5 THEN 1 ELSE 0 END) as hits_5plus,
                    SUM(CASE WHEN matched_count = 6 THEN 1 ELSE 0 END) as hits_6
                FROM (
                    SELECT matched_count FROM verifications ORDER BY id DESC LIMIT {last_n}
                )
            """
        row = conn.execute(query).fetchone()
        return dict(row) if row else {}
    finally:
        conn.close()


def get_strategy_stats(db_path: str = None) -> list[dict]:
    """戦略別の検証統計を返す"""
    conn = get_connection(db_path)
    try:
        rows = conn.execute("""
            SELECT
                p.strategy,
                COUNT(*) as total,
                AVG(v.matched_count) as avg_match,
                MAX(v.matched_count) as max_match,
                SUM(CASE WHEN v.matched_count >= 3 THEN 1 ELSE 0 END) as hits_3plus
            FROM verifications v
            JOIN predictions p ON v.prediction_id = p.id
            GROUP BY p.strategy
            ORDER BY avg_match DESC
        """).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# --- weight_history テーブル操作 ---

def insert_weight_history(conn: sqlite3.Connection, strategy: str, weights: dict, avg_score: float) -> None:
    """重み履歴を挿入"""
    conn.execute(
        """INSERT INTO weight_history (strategy, weights_json, avg_match_score)
           VALUES (?, ?, ?)""",
        (strategy, json.dumps(weights), avg_score),
    )


def get_latest_weights(strategy: str, db_path: str = None) -> Optional[dict]:
    """特定戦略の最新重みを返す"""
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT weights_json FROM weight_history WHERE strategy = ? ORDER BY id DESC LIMIT 1",
            (strategy,),
        ).fetchone()
        return json.loads(row["weights_json"]) if row else None
    finally:
        conn.close()
