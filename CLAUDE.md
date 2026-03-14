# Loto6 Predictor — Project Memory

## プロジェクト概要
ロト6の過去当選番号を分析し、統計的傾向に基づく予想番号を自動生成するブラウザアプリ（HTML/CSS/JS、サーバー不要）。
検証結果から自動学習し、次回予想の精度を向上させる機能を持つ。

## 技術スタック
- HTML5 + CSS3 + Vanilla JavaScript（フレームワーク不要）
- Chart.js（CDN）でグラフ描画
- localStorage でデータ永続化
- PWA対応（オフライン動作可能）
- GitHub Pages でホスティング

## 重要な設計判断
- サーバーサイド不要、すべてブラウザ内で完結
- 過去データは js/data.js にJSON形式で内蔵（210回分）
- ユーザーが手動で最新の抽選結果を追加可能
- 予想・検証結果は localStorage に保存
- 検証のたびに各戦略の成績を分析し、重みパラメータを自動調整（js/learner.js）
- モバイルファースト設計（タッチ操作最適化）
- ダークテーマ対応

## ファイル構成
- index.html — メインSPA
- css/style.css — モバイルファーストCSS
- js/app.js — アプリエントリーポイント・全画面描画
- js/data.js — 過去当選番号データ（210回分）
- js/analyzer.js — 統計分析エンジン
- js/predictor.js — 予想番号生成（5戦略）
- js/verifier.js — 的中検証
- js/learner.js — 自動学習エンジン
- js/storage.js — localStorage操作
- js/charts.js — Chart.js グラフ描画
- js/utils.js — ユーティリティ関数
- manifest.json + sw.js — PWA対応
- icons/ — PWAアイコン

## Python CLI（レガシー）
- src/ — Pythonバックエンドモジュール
- tests/ — pytest テスト
- `python -m pytest tests/ -v` でテスト実行
