"""ロト6予測アプリ CLIエントリーポイント"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler

from src import __version__
from src.config import get_project_root, load_config


def setup_logging(verbose: bool = False) -> None:
    """ログ設定"""
    config = load_config()
    log_cfg = config.get("logging", {})
    level = logging.DEBUG if verbose else getattr(logging, log_cfg.get("level", "INFO"))
    log_dir = os.path.join(get_project_root(), log_cfg.get("log_dir", "logs"))
    os.makedirs(log_dir, exist_ok=True)

    log_file = os.path.join(log_dir, f"loto6_{datetime.now().strftime('%Y%m%d')}.log")

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # ファイルハンドラ
    file_handler = TimedRotatingFileHandler(
        log_file, when="midnight", interval=1, backupCount=30, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)

    # コンソールハンドラ
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)


def cmd_init(args) -> None:
    """初期セットアップ"""
    from src.database import init_schema
    from src.scraper import fetch_all_draws

    logger = logging.getLogger(__name__)
    logger.info("=== 初期セットアップ開始 ===")

    # DBスキーマ作成
    init_schema()
    logger.info("データベーススキーマを作成しました")

    # 全データ取得
    count = fetch_all_draws()
    logger.info("初期データ取得完了: %d 件", count)
    logger.info("=== 初期セットアップ完了 ===")


def cmd_update(args) -> None:
    """データ更新"""
    from src.scraper import fetch_latest_draws

    logger = logging.getLogger(__name__)
    logger.info("=== データ更新開始 ===")
    count = fetch_latest_draws()
    logger.info("更新完了: %d 件の新規データ", count)


def cmd_predict(args) -> None:
    """予想番号生成"""
    from src.predictor import format_predictions, generate_predictions

    logger = logging.getLogger(__name__)
    logger.info("=== 予想番号生成 ===")

    predictions = generate_predictions(
        target_date=args.target_date,
        dry_run=args.dry_run,
    )

    output = format_predictions(predictions)
    print(output)

    # JSONファイルにも出力
    if not args.dry_run and predictions:
        _save_predictions_json(predictions)


def cmd_verify(args) -> None:
    """的中検証"""
    from src.database import get_draw_by_id, get_latest_draw_id
    from src.verifier import format_verification_results, verify_draw, verify_latest

    logger = logging.getLogger(__name__)
    logger.info("=== 的中検証 ===")

    if args.draw_id:
        results = verify_draw(args.draw_id)
        draw = get_draw_by_id(args.draw_id)
    else:
        results = verify_latest()
        latest_id = get_latest_draw_id()
        draw = get_draw_by_id(latest_id) if latest_id else None

    output = format_verification_results(results, draw)
    print(output)


def cmd_stats(args) -> None:
    """統計レポート"""
    from src.analyzer import full_analysis
    from src.database import get_draws_count, get_strategy_stats, get_verification_stats

    logger = logging.getLogger(__name__)
    logger.info("=== 統計レポート ===")

    total_draws = get_draws_count()
    v_stats = get_verification_stats(last_n=args.last)
    s_stats = get_strategy_stats()
    analysis = full_analysis(period=args.last)

    print(f"📊 ロト6統計レポート")
    print(f"{'='*50}")
    print(f"総抽選データ数: {total_draws}")
    print()

    if v_stats and v_stats.get("total"):
        print("【的中統計】")
        print(f"  検証数:     {v_stats['total']}")
        print(f"  平均一致数: {v_stats['avg_match']:.2f}")
        print(f"  最大一致数: {v_stats['max_match']}")
        print(f"  3個以上:    {v_stats['hits_3plus']} ({v_stats['hits_3plus']/v_stats['total']*100:.1f}%)")
        print(f"  4個以上:    {v_stats['hits_4plus']} ({v_stats['hits_4plus']/v_stats['total']*100:.1f}%)")
        print()

    if s_stats:
        print("【戦略別成績】")
        for s in s_stats:
            print(
                f"  {s['strategy']:12s}: 平均 {s['avg_match']:.2f} "
                f"(最大 {s['max_match']}) [{s['total']}回]"
            )
        print()

    if analysis:
        # 出遅れTOP5
        dorm = analysis.get("dormancy", {})
        if dorm:
            top_overdue = sorted(dorm.items(), key=lambda x: x[1], reverse=True)[:5]
            print("【出遅れTOP5】")
            for num, count in top_overdue:
                print(f"  番号 {num:2d}: {count}回不出")
            print()

        # 合計値統計
        ss = analysis.get("sum_stats", {})
        if ss:
            print("【合計値統計】")
            print(f"  平均: {ss['mean']}  中央値: {ss['median']}  標準偏差: {ss['std']}")
            print(f"  範囲: {ss['min']} 〜 {ss['max']}")
            print()

    print("⚠️ 本データは統計分析に基づく参考値です。当選を保証するものではありません。")


def cmd_tune(args) -> None:
    """重み自動調整"""
    from src.database import get_strategy_stats
    from src.tuner import format_tune_results, tune_weights

    logger = logging.getLogger(__name__)
    logger.info("=== 重みパラメータ自動調整 ===")

    new_weights = tune_weights(min_samples=args.min_samples)
    s_stats = get_strategy_stats()
    output = format_tune_results(new_weights, s_stats)
    print(output)


def cmd_serve(args) -> None:
    """Webダッシュボード起動"""
    from web.app import create_app

    logger = logging.getLogger(__name__)
    port = args.port
    logger.info("Webダッシュボードを起動します (port %d)", port)
    app = create_app()
    app.run(host="0.0.0.0", port=port, debug=False)


def cmd_run_scheduled(args) -> None:
    """スケジュール実行（予想生成＋通知）"""
    from src.notifier import send_notification
    from src.predictor import format_predictions, generate_predictions
    from src.scraper import fetch_latest_draws

    logger = logging.getLogger(__name__)
    logger.info("=== スケジュール実行 ===")

    # データ更新
    fetch_latest_draws()

    # 予想生成
    predictions = generate_predictions()
    output = format_predictions(predictions)

    # 通知
    send_notification(output)

    # JSON保存
    if predictions:
        _save_predictions_json(predictions)

    logger.info("スケジュール実行完了")


def cmd_version(args) -> None:
    """バージョン表示"""
    print(f"Loto6 Predictor v{__version__}")


def _save_predictions_json(predictions: list[dict]) -> None:
    """予想結果をJSONファイルに保存"""
    output_dir = os.path.join(get_project_root(), "output")
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "predictions.json")

    # 既存データを読み込み
    existing = []
    if os.path.exists(output_file):
        try:
            with open(output_file, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except (json.JSONDecodeError, IOError):
            existing = []

    # 追記
    for pred in predictions:
        entry = {k: v for k, v in pred.items()}
        entry["created_at"] = datetime.now().isoformat()
        existing.append(entry)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(
        prog="loto6",
        description="ロト6自動予測アプリケーション",
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="詳細ログ出力")
    subparsers = parser.add_subparsers(dest="command", help="コマンド")

    # init
    subparsers.add_parser("init", help="初期セットアップ（DBスキーマ作成＋全データ取得）")

    # update
    subparsers.add_parser("update", help="最新の抽選結果を差分取得")

    # predict
    p_predict = subparsers.add_parser("predict", help="次回抽選の予想番号を5通り生成")
    p_predict.add_argument("--target-date", help="対象抽選日 (YYYY-MM-DD)")
    p_predict.add_argument("--dry-run", action="store_true", help="DB保存せずに表示のみ")

    # verify
    p_verify = subparsers.add_parser("verify", help="最新の抽選結果と予想を照合")
    p_verify.add_argument("--draw-id", type=int, help="特定の回号を検証")

    # stats
    p_stats = subparsers.add_parser("stats", help="的中率サマリーと統計レポート")
    p_stats.add_argument("--last", type=int, help="直近N回分を対象")

    # tune
    p_tune = subparsers.add_parser("tune", help="検証結果から重みパラメータを自動調整")
    p_tune.add_argument("--min-samples", type=int, default=20, help="最低サンプル数")

    # serve
    p_serve = subparsers.add_parser("serve", help="Webダッシュボード起動")
    p_serve.add_argument("--port", type=int, default=8080, help="ポート番号")

    # run-scheduled
    subparsers.add_parser("run-scheduled", help="予想生成＋通知（cron用）")

    # version
    subparsers.add_parser("version", help="バージョン表示")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    setup_logging(verbose=args.verbose)

    commands = {
        "init": cmd_init,
        "update": cmd_update,
        "predict": cmd_predict,
        "verify": cmd_verify,
        "stats": cmd_stats,
        "tune": cmd_tune,
        "serve": cmd_serve,
        "run-scheduled": cmd_run_scheduled,
        "version": cmd_version,
    }

    cmd_func = commands.get(args.command)
    if cmd_func:
        try:
            cmd_func(args)
        except Exception as e:
            logging.getLogger(__name__).error("エラー: %s", e, exc_info=True)
            sys.exit(1)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
