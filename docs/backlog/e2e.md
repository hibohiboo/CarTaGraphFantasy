---
title: E2E テストの導入
status: 完了
summary: 実ブラウザでアプリの全画面を開くテストを CI で回し、スクリーンショット付きのレポートを GitHub Pages で見られるようにする。
plans:
  - 2026-09-21-e2e導入.md
cycles:
  - { name: Playwright の導入とレポートの公開, status: 完了, pr: 3 }
updated: 2026-09-21
---

# E2E テストの導入

Playwright で、ルート一覧（サイトマップ）の全画面を実ブラウザで開くスモークテストを作った。当初はバックエンド着手時に導入する方針だったが、「スクリーンショットを GitHub Pages から確かめたい」という要望で前倒しした（[体制の進化ログ](../process/evolution.md)）。
