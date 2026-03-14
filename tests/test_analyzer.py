"""analyzer.py のテスト"""

import pytest

from src.analyzer import (
    consecutive_analysis,
    dormancy_analysis,
    frequency_analysis,
    odd_even_analysis,
    range_distribution,
    sum_statistics,
)


def test_frequency_analysis(sample_draws):
    """出現頻度計算の正確性"""
    freq = frequency_analysis(sample_draws)
    assert len(freq) == 43

    # 番号10は3回出現（draw 1, 3, 9）
    assert freq[10]["count"] == 3
    assert freq[10]["appearance_rate"] == 3 / 10

    # 番号43は2回出現（draw 3, 8）
    assert freq[43]["count"] == 2

    # 出現していない番号
    assert freq[42]["count"] == 1  # draw 5


def test_odd_even_analysis(sample_draws):
    """奇偶パターンの集計"""
    oe = odd_even_analysis(sample_draws)
    assert isinstance(oe, dict)
    # パターン合計がデータ数に一致
    assert sum(oe.values()) == len(sample_draws)
    # すべてのキーが "N:M" 形式
    for key in oe:
        parts = key.split(":")
        assert len(parts) == 2
        assert int(parts[0]) + int(parts[1]) == 6


def test_range_distribution(sample_draws):
    """番号帯別出現割合"""
    rd = range_distribution(sample_draws)
    assert "1-9" in rd
    assert "10-19" in rd
    assert "20-29" in rd
    assert "30-39" in rd
    assert "40-43" in rd

    # 全割合の合計が1.0に近い
    total_rate = sum(d["rate"] for d in rd.values())
    assert abs(total_rate - 1.0) < 0.01


def test_sum_statistics(sample_draws):
    """合計値統計の計算"""
    ss = sum_statistics(sample_draws)
    assert "mean" in ss
    assert "median" in ss
    assert "std" in ss
    assert "min" in ss
    assert "max" in ss

    # draw1の合計: 1+10+15+20+30+40=116
    # draw2の合計: 3+12+18+25+33+41=132
    assert ss["min"] <= ss["mean"] <= ss["max"]
    assert ss["std"] >= 0


def test_consecutive_analysis(sample_draws):
    """連番ペアの出現率"""
    ca = consecutive_analysis(sample_draws)
    assert "rate" in ca
    assert "count" in ca
    assert 0 <= ca["rate"] <= 1


def test_dormancy_analysis(sample_draws):
    """出遅れ度の分析"""
    dorm = dormancy_analysis(sample_draws)
    assert len(dorm) == 43

    # 最新のdraw (id=10)に含まれる番号の出遅れ度は0
    # draw 10: [3, 14, 20, 25, 33, 39]
    assert dorm[3] == 0  # id=10で出現
    assert dorm[14] == 0
    assert dorm[20] == 0

    # draw 1にしか出ていない番号40の出遅れ度
    # 40はdraw 1とdraw 6に出現、最新はdraw 6 → 10 - 6 = 4
    assert dorm[40] == 4


def test_frequency_empty():
    """空データでの出現頻度"""
    freq = frequency_analysis([])
    assert freq == {}


def test_sum_statistics_empty():
    """空データでの合計値統計"""
    ss = sum_statistics([])
    assert ss == {}
