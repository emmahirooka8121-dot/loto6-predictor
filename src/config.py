"""設定ファイル読み込みモジュール"""

import os
import yaml
import logging

logger = logging.getLogger(__name__)

DEFAULT_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "config.yaml",
)


def load_config(config_path: str = None) -> dict:
    """config.yaml を読み込んで辞書で返す"""
    path = config_path or DEFAULT_CONFIG_PATH
    if not os.path.exists(path):
        logger.warning("設定ファイルが見つかりません: %s（デフォルト値を使用）", path)
        return _default_config()
    with open(path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    return config or _default_config()


def save_config(config: dict, config_path: str = None) -> None:
    """設定を config.yaml に書き戻す"""
    path = config_path or DEFAULT_CONFIG_PATH
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
    logger.info("設定ファイルを更新しました: %s", path)


def get_project_root() -> str:
    """プロジェクトルートのパスを返す"""
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_db_path(config: dict = None) -> str:
    """データベースファイルのパスを返す"""
    if config is None:
        config = load_config()
    db_rel = config.get("database", {}).get("path", "data/loto6.db")
    return os.path.join(get_project_root(), db_rel)


def _default_config() -> dict:
    return {
        "database": {"path": "data/loto6.db"},
        "analysis_periods": [10, 20, 50, 100, "all"],
        "composite_weights": {
            "frequency": 0.25,
            "dormancy": 0.20,
            "correlation": 0.20,
            "trend": 0.15,
            "balance": 0.10,
            "weekday": 0.10,
        },
        "strategy_weights": {
            "hot": {"frequency": 0.6, "trend": 0.3, "correlation": 0.1},
            "cold": {"inverse_frequency": 0.7, "dormancy": 0.3},
            "overdue": {"dormancy": 0.7, "inverse_frequency": 0.3},
        },
        "scraper": {
            "user_agent": "Loto6Predictor/1.0 (personal-use)",
            "max_retries": 3,
            "retry_delay": 1,
            "request_interval": 1,
        },
        "logging": {"level": "INFO", "log_dir": "logs"},
        "web": {"port": 8080, "host": "0.0.0.0"},
        "tuner": {"min_samples": 20},
    }
