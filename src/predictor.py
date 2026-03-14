"""予想番号生成モジュール（5戦略）"""

import logging
import math
import random
from datetime import datetime, timedelta

from src.analyzer import (
    NUM_RANGE,
    correlation_analysis,
    dormancy_analysis,
    frequency_analysis,
    full_analysis,
    get_draws_for_analysis,
    moving_average_trend,
    odd_even_analysis,
    range_distribution,
    sum_statistics,
    weekday_trend,
)
from src.config import load_config
from src.database import get_connection, insert_prediction

logger = logging.getLogger(__name__)


def _weighted_sample(scores: dict[int, float], k: int = 6) -> list[int]:
    """スコアに基づいて重み付きサンプリングで k 個を選択"""
    numbers = list(scores.keys())
    weights = [max(scores[n], 0.001) for n in numbers]  # 0除算防止
    selected = []
    available = list(zip(numbers, weights))

    for _ in range(k):
        if not available:
            break
        nums, wts = zip(*available)
        total = sum(wts)
        probs = [w / total for w in wts]
        chosen = random.choices(list(nums), weights=probs, k=1)[0]
        selected.append(chosen)
        available = [(n, w) for n, w in available if n != chosen]

    return sorted(selected)


def strategy_hot(draws: list[dict], config: dict = None) -> list[int]:
    """ホット戦略: 直近50回の出現頻度上位に重み付け"""
    if config is None:
        config = load_config()
    weights_cfg = config.get("strategy_weights", {}).get("hot", {})
    w_freq = weights_cfg.get("frequency", 0.6)
    w_trend = weights_cfg.get("trend", 0.3)
    w_corr = weights_cfg.get("correlation", 0.1)

    recent = draws[-50:] if len(draws) > 50 else draws
    freq = frequency_analysis(recent)
    trend = moving_average_trend(draws, window=20)
    corr = correlation_analysis(recent, top_n=50)

    # 相関スコア
    corr_score = {}
    for (a, b), count in corr:
        corr_score[a] = corr_score.get(a, 0) + count
        corr_score[b] = corr_score.get(b, 0) + count
    max_corr = max(corr_score.values()) if corr_score else 1

    scores = {}
    for n in NUM_RANGE:
        f = freq.get(n, {}).get("appearance_rate", 0)
        t = trend.get(n, {}).get("slope", 0)
        t_norm = (t + 1) / 2  # normalize slope to ~0-1
        c = corr_score.get(n, 0) / max_corr if max_corr else 0
        scores[n] = f * w_freq + t_norm * w_trend + c * w_corr

    return _weighted_sample(scores)


def strategy_cold(draws: list[dict], config: dict = None) -> list[int]:
    """コールド戦略: 出現頻度が平均以下の番号に重み付け"""
    if config is None:
        config = load_config()
    weights_cfg = config.get("strategy_weights", {}).get("cold", {})
    w_inv = weights_cfg.get("inverse_frequency", 0.7)
    w_dorm = weights_cfg.get("dormancy", 0.3)

    freq = frequency_analysis(draws)
    dorm = dormancy_analysis(draws)
    max_dorm = max(dorm.values()) if dorm else 1

    # 理論的な出現率
    theoretical_rate = 6 / 43

    scores = {}
    for n in NUM_RANGE:
        actual_rate = freq.get(n, {}).get("appearance_rate", 0)
        deviation = max(theoretical_rate - actual_rate, 0) / theoretical_rate
        d = dorm.get(n, 0) / max_dorm if max_dorm else 0
        scores[n] = deviation * w_inv + d * w_dorm

    return _weighted_sample(scores)


def strategy_overdue(draws: list[dict], config: dict = None) -> list[int]:
    """出遅れ戦略: 経過回数が大きい番号を重視"""
    if config is None:
        config = load_config()
    weights_cfg = config.get("strategy_weights", {}).get("overdue", {})
    w_dorm = weights_cfg.get("dormancy", 0.7)
    w_inv = weights_cfg.get("inverse_frequency", 0.3)

    freq = frequency_analysis(draws)
    dorm = dormancy_analysis(draws)
    max_dorm = max(dorm.values()) if dorm else 1
    theoretical_rate = 6 / 43

    scores = {}
    for n in NUM_RANGE:
        d = dorm.get(n, 0) / max_dorm if max_dorm else 0
        actual_rate = freq.get(n, {}).get("appearance_rate", 0)
        inv = max(theoretical_rate - actual_rate, 0) / theoretical_rate
        scores[n] = d * w_dorm + inv * w_inv

    return _weighted_sample(scores)


