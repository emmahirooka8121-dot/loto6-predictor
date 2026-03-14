"""的中検証モジュール"""

import json
import logging

from src.database import (
    get_connection,
    get_draw_by_id,
    get_latest_draw_id,
    get_predictions_for_draw,
    insert_verification,
)
from src.scraper import fetch_latest_draws

logger = logging.getLogger(__name__)


def determine_prize_tier(matched_count: int, bonus_match: bool) -> str:
    """当選等級を判定"""
    if matched_count == 6:
        return "1等"
    elif matched_count == 5 and bonus_match:
        return "2等"
    elif matched_count == 5:
        return "3等"
    elif matched_count == 4:
        return "4等"
    elif matched_count == 3:
        return "5等"
    else:
        return "ハズレ"


def verify_prediction(prediction: dict, draw: dict) -> dict:
    """予想と抽選結果を照合"""
    pred_nums = set([
        prediction["num1"], prediction["num2"], prediction["num3"],
        prediction["num4"], prediction["num5"], prediction["num6"],
    ])
    draw_nums = set([
        draw["num1"], draw["num2"], draw["num3"],
        draw["num4"], draw["num5"], draw["num6"],
    ])

    matched = pred_nums & draw_nums
    matched_count = len(matched)
    bonus_match = draw["bonus"] in pred_nums

    prize_tier = determine_prize_tier(matched_count, bonus_match)

    return {
        "prediction_id": prediction["id"],
        "draw_id": draw["id"],
        "matched_count": matched_count,
        "matched_numbers": json.dumps(sorted(matched)),
        "bonus_match": 1 if bonus_match else 0,
        "prize_tier": prize_tier,
    }


def verify_latest(db_path: str = None, config: dict = None) -> list[dict]:
    """最新の抽選結果で予想を検証"""
    # まずデータを更新
    logger.info("最新データを取得中...")
    fetch_latest_draws(config, db_path)

    latest_id = get_latest_draw_id(db_path)
    if latest_id == 0:
        logger.error("抽選データがありません")
        return []

    draw = get_draw_by_id(latest_id, db_path)
    if not draw:
        logger.error("回号 %d のデータが見つかりません", latest_id)
        return []

    # 該当回の予想を取得
    predictions = get_predictions_for_draw(draw_id=latest_id, db_path=db_path)
    if not predictions:
        # 日付でも検索
        predictions = get_predictions_for_draw(draw_date=draw["draw_date"], db_path=db_path)

    if not predictions:
        logger.warning("第%d回の予想データがありません", latest_id)
        return []

    logger.info("第%d回 (%s) の検証を実行", latest_id, draw["draw_date"])

    results = []
    conn = get_connection(db_path)
    try:
        for pred in predictions:
            result = verify_prediction(pred, draw)
            insert_verification(conn, result)
            results.append(result)
        conn.commit()
    finally:
        conn.close()

    return results


def verify_draw(draw_id: int, db_path: str = None) -> list[dict]:
    """特定回号の検証"""
    draw = get_draw_by_id(draw_id, db_path)
    if not draw:
        logger.error("回号 %d のデータが見つかりません", draw_id)
        return []

    predictions = get_predictions_for_draw(draw_id=draw_id, db_path=db_path)
    if not predictions:
        predictions = get_predictions_for_draw(draw_date=draw["draw_date"], db_path=db_path)

    if not predictions:
        logger.warning("第%d回の予想データがありません", draw_id)
        return []

    results = []
    conn = get_connection(db_path)
    try:
        for pred in predictions:
            result = verify_prediction(pred, draw)
            insert_verification(conn, result)
            results.append(result)
        conn.commit()
    finally:
        conn.close()

    return results


def format_verification_results(results: list[dict], draw: dict = None) -> str:
    """検証結果をフォーマット"""
    if not results:
        return "検証結果がありません。"

    lines = []
    if draw:
        draw_nums = f"{draw['num1']:2d} {draw['num2']:2d} {draw['num3']:2d} {draw['num4']:2d} {draw['num5']:2d} {draw['num6']:2d}"
        lines.append(f"📊 第{draw['id']}回 抽選結果: {draw_nums} (B:{draw['bonus']:2d})")
        lines.append("")

    from src.predictor import STRATEGY_NAMES

    for result in results:
        matched_nums = json.loads(result["matched_numbers"]) if result["matched_numbers"] else []
        bonus_str = " +B" if result["bonus_match"] else ""
        lines.append(
            f"  一致: {result['matched_count']}個{bonus_str} → {result['prize_tier']}"
            f"  (一致番号: {matched_nums})"
        )

    lines.append("")
    lines.append("⚠️ 本予想は統計分析に基づく参考値です。当選を保証するものではありません。")
    return "\n".join(lines)
