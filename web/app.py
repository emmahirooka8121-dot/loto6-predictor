"""Flask Webダッシュボード"""

import json
import os
import sys

from flask import Flask, jsonify, render_template

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def create_app(db_path: str = None) -> Flask:
    app = Flask(__name__)

    @app.route("/")
    def index():
        from src.analyzer import full_analysis
        from src.database import get_draws_count, get_latest_predictions

        predictions = get_latest_predictions(db_path)
        total = get_draws_count(db_path)
        analysis = full_analysis(db_path, period=50)

        # 出遅れTOP5
        dorm = analysis.get("dormancy", {})
        top_overdue = sorted(dorm.items(), key=lambda x: x[1], reverse=True)[:5] if dorm else []

        # ホット番号
        freq = analysis.get("frequency", {})
        hot_nums = sorted(freq.items(), key=lambda x: x[1].get("appearance_rate", 0), reverse=True)[:5] if freq else []

        sum_stats = analysis.get("sum_stats", {})

        return render_template(
            "index.html",
            predictions=predictions,
            total_draws=total,
            top_overdue=top_overdue,
            hot_nums=hot_nums,
            sum_stats=sum_stats,
        )

    @app.route("/history")
    def history():
        from src.database import get_connection

        conn = get_connection(db_path)
        try:
            rows = conn.execute("""
                SELECT p.*, v.matched_count, v.bonus_match, v.prize_tier
                FROM predictions p
                LEFT JOIN verifications v ON v.prediction_id = p.id
                ORDER BY p.id DESC
                LIMIT 100
            """).fetchall()
            predictions = [dict(r) for r in rows]
        finally:
            conn.close()

        return render_template("history.html", predictions=predictions)

    @app.route("/analysis")
    def analysis_page():
        from src.analyzer import full_analysis

        analysis = full_analysis(db_path)
        freq = analysis.get("frequency", {})
        freq_list = sorted(freq.items(), key=lambda x: int(x[0]))
        range_dist = analysis.get("range_dist", {})
        odd_even = analysis.get("odd_even", {})
        sum_stats = analysis.get("sum_stats", {})

        return render_template(
            "analysis.html",
            freq_list=freq_list,
            range_dist=range_dist,
            odd_even=odd_even,
            sum_stats=sum_stats,
        )

    @app.route("/api/predictions")
    def api_predictions():
        from src.database import get_latest_predictions
        return jsonify(get_latest_predictions(db_path))

    @app.route("/api/stats")
    def api_stats():
        from src.database import get_draws_count, get_strategy_stats, get_verification_stats
        return jsonify({
            "total_draws": get_draws_count(db_path),
            "verification": get_verification_stats(db_path),
            "strategies": get_strategy_stats(db_path),
        })

    return app