def strategy_balanced(draws: list[dict], config: dict = None) -> list[int]:
    """バランス戦略: 奇偶・番号帯・合計値のバランスを重視"""
    freq = frequency_analysis(draws)
    oe = odd_even_analysis(draws)
    sum_stats = sum_statistics(draws)
    corr = correlation_analysis(draws, top_n=50)

    # 最頻の奇偶パターン
    if oe:
        target_pattern = max(oe, key=oe.get)
        target_odd = int(target_pattern.split(":")[0])
    else:
        target_odd = 3

    # 合計値の目標範囲
    target_mean = sum_stats.get("mean", 132)
    target_std = sum_stats.get("std", 30)
    sum_min = target_mean - target_std
    sum_max = target_mean + target_std

    # 相関ペアスコア
    pair_boost = {}
    for (a, b), count in corr[:20]:
        pair_boost[(a, b)] = count

    # 番号帯ごとの候補
    range_groups = {
        "1-9": [n for n in range(1, 10)],
        "10-19": [n for n in range(10, 20)],
        "20-29": [n for n in range(20, 30)],
        "30-39": [n for n in range(30, 40)],
        "40-43": [n for n in range(40, 44)],
    }

    best = None
    best_score = -1

    for _ in range(1000):
        # 各番号帯から少なくとも1つ選ぶ試み
        candidate = []
        groups = list(range_groups.values())
        random.shuffle(groups)

        # まず各帯から1つずつ（5帯 → 5個）
        for group in groups[:5]:
            weighted = {n: freq.get(n, {}).get("appearance_rate", 0.01) for n in group}
            pick = _weighted_sample(weighted, k=1)
            if pick and pick[0] not in candidate:
                candidate.append(pick[0])

        # 残り1個を全体から
        remaining = [n for n in NUM_RANGE if n not in candidate]
        if remaining:
            weighted = {n: freq.get(n, {}).get("appearance_rate", 0.01) for n in remaining}
            pick = _weighted_sample(weighted, k=1)
            if pick:
                candidate.append(pick[0])

        if len(candidate) != 6:
            continue

        candidate.sort()
        total = sum(candidate)

        # スコア計算
        score = 0
        # 合計値チェック
        if sum_min <= total <= sum_max:
            score += 3
        # 奇偶チェック
        odd_count = sum(1 for n in candidate if n % 2 == 1)
        if odd_count == target_odd:
            score += 2
        # ペアボーナス
        for i in range(len(candidate)):
            for j in range(i + 1, len(candidate)):
                pair = (candidate[i], candidate[j])
                if pair in pair_boost:
                    score += pair_boost[pair] * 0.01

        if score > best_score:
            best_score = score
            best = candidate

    return best or _weighted_sample({n: freq.get(n, {}).get("appearance_rate", 0.01) for n in NUM_RANGE})


def strategy_composite(draws: list[dict], config: dict = None) -> list[int]:
    """統合戦略: 全分析のスコアを加重平均"""
    if config is None:
        config = load_config()
    weights = config.get("composite_weights", {})
    w_freq = weights.get("frequency", 0.25)
    w_dorm = weights.get("dormancy", 0.20)
    w_corr = weights.get("correlation", 0.20)
    w_trend = weights.get("trend", 0.15)
    w_balance = weights.get("balance", 0.10)
    w_weekday = weights.get("weekday", 0.10)

    recent = draws[-50:] if len(draws) > 50 else draws
    freq = frequency_analysis(recent)
    dorm = dormancy_analysis(draws)
    max_dorm = max(dorm.values()) if dorm else 1
    trend = moving_average_trend(draws, window=20)
    corr = correlation_analysis(recent, top_n=50)
    wd_trend = weekday_trend(draws)

    # 相関スコア
    corr_score = {}
    for (a, b), count in corr:
        corr_score[a] = corr_score.get(a, 0) + count
        corr_score[b] = corr_score.get(b, 0) + count
    max_corr = max(corr_score.values()) if corr_score else 1

    # 曜日スコア（次回抽選の曜日）
    today = datetime.now()
    # 次の月曜(0)か木曜(3)
    days_to_mon = (7 - today.weekday()) % 7
    days_to_thu = (3 - today.weekday()) % 7
    if days_to_mon == 0:
        days_to_mon = 7
    if days_to_thu == 0:
        days_to_thu = 7
    next_day = "月曜" if days_to_mon < days_to_thu else "木曜"

    wd_freq = wd_trend.get(next_day, {})

    # 番号帯バランススコア
    range_ideal = {
        "1-9": 9 / 43,
        "10-19": 10 / 43,
        "20-29": 10 / 43,
        "30-39": 10 / 43,
        "40-43": 4 / 43,
    }

    scores = {}
    for n in NUM_RANGE:
        f = freq.get(n, {}).get("appearance_rate", 0)
        d = dorm.get(n, 0) / max_dorm if max_dorm else 0
        c = corr_score.get(n, 0) / max_corr if max_corr else 0
        t = trend.get(n, {}).get("slope", 0)
        t_norm = (t + 1) / 2
        wd = wd_freq.get(n, {}).get("appearance_rate", 0) if wd_freq else 0
        b = 1.0  # バランスは後で調整

        scores[n] = (
            f * w_freq
            + d * w_dorm
            + c * w_corr
            + t_norm * w_trend
            + b * w_balance
            + wd * w_weekday
        )

    return _weighted_sample(scores)


