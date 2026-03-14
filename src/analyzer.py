"""統計分析エンジン"""

import logging
import math
from collections import Counter, defaultdict
from typing import Optional

from src.database import get_all_draws

logger = logging.getLogger(__name__)

NUM_RANGE = range(1, 44)  # 1〜43


def _extract_numbers(draw: dict) -> list[int]:
    """抽選結果から本数字6個をリストで返す"""
    return [draw["num1"], draw["num2"], draw["num3"], draw["num4"], draw["num5"], draw["num6"]]


def get_draws_for_analysis(db_path: str = None, limit: int = None) -> list[dict]:
    """分析用データを取得（古い順）"""
    draws = get_all_draws(db_path, limit)
    draws.reverse()  # 古い順に
    return draws


def frequency_analysis(draws: list[dict]) -> dict[int, dict]:
    """各番号(1-43)の出現回数と出現率"""
    total = len(draws)
    if total == 0:
        return {}

    counter = Counter()
    for draw in draws:
        for n in _extract_numbers(draw):
            counter[n] += 1

    result = {}
    for n in NUM_RANGE:
        count = counter.get(n, 0)
        result[n] = {
            "count": count,
            "rate": count / (total * 6) if total > 0 else 0,
            "appearance_rate": count / total if total > 0 else 0,
        }
    return result


def odd_even_analysis(draws: list[dict]) -> dict[str, int]:
    """奇数:偶数の比率パターン分布"""
    patterns = Counter()
    for draw in draws:
        nums = _extract_numbers(draw)
        odd = sum(1 for n in nums if n % 2 == 1)
        even = 6 - odd
        pattern = f"{odd}:{even}"
        patterns[pattern] += 1
    return dict(patterns.most_common())


def range_distribution(draws: list[dict]) -> dict[str, dict]:
    """番号帯別出現割合"""
    ranges = {
        "1-9": range(1, 10),
        "10-19": range(10, 20),
        "20-29": range(20, 30),
        "30-39": range(30, 40),
        "40-43": range(40, 44),
    }
    total_nums = len(draws) * 6
    if total_nums == 0:
        return {}

    counter = Counter()
    for draw in draws:
        for n in _extract_numbers(draw):
            for label, r in ranges.items():
                if n in r:
                    counter[label] += 1
                    break

    result = {}
    for label in ranges:
        count = counter.get(label, 0)
        result[label] = {
            "count": count,
            "rate": count / total_nums,
        }
    return result


def sum_statistics(draws: list[dict]) -> dict:
    """6個の合計値の統計"""
    if not draws:
        return {}

    sums = [sum(_extract_numbers(d)) for d in draws]
    n = len(sums)
    mean = sum(sums) / n
    sorted_sums = sorted(sums)
    median = sorted_sums[n // 2] if n % 2 == 1 else (sorted_sums[n // 2 - 1] + sorted_sums[n // 2]) / 2
    variance = sum((s - mean) ** 2 for s in sums) / n
    std = math.sqrt(variance)

    q1_idx = n // 4
    q3_idx = 3 * n // 4
    return {
        "mean": round(mean, 2),
        "median": median,
        "std": round(std, 2),
        "min": min(sums),
        "max": max(sums),
        "q1": sorted_sums[q1_idx],
        "q3": sorted_sums[q3_idx],
    }


def consecutive_analysis(draws: list[dict]) -> dict:
    """連番ペアの出現率"""
    total = len(draws)
    if total == 0:
        return {"rate": 0, "count": 0}

    consec_count = 0
    pair_counter = Counter()
    for draw in draws:
        nums = sorted(_extract_numbers(draw))
        has_consec = False
        for i in range(len(nums) - 1):
            if nums[i + 1] - nums[i] == 1:
                has_consec = True
                pair_counter[(nums[i], nums[i + 1])] += 1
        if has_consec:
            consec_count += 1

    return {
        "rate": consec_count / total,
        "count": consec_count,
        "total": total,
        "top_pairs": pair_counter.most_common(10),
    }


def dormancy_analysis(draws: list[dict]) -> dict[int, int]:
    """各番号の出遅れ度（最後に出てからの経過回数）"""
    if not draws:
        return {}

    last_seen = {}
    latest_id = draws[-1]["id"] if draws else 0

    for draw in draws:
        for n in _extract_numbers(draw):
            last_seen[n] = draw["id"]

    result = {}
    for n in NUM_RANGE:
        if n in last_seen:
            result[n] = latest_id - last_seen[n]
        else:
            result[n] = latest_id  # 一度も出ていない
    return result


def correlation_analysis(draws: list[dict], top_n: int = 20) -> list[tuple]:
    """番号ペアの同時出現頻度 TOP N"""
    pair_counter = Counter()
    for draw in draws:
        nums = sorted(_extract_numbers(draw))
        for i in range(len(nums)):
            for j in range(i + 1, len(nums)):
                pair_counter[(nums[i], nums[j])] += 1

    return pair_counter.most_common(top_n)


def weekday_trend(draws: list[dict]) -> dict[str, dict[int, dict]]:
    """曜日別の出現傾向"""
    from datetime import datetime

    weekday_draws = {"月曜": [], "木曜": [], "その他": []}
    weekday_map = {0: "月曜", 3: "木曜"}

    for draw in draws:
        try:
            dt = datetime.strptime(draw["draw_date"], "%Y-%m-%d")
            key = weekday_map.get(dt.weekday(), "その他")
            weekday_draws[key].append(draw)
        except (ValueError, KeyError):
            continue

    result = {}
    for day, day_draws in weekday_draws.items():
        if day_draws:
            result[day] = frequency_analysis(day_draws)
    return result


def moving_average_trend(draws: list[dict], window: int = 20) -> dict[int, dict]:
    """各番号の出現頻度の移動平均と傾き"""
    if len(draws) < window:
        return {}

    recent = draws[-window:]
    all_freq = frequency_analysis(draws)
    recent_freq = frequency_analysis(recent)

    result = {}
    for n in NUM_RANGE:
        all_rate = all_freq.get(n, {}).get("appearance_rate", 0)
        recent_rate = recent_freq.get(n, {}).get("appearance_rate", 0)
        slope = recent_rate - all_rate
        result[n] = {
            "all_rate": round(all_rate, 4),
            "recent_rate": round(recent_rate, 4),
            "slope": round(slope, 4),
            "trending": "up" if slope > 0.02 else ("down" if slope < -0.02 else "stable"),
        }
    return result


def full_analysis(db_path: str = None, period: int = None) -> dict:
    """全分析を実行して結果を返す"""
    draws = get_draws_for_analysis(db_path, period)
    if not draws:
        logger.warning("分析対象のデータがありません")
        return {}

    logger.info("分析開始: %d 件のデータ", len(draws))

    result = {
        "total_draws": len(draws),
        "frequency": frequency_analysis(draws),
        "odd_even": odd_even_analysis(draws),
        "range_dist": range_distribution(draws),
        "sum_stats": sum_statistics(draws),
        "consecutive": consecutive_analysis(draws),
        "dormancy": dormancy_analysis(draws),
        "correlation": correlation_analysis(draws),
        "weekday_trend": weekday_trend(draws),
        "moving_avg": moving_average_trend(draws),
    }

    logger.info("分析完了")
    return result
