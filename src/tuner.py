"""重みパラメータ自動調整モジュール"""

import json
import logging

from src.config import load_config, save_config
from src.database import (
    get_connection,
    get_strategy_stats,
    get_verification_stats,
    insert_weight_history,
)

logger = logging.getLogger(__name__)


def tune_weights(db_path: str = None, config: dict = None, min_samples: int = 20) -> dict:
    """検証結果から重みパラメータを自動調整"""
    if config is None:
        config = load_config()

    stats = get_verification_stats(db_path)
    if not stats or stats.get("total", 0) < min_samples:
        logger.warning(
            "サンプル数が不足しています（現在: %d, 必要: %d）",
            stats.get("total", 0) if stats else 0,
            min_samples,
        )
        return {}

    strategy_stats = get_strategy_stats(db_path)
    if not strategy_stats:
        logger.warning("戦略別統計データがありません")
        return {}

    logger.info("重み調整を開始 (サンプル数: %d)", stats["total"])

    # 各戦略の平均一致数を取得
    strategy_scores = {}
    for s in strategy_stats:
        strategy_scores[s["strategy"]] = {
            "avg_match": s["avg_match"],
            "max_match": s["max_match"],
            "total": s["total"],
        }

    # composite戦略の重みを調整
    # 成績の良い要素の重みを増やす
    current_weights = config.get("composite_weights", {})
    new_weights = _optimize_composite_weights(strategy_scores, current_weights)

    # config.yaml に書き戻し
    config["composite_weights"] = new_weights
    save_config(config)

    # weight_history に記録
    conn = get_connection(db_path)
    try:
        avg_score = stats.get("avg_match", 0)
        insert_weight_history(conn, "composite", new_weights, avg_score)
        conn.commit()
    finally:
        conn.close()

    logger.info("重み調整完了:")
    for k, v in new_weights.items():
        logger.info("  %s: %.3f", k, v)

    return new_weights


def _optimize_composite_weights(strategy_scores: dict, current_weights: dict) -> dict:
    """戦略の成績に基づいてcomposite重みを最適化"""
    # 戦略 → 重み要素のマッピング
    strategy_factor_map = {
        "hot": "frequency",
        "cold": "dormancy",
        "overdue": "dormancy",
        "balanced": "balance",
        "composite": "correlation",
    }

    # 基本重み要素
    weight_keys = ["frequency", "dormancy", "correlation", "trend", "balance", "weekday"]
    new_weights = {k: current_weights.get(k, 1.0 / len(weight_keys)) for k in weight_keys}

    # 戦略の成績に基づいて関連要素の重みを調整
    total_avg = sum(s["avg_match"] for s in strategy_scores.values()) / len(strategy_scores) if strategy_scores else 0

    for strategy, scores in strategy_scores.items():
        factor = strategy_factor_map.get(strategy)
        if factor and factor in new_weights:
            # 成績が平均より良い場合は重みを増やす
            ratio = scores["avg_match"] / total_avg if total_avg > 0 else 1.0
            adjustment = 0.9 + 0.2 * min(ratio, 2.0)  # 0.9 ~ 1.3
            new_weights[factor] *= adjustment

    # 正規化（合計が1.0になるように）
    total = sum(new_weights.values())
    if total > 0:
        new_weights = {k: round(v / total, 4) for k, v in new_weights.items()}

    return new_weights


def format_tune_results(new_weights: dict, strategy_stats: list[dict]) -> str:
    """調整結果をフォーマット"""
    lines = ["📊 重みパラメータ調整結果", ""]

    if strategy_stats:
        lines.append("【戦略別成績】")
        for s in strategy_stats:
            lines.append(
                f"  {s['strategy']:12s}: 平均一致 {s['avg_match']:.2f} "
                f"(最大 {s['max_match']}) [{s['total']}回]"
            )
        lines.append("")

    if new_weights:
        lines.append("【新しい重み (composite)】")
        for k, v in new_weights.items():
            lines.append(f"  {k:12s}: {v:.4f}")
    else:
        lines.append("重みの調整は行われませんでした。")

    return "\n".join(lines)
