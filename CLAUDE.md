# Loto6 Predictor — Project Memory

## プロジェクト概要
ロト6の過去当選番号を分析し、統計的傾向に基づく予想番号を自動生成するPythonアプリ。

## 技術スタック
- Python 3.11+
- SQLite（データ永続化）
- requests + BeautifulSoup（データ取得）
- Flask（オプション: ダッシュボード）
- pytest（テスト）
- Docker対応

## ディレクトリ構成
loto6-predictor/ 以下にすべてのソースを配置。
src/ にメインロジック、web/ にダッシュボード、tests/ にテスト。

## コマンド体系
- `python -m src.main init` — 初期セットアップ（DBスキーマ作成＋全データ取得）
- `python -m src.main update` — 最新データを差分取得
- `python -m src.main predict` — 次回抽選の予想番号を5通り生成
- `python -m src.main verify` — 直前の抽選結果を取得し、予想と照合
- `python -m src.main stats` — 的中率サマリーと分析レポート表示
- `python -m src.main tune` — 過去の的中結果から重みパラメータを自動調整
- `python -m src.main serve` — Webダッシュボード起動 (port 8080)
- `python -m src.main run-scheduled` — predict + 通知（cronから呼ぶ用）

## 重要な設計判断
- データソースはCSV直接取得を優先（スクレイピング回避）
- 連番も確率的に妥当なら許容する
- 5通りの予想は互いに重複しない
- 通知設定は.envファイルで管理、未設定ならスキップ

## テスト実行
```bash
python -m pytest tests/ -v
```

## ビルド・起動
```bash
pip install -r requirements.txt
python -m src.main init
python -m src.main predict
```
