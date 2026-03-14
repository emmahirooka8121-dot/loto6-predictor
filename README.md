# Loto6 Predictor — ロト6自動予測アプリケーション

ロト6の過去当選番号を統計分析し、5つの異なる戦略で予想番号を自動生成するPythonアプリケーションです。

> **⚠️ 免責事項**: ロト6は完全にランダムな抽選です。本アプリは統計的な傾向に基づく参考値を生成するもので、当選を保証するものではありません。

## クイックスタート

```bash
# 1. 依存関係をインストール
pip install -r requirements.txt

# 2. 初期セットアップ（DBスキーマ作成 + 全データ取得）
python -m src.main init

# 3. 予想番号を生成
python -m src.main predict
```

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `python -m src.main init` | 初期セットアップ（DBスキーマ作成＋全データ取得） |
| `python -m src.main update` | 最新の抽選結果を差分取得 |
| `python -m src.main predict` | 次回抽選の予想番号を5通り生成 |
| `python -m src.main predict --dry-run` | DB保存せずに予想を表示 |
| `python -m src.main predict --target-date 2024-06-01` | 日付を指定して予想 |
| `python -m src.main verify` | 最新の抽選結果と予想を照合 |
| `python -m src.main verify --draw-id 1999` | 特定の回号を検証 |
| `python -m src.main stats` | 的中率サマリーと統計レポート |
| `python -m src.main stats --last 50` | 直近50回分の統計 |
| `python -m src.main tune` | 検証結果から重みパラメータを自動調整 |
| `python -m src.main serve` | Webダッシュボード起動（port 8080） |
| `python -m src.main serve --port 3000` | ポートを指定して起動 |
| `python -m src.main run-scheduled` | 予想生成＋通知（cron用） |
| `python -m src.main version` | バージョン表示 |

詳細ログを表示するには `-v` フラグを追加:
```bash
python -m src.main -v predict
```

## 5つの予想戦略

1. **ホット (hot)** — 直近50回の出現頻度上位＋トレンド重視
2. **コールド (cold)** — 出現頻度が平均以下、平均回帰を狙う
3. **出遅れ (overdue)** — 長期間出現していない番号を重視
4. **バランス (balanced)** — 奇偶バランス、番号帯分散、合計値を最適化
5. **統合AI (composite)** — 全分析のスコアを加重平均で統合

## cron設定

`crontab -e` で以下を追加:

```cron
# 抽選前日（日曜・水曜）の正午に予想生成
0 12 * * 0,3 cd /path/to/loto6-predictor && /usr/bin/python3 -m src.main run-scheduled >> logs/cron.log 2>&1

# 抽選当日（月曜・木曜）の20:30に結果取得＋検証
30 20 * * 1,4 cd /path/to/loto6-predictor && /usr/bin/python3 -m src.main verify >> logs/cron.log 2>&1

# 月初に重みの自動調整
0 9 1 * * cd /path/to/loto6-predictor && /usr/bin/python3 -m src.main tune >> logs/cron.log 2>&1
```

## Docker

```bash
# ビルド＆起動
docker-compose up -d

# 初期セットアップ
docker-compose exec loto6 python -m src.main init

# 予想生成
docker-compose exec loto6 python -m src.main predict
```

## 通知設定

`.env.example` をコピーして `.env` を作成し、必要な設定を記入:

```bash
cp .env.example .env
```

対応チャネル:
- **LINE Notify**: `LINE_NOTIFY_TOKEN` を設定
- **Slack**: `SLACK_WEBHOOK_URL` を設定
- **メール**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_TO` を設定

未設定の場合はコンソール出力のみで、エラーにはなりません。

## config.yaml パラメータ

| パラメータ | 説明 | デフォルト |
|-----------|------|-----------|
| `database.path` | SQLiteファイルパス | `data/loto6.db` |
| `analysis_periods` | 分析期間（回数） | `[10, 20, 50, 100, "all"]` |
| `composite_weights.*` | 統合戦略の重み | frequency=0.25 等 |
| `strategy_weights.*` | 各戦略の内部重み | 戦略ごとに異なる |
| `scraper.max_retries` | HTTP最大リトライ数 | 3 |
| `web.port` | ダッシュボードポート | 8080 |
| `tuner.min_samples` | 自動調整の最低サンプル数 | 20 |

## テスト

```bash
python -m pytest tests/ -v
```

## ライセンス

MIT License
