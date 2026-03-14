# Loto6 AI Predictor — Project Memory

## 概要
ロト6の過去当選番号を分析し、複数のAIアルゴリズム（モンテカルロ、遺伝的アルゴリズム、
焼きなまし法、エントロピー最適化等）を統合して予想番号を生成するブラウザアプリ。
検証結果から自動学習し精度を向上させる。

## 技術スタック
- HTML5 + CSS3 + Vanilla JavaScript（フレームワーク不要）
- Chart.js（CDN）でグラフ描画
- qrcode.js（CDN）でQRコード生成
- localStorage でデータ永続化
- PWA対応（オフライン動作可能）
- GitHub Pages でホスティング

## デザイン
- モバイルファースト、ダークテーマ
- ユーザー向けテキスト: textarea readonly でコピー可能に

## 重要な設計判断
- サーバーサイド不要、すべてブラウザ内で完結
- 過去データは js/data.js にJSON形式で内蔵（210回分）
- ユーザーが手動で最新の抽選結果を追加可能
- 予想・検証結果は localStorage に保存
- 検証のたびに各戦略の成績を分析し、重みパラメータW1〜W12を自動調整（js/learner.js）
- モバイルファースト設計（タッチ操作最適化）
- ダークテーマ対応

## ファイル構成
- index.html — メインSPA（7タブ）
- css/style.css — モバイルファーストCSS
- js/app.js — アプリエントリーポイント・全画面描画
- js/data.js — 過去当選番号データ（210回分）
- js/analyzer.js — 統計分析エンジン（12種類の分析）
- js/ai-engine.js — AIアルゴリズム群（MC、GA、SA、エントロピー等）
- js/predictor.js — 予想番号生成（5通り＋ポートフォリオ最適化）
- js/scheduler.js — スケジューラー（前日正午自動生成＋ロック）
- js/verifier.js — 的中検証
- js/learner.js — 自動学習エンジン（W1〜W12）
- js/backtest.js — バックテストエンジン
- js/storage.js — localStorage操作
- js/charts.js — Chart.js グラフ描画（ヒートマップ、推移グラフ含む）
- js/utils.js — ユーティリティ関数
- manifest.json + sw.js — PWA対応
- icons/ — PWAアイコン

## fitness関数（12要素）
W1=freq(0.16), W2=dormancy(0.12), W3=entropy(0.08), W4=oddEven(0.08),
W5=sumBalance(0.08), W6=spread(0.07), W7=range(0.07), W8=correlation(0.08),
W9=trend(0.07), W10=weekday(0.05), W11=cycle(0.07), W12=triplet(0.07)

## Python CLI（レガシー）
- src/ — Pythonバックエンドモジュール
- tests/ — pytest テスト
- `python -m pytest tests/ -v` でテスト実行
