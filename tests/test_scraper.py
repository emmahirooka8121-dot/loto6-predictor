"""scraper.py のテスト"""

import pytest

from src.scraper import parse_csv_data


class TestParseCsvData:
    """CSV解析のテスト"""

    def test_standard_csv(self):
        csv_text = """1,2024-01-04,1,10,15,20,30,40,5,A
2,2024-01-08,3,12,18,25,33,41,7,B"""
        draws = parse_csv_data(csv_text)
        assert len(draws) == 2
        assert draws[0]["id"] == 1
        assert draws[0]["draw_date"] == "2024-01-04"
        assert draws[0]["num1"] == 1
        assert draws[0]["num6"] == 40
        assert draws[0]["bonus"] == 5
        assert draws[0]["set_ball"] == "A"

    def test_slash_date_format(self):
        csv_text = "1,2024/01/04,1,10,15,20,30,40,5\n"
        draws = parse_csv_data(csv_text)
        assert len(draws) == 1
        assert draws[0]["draw_date"] == "2024-01-04"

    def test_skip_header(self):
        csv_text = """回号,抽選日,本数字1,本数字2,本数字3,本数字4,本数字5,本数字6,ボーナス
1,2024-01-04,1,10,15,20,30,40,5"""
        draws = parse_csv_data(csv_text)
        assert len(draws) == 1

    def test_empty_csv(self):
        draws = parse_csv_data("")
        assert draws == []

    def test_invalid_numbers_skipped(self):
        csv_text = "1,2024-01-04,0,10,15,20,30,44,5\n"
        draws = parse_csv_data(csv_text)
        assert len(draws) == 0  # 範囲外の番号がある行はスキップ

    def test_sort_numbers(self):
        csv_text = "1,2024-01-04,40,30,20,15,10,1,5\n"
        draws = parse_csv_data(csv_text)
        assert len(draws) == 1
        assert draws[0]["num1"] == 1
        assert draws[0]["num6"] == 40

    def test_no_set_ball(self):
        csv_text = "1,2024-01-04,1,10,15,20,30,40,5\n"
        draws = parse_csv_data(csv_text)
        assert len(draws) == 1
        assert draws[0]["set_ball"] is None
