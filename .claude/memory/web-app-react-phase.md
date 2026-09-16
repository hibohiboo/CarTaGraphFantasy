---
name: web-app-react-phase
description: React実装フェーズ（apps/web）の状況。詳細はdocsへ移した（2026-09-16）
metadata:
  node_type: memory
  type: project
  originSessionId: e1e55704-3c05-4d1e-b0bd-78c1c38c4e1c
  modified: 2026-09-16T12:55:43.179Z
---

2026-09-16に、試作フェーズ（[[cartagraph-viewer-site-phase]]）の次として `apps/web`（Vite + React + react-router(Hash) + TanStack Query + MSW）と `packages/domain`（ドメイン型）を追加した。ロール別に全18ルートを1回で作った。

**このフェーズについて聞かれたら、まず [docs/architecture/web-app.md](../../docs/architecture/web-app.md) を読む。** 構成・位置づけ（バックエンド未実装・MSW代替）・ローカル開発の注意（`MSYS_NO_PATHCONV`、vitestのpeer解決）・未React化の画面（シーン構築・戦闘画面）は、Claude以外のツールからも見えるようdocs側に書き出し済み（[[dev-process-structure]]の「ツール固有の記憶を正にしない」原則、C3で実施）。

**How to apply:** このメモリファイル自体には、もう運用知識を書き足さない。プロジェクトとして残す知識は docs/architecture/web-app.md に追記し、ここは要点とポインタだけに留める。
