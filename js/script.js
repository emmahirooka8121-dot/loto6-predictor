/* =====================================================
   太陽とひまわり訪問看護 — 共通スクリプト
   全ページ共通で読み込む
   ===================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    // 現在のページに対応するナビゲーションリンクをハイライト
    highlightCurrentNav();

    // フッターのコピーライト年を自動更新
    updateCopyrightYear();

    // ページ内アンカーのスムーススクロール(ヘッダー高さを考慮)
    setupSmoothScroll();
  });

  /**
   * 現在表示中のページに一致するグローバルナビへ .active を付与
   */
  function highlightCurrentNav() {
    var path = window.location.pathname.split('/').pop();
    if (!path) {
      path = 'index.html';
    }
    var links = document.querySelectorAll('.nav-list a');
    links.forEach(function (link) {
      var href = link.getAttribute('href');
      if (href === path) {
        link.classList.add('active');
      }
    });
  }

  /**
   * フッターの年号(data-year 属性を持つ要素)を現在の年に更新
   */
  function updateCopyrightYear() {
    var el = document.querySelector('[data-year]');
    if (el) {
      el.textContent = new Date().getFullYear();
    }
  }

  /**
   * ページ内リンク(#で始まるアンカー)のスムーススクロール。
   * sticky ヘッダーに隠れないようオフセットを付与。
   */
  function setupSmoothScroll() {
    var header = document.querySelector('.site-header');
    var anchors = document.querySelectorAll('a[href^="#"]');
    anchors.forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var targetId = anchor.getAttribute('href');
        if (targetId === '#' || targetId.length < 2) {
          return;
        }
        var target = document.querySelector(targetId);
        if (!target) {
          return;
        }
        e.preventDefault();
        var offset = header ? header.offsetHeight : 0;
        var top = target.getBoundingClientRect().top + window.pageYOffset - offset - 12;
        window.scrollTo({ top: top, behavior: 'smooth' });
      });
    });
  }
})();
