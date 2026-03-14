"""predictor.py のテスト"""

import pytest

from src.predictor import (
    STRATEGIES,
    generate_predictions,
    strategy_balanced,
    strategy_cold,
    strategy_composite,
    strategy_hot,
    strategy_overdue,
)


@pytest.fixture
def draws_for_prediction(sample_draws):
    """予想用データ（古い順）"""
    return sorted(sample_draws, key=lambda x: x["id"])


class TestStrategies:
    """各戦略のテスト"""

    def _validate_numbers(self, numbers):
        """生成番号の基本バリデーション"""
        assert len(numbers) == 6, f"6個であること: {numbers}"
        assert len(set(numbers)) == 6, f"すべて異なること: {numbers}"
        assert all(1 <= n <= 43 for n in numbers), f"1-43の範囲内: {numbers}"
        assert numbers == sorted(numbers), f"昇順ソート: {numbers}"

    def test_hot_strategy(self, draws_for_prediction):
        numbers = strategy_hot(draws_for_prediction)
        self._validate_numbers(numbers)

    def test_cold_strategy(self, draws_for_prediction):
        numbers = strategy_cold(draws_for_prediction)
        self._validate_numbers(numbers)

    def test_overdue_strategy(self, draws_for_prediction):
        numbers = strategy_overdue(draws_for_prediction)
        self._validate_numbers(numbers)

    def test_balanced_strategy(self, draws_for_prediction):
        numbers = strategy_balanced(draws_for_prediction)
        self._validate_numbers(numbers)

    def test_composite_strategy(self, draws_for_prediction):
        numbers = strategy_composite(draws_for_prediction)
        self._validate_numbers(numbers)


class TestGeneratePredictions:
    """予想生成の統合テスト"""

    def test_generates_five_predictions(self, populated_db):
        predictions = generate_predictions(
            db_path=populated_db,
            target_date="2024-03-01",
            target_draw_id=100,
            dry_run=True,
        )
        assert len(predictions) == 5

    def test_all_strategies_covered(self, populated_db):
        predictions = generate_predictions(
            db_path=populated_db,
            target_date="2024-03-01",
            target_draw_id=100,
            dry_run=True,
        )
        strategies = {p["strategy"] for p in predictions}
        assert strategies == {"hot", "cold", "overdue", "balanced", "composite"}

    def test_no_duplicate_sets(self, populated_db):
        """5通りの間で重複セットがないこと"""
        predictions = generate_predictions(
            db_path=populated_db,
            target_date="2024-03-01",
            target_draw_id=100,
            dry_run=True,
        )
        sets = set()
        for p in predictions:
            nums = (p["num1"], p["num2"], p["num3"], p["num4"], p["num5"], p["num6"])
            assert nums not in sets, f"重複セット: {nums}"
            sets.add(nums)

    def test_numbers_valid(self, populated_db):
        """全予想の番号が有効であること"""
        predictions = generate_predictions(
            db_path=populated_db,
            target_date="2024-03-01",
            target_draw_id=100,
            dry_run=True,
        )
        for p in predictions:
            nums = [p["num1"], p["num2"], p["num3"], p["num4"], p["num5"], p["num6"]]
            assert len(nums) == 6
            assert len(set(nums)) == 6
            assert all(1 <= n <= 43 for n in nums)
            assert nums == sorted(nums)

    def test_dry_run_no_db_save(self, populated_db):
        """dry_runではDBに保存されないこと"""
        from src.database import get_predictions_for_draw

        predictions = generate_predictions(
            db_path=populated_db,
            target_date="2024-03-01",
            target_draw_id=100,
            dry_run=True,
        )
        saved = get_predictions_for_draw(draw_id=100, db_path=populated_db)
        assert len(saved) == 0
