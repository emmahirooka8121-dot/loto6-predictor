"""共通テストフィクスチャ"""

import os
import tempfile

import pytest

from src.database import get_connection, init_schema


@pytest.fixture
def tmp_db():
    """一時DBを作成するフィクスチャ"""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    init_schema(path)
    yield path
    os.unlink(path)


@pytest.fixture
def sample_draws():
    """テスト用抽選データ"""
    return [
        {"id": 1, "draw_date": "2024-01-04", "num1": 1, "num2": 10, "num3": 15, "num4": 20, "num5": 30, "num6": 40, "bonus": 5, "set_ball": None},
        {"id": 2, "draw_date": "2024-01-08", "num1": 3, "num2": 12, "num3": 18, "num4": 25, "num5": 33, "num6": 41, "bonus": 7, "set_ball": None},
        {"id": 3, "draw_date": "2024-01-11", "num1": 5, "num2": 10, "num3": 20, "num4": 28, "num5": 35, "num6": 43, "bonus": 2, "set_ball": None},
        {"id": 4, "draw_date": "2024-01-15", "num1": 2, "num2": 8, "num3": 14, "num4": 22, "num5": 31, "num6": 39, "bonus": 11, "set_ball": None},
        {"id": 5, "draw_date": "2024-01-18", "num1": 7, "num2": 15, "num3": 21, "num4": 29, "num5": 36, "num6": 42, "bonus": 4, "set_ball": None},
        {"id": 6, "draw_date": "2024-01-22", "num1": 1, "num2": 9, "num3": 17, "num4": 26, "num5": 34, "num6": 40, "bonus": 13, "set_ball": None},
        {"id": 7, "draw_date": "2024-01-25", "num1": 4, "num2": 11, "num3": 19, "num4": 23, "num5": 32, "num6": 38, "bonus": 6, "set_ball": None},
        {"id": 8, "draw_date": "2024-01-29", "num1": 6, "num2": 13, "num3": 16, "num4": 27, "num5": 37, "num6": 43, "bonus": 9, "set_ball": None},
        {"id": 9, "draw_date": "2024-02-01", "num1": 2, "num2": 10, "num3": 22, "num4": 24, "num5": 30, "num6": 41, "bonus": 15, "set_ball": None},
        {"id": 10, "draw_date": "2024-02-05", "num1": 3, "num2": 14, "num3": 20, "num4": 25, "num5": 33, "num6": 39, "bonus": 8, "set_ball": None},
    ]


@pytest.fixture
def populated_db(tmp_db, sample_draws):
    """サンプルデータ入りDBフィクスチャ"""
    from src.database import insert_draws_bulk

    conn = get_connection(tmp_db)
    try:
        insert_draws_bulk(conn, sample_draws)
    finally:
        conn.close()
    return tmp_db
