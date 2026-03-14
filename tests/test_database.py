"""database.py のテスト"""

import pytest

from src.database import (
    get_all_draws,
    get_connection,
    get_draw_by_id,
    get_draws_count,
    get_latest_draw_id,
    init_schema,
    insert_draw,
    insert_draws_bulk,
    insert_prediction,
    insert_verification,
)


def test_init_schema(tmp_db):
    """スキーマ作成が成功すること"""
    conn = get_connection(tmp_db)
    try:
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        table_names = {t["name"] for t in tables}
        assert "draws" in table_names
        assert "predictions" in table_names
        assert "verifications" in table_names
        assert "weight_history" in table_names
    finally:
        conn.close()


def test_insert_draw(tmp_db):
    """抽選データの挿入"""
    conn = get_connection(tmp_db)
    try:
        draw = {
            "id": 1, "draw_date": "2024-01-01",
            "num1": 1, "num2": 10, "num3": 20, "num4": 30, "num5": 35, "num6": 43,
            "bonus": 5, "set_ball": None,
        }
        assert insert_draw(conn, draw) is True
        conn.commit()
    finally:
        conn.close()

    assert get_latest_draw_id(tmp_db) == 1
    assert get_draws_count(tmp_db) == 1


def test_duplicate_insert(tmp_db):
    """重複挿入がスキップされること"""
    conn = get_connection(tmp_db)
    try:
        draw = {
            "id": 1, "draw_date": "2024-01-01",
            "num1": 1, "num2": 10, "num3": 20, "num4": 30, "num5": 35, "num6": 43,
            "bonus": 5, "set_ball": None,
        }
        assert insert_draw(conn, draw) is True
        assert insert_draw(conn, draw) is False
        conn.commit()
    finally:
        conn.close()

    assert get_draws_count(tmp_db) == 1


def test_bulk_insert(tmp_db, sample_draws):
    """一括挿入"""
    conn = get_connection(tmp_db)
    try:
        count = insert_draws_bulk(conn, sample_draws)
    finally:
        conn.close()

    assert count == len(sample_draws)
    assert get_draws_count(tmp_db) == len(sample_draws)


def test_get_all_draws(populated_db):
    """全データ取得（新しい順）"""
    draws = get_all_draws(populated_db)
    assert len(draws) == 10
    assert draws[0]["id"] > draws[-1]["id"]


def test_get_draw_by_id(populated_db):
    """特定回号の取得"""
    draw = get_draw_by_id(1, populated_db)
    assert draw is not None
    assert draw["id"] == 1
    assert draw["num1"] == 1

    assert get_draw_by_id(9999, populated_db) is None


def test_prediction_crud(tmp_db):
    """予想のCRUD操作"""
    conn = get_connection(tmp_db)
    try:
        pred = {
            "target_draw_id": 100,
            "target_draw_date": "2024-06-01",
            "strategy": "hot",
            "num1": 1, "num2": 5, "num3": 10, "num4": 20, "num5": 30, "num6": 40,
        }
        pid = insert_prediction(conn, pred)
        conn.commit()
        assert pid > 0
    finally:
        conn.close()


def test_verification_crud(tmp_db, sample_draws):
    """検証結果のCRUD操作"""
    conn = get_connection(tmp_db)
    try:
        insert_draws_bulk(conn, sample_draws[:1])
        pred = {
            "target_draw_id": 1,
            "target_draw_date": "2024-01-04",
            "strategy": "hot",
            "num1": 1, "num2": 10, "num3": 15, "num4": 20, "num5": 30, "num6": 40,
        }
        pid = insert_prediction(conn, pred)

        ver = {
            "prediction_id": pid,
            "draw_id": 1,
            "matched_count": 6,
            "matched_numbers": "[1, 10, 15, 20, 30, 40]",
            "bonus_match": 0,
            "prize_tier": "1等",
        }
        vid = insert_verification(conn, ver)
        conn.commit()
        assert vid > 0
    finally:
        conn.close()