STRATEGIES = {
    "hot": strategy_hot,
    "cold": strategy_cold,
    "overdue": strategy_overdue,
    "balanced": strategy_balanced,
    "composite": strategy_composite,
}

STRATEGY_NAMES = {
    "hot": "ホット",
    "cold": "コールド",
    "overdue": "出遅れ",
    "balanced": "バランス",
    "composite": "統合AI",
}


def generate_predictions(
    db_path: str = None,
    target_date: str = None,
    target_draw_id: int = None,
    config: dict = None,
    dry_run: bool = False,
) -> list[dict]:
    """5通りの予想を生成"""
    if config is None:
        config = load_config()

    draws = get_draws_for_analysis(db_path)
    if not draws:
        logger.error("分析対象のデータがありません。先に init を実行してください。")
        return []

    if target_date is None:
        target_date = _next_draw_date()
    if target_draw_id is None:
        target_draw_id = draws[-1]["id"] + 1

    logger.info("予想対象: 第%d回 (%s)", target_draw_id, target_date)

    predictions = []
    generated_sets = set()

    for strategy_name, strategy_func in STRATEGIES.items():
        # 重複チェック付きで生成
        for attempt in range(100):
            numbers = strategy_func(draws, config)
            key = tuple(numbers)
            if key not in generated_sets:
                generated_sets.add(key)
                break
        else:
            logger.warning("戦略 '%s' の一意な予想生成に失敗（リトライ上限）", strategy_name)

        prediction = {
            "target_draw_id": target_draw_id,
            "target_draw_date": target_date,
            "strategy": strategy_name,
            "num1": numbers[0],
            "num2": numbers[1],
            "num3": numbers[2],
            "num4": numbers[3],
            "num5": numbers[4],
            "num6": numbers[5],
        }
        predictions.append(prediction)

    # DB保存
    if not dry_run:
        conn = get_connection(db_path)
        try:
            for pred in predictions:
                pred["id"] = insert_prediction(conn, pred)
            conn.commit()
            logger.info("予想をDBに保存しました")
        finally:
            conn.close()

    return predictions


def _next_draw_date() -> str:
    """次の抽選日（月曜 or 木曜）を返す"""
    today = datetime.now()
    weekday = today.weekday()

    # 月曜=0, 木曜=3
    days_to_mon = (7 - weekday) % 7
    days_to_thu = (3 - weekday) % 7
    if days_to_mon == 0:
        days_to_mon = 7
    if days_to_thu == 0:
        days_to_thu = 7

    next_days = min(days_to_mon, days_to_thu)
    next_date = today + timedelta(days=next_days)
    return next_date.strftime("%Y-%m-%d")


def format_predictions(predictions: list[dict]) -> str:
    """予想結果をフォーマットして文字列で返す"""
    if not predictions:
        return "予想データがありません。"

    target = predictions[0]
    lines = [
        f"🎯 ロト6予想 第{target['target_draw_id']}回（{target['target_draw_date']}）",
        "",
    ]

    labels = ["①", "②", "③", "④", "⑤"]
    for i, pred in enumerate(predictions):
        name = STRATEGY_NAMES.get(pred["strategy"], pred["strategy"])
        nums = f"{pred['num1']:2d} {pred['num2']:2d} {pred['num3']:2d} {pred['num4']:2d} {pred['num5']:2d} {pred['num6']:2d}"
        label = labels[i] if i < len(labels) else f"⑥"
        lines.append(f"{label} {name:6s}: {nums}")

    lines.append("")
    lines.append("⚠️ 本予想は統計分析に基づく参考値です。当選を保証するものではありません。")
    return "\n".join(lines)
