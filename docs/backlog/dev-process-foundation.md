---
title: 開発体制の基盤整備
status: 完了
summary: 特定の AI モデルやツールが使えなくなっても開発が回るように、開発プロセスを文書化し、CI・lint・PR 運用などの機械的な安全網を整える。
plans:
  - 2026-09-16-dev-process-foundation.md
cycles:
  - { name: C0 文書化, status: 完了 }
  - { name: C1 CI の安全網, status: 完了 }
  - { name: C2 lint とコミット前フック, status: 完了 }
  - { name: C3 モデル非依存の実証, status: 完了 }
  - { name: C4 新プロセスで1機能を完走（シーン構築画面）, status: 完了 }
  - { name: C5 定期リファクタリング, status: 完了, pr: 2 }
  - { name: C6 PR 運用の開始, status: 完了 }
updated: 2026-09-27
---

# 開発体制の基盤整備

書籍『プロフェッショナルAI駆動開発』のサンプル構成を移植した [開発プロセス](../process/index.md) を、実際に回る状態にした。

- C5 のうち「肥大化したページの分割」は、置き場所のルールが無いため保留にした。[体制の進化ログ](../process/evolution.md) の候補に残っている
