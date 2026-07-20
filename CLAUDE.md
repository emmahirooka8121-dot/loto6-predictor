# 太陽とひまわり訪問看護 公式サイト — Project Memory

## プロジェクト概要
大阪市生野区の訪問看護ステーション「太陽とひまわり訪問看護」の公式ホームページ。
3ページ構成（TOP・利用者募集・お問い合わせ）の静的サイトで、Cloudflare Pages で公開する。

> 注：このブランチ（`claude/taiyou-himawari-homepage-*`）は訪問看護サイト専用です。
> ロト6予測アプリは別ブランチ（`claude/lotto-prediction-app-*`）に保存されています。

## 技術スタック
- HTML5 + CSS3 + Vanilla JavaScript（フレームワーク不使用）
- Google Fonts「Noto Sans JP」
- Cloudflare Pages でホスティング（ビルド不要、ルート直下の index.html を配置）

## 重要な設計判断
- サーバーサイド不要、完全な静的サイト
- ページ間リンクはすべて相対パス
- レスポンシブ（モバイルファースト）
- テーマカラーは「太陽とひまわり」＝ひまわりイエロー #FFC93C を中心とした温かい配色
- 高齢の閲覧者を想定し本文16px以上・十分なコントラスト
- スマホでは画面下部に「電話をかける」固定ボタン（tel:リンク）を全ページ表示
- 画像は placehold.co のプレースホルダー。差し替え箇所は HTML コメントで明記

## ファイル構成
- index.html — TOPページ
- recruit.html — 利用者募集ページ
- contact.html — お問い合わせページ（電話のみ、フォームなし）
- css/style.css — 全ページ共通CSS
- js/script.js — 全ページ共通JS（ナビのactive制御・年号自動更新など）

## 基本情報
- 事業所名：太陽とひまわり訪問看護
- 住所：〒544-0002 大阪府大阪市生野区小路東5-11-1
- 電話：06-6641-0661（tel:0666410661）
- 対応エリア：大阪市全般

## SEO
- 各ページの title / meta description に「訪問看護 生野区」「大阪市 訪問看護」を含める
- 全ページ OGP 設定済み
- index.html に LocalBusiness の JSON-LD 構造化データ
