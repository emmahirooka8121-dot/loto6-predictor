"""verifier.py のテスト"""

import pytest

from src.verifier import determine_prize_tier, verify_prediction


class TestDeterminePrizeTier:
    """当選等級判定のテスト"""

    def test_first_prize(self):
        assert determine_prize_tier(6, False) == "1等"

    def test_second_prize(self):
        assert determine_prize_tier(5, True) == "2等"

    def test_third_prize(self):
        assert determine_prize_tier(5, False) == "3等"

    def test_fourth_prize(self):
        assert determine_prize_tier(4, False) == "4等"

    def test_fifth_prize(self):
        assert determine_prize_tier(3, False) == "5等"

    def test_miss_2_match(self):
        assert determine_prize_tier(2, False) == "ハズレ"

    def test_miss_0_match(self):
        assert determine_prize_tier(0, False) == "ハズレ"

    def test_miss_1_match(self):
        assert determine_prize_tier(1, False) == "ハズレ"

    def test_miss_2_with_bonus(self):
        assert determine_prize_tier(2, True) == "ハズレ"


class TestVerifyPrediction:
    """予想検証のテスト"""

    def test_perfect_match(self):
        prediction = {"id": 1, "num1": 1, "num2": 10, "num3": 15, "num4": 20, "num5": 30, "num6": 40}
        draw = {"id": 100, "num1": 1, "num2": 10, "num3": 15, "num4": 20, "num5": 30, "num6": 40, "bonus": 5}
        result = verify_prediction(prediction, draw)
        assert result["matched_count"] == 6
        assert result["prize_tier"] == "1等"
        assert result["bonus_match"] == 0

    def test_five_match_with_bonus(self):
        prediction = {"id": 1, "num1": 1, "num2": 10, "num3": 15, "num4": 20, "num5": 30, "num6": 5}
        draw = {"id": 100, "num1": 1, "num2": 10, "num3": 15, "num4": 20, "num5": 30, "num6": 40, "bonus": 5}
        result = verify_prediction(prediction, draw)
        assert result["matched_count"] == 5
        assert result["bonus_match"] == 1
        assert result["prize_tier"] == "2等"

    def test_no_match(self):
        prediction = {"id": 1, "num1": 2, "num2": 4, "num3": 6, "num4": 8, "num5": 11, "num6": 13}
        draw = {"id": 100, "num1": 1, "num2": 10, "num3": 15, "num4": 20, "num5": 30, "num6": 40, "bonus": 5}
        result = verify_prediction(prediction, draw)
        assert result["matched_count"] == 0
        assert result["prize_tier"] == "ハズレ"

    def test_three_match(self):
        prediction = {"id": 1, "num1": 1, "num2": 10, "num3": 15, "num4": 2, "num5": 3, "num6": 4}
        draw = {"id": 100, "num1": 1, "num2": 10, "num3": 15, "num4": 20, "num5": 30, "num6": 40, "bonus": 5}
        result = verify_prediction(prediction, draw)
        assert result["matched_count"] == 3
        assert result["prize_tier"] == "5等"
