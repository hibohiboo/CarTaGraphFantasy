---
name: cartagraph-viewer-site-phase
description: CarTaGraphFantasyの「閲覧サイトを作るフェーズ」で進めている試作の現状
metadata: 
  node_type: memory
  type: project
  originSessionId: fcb20a47-5151-4109-8489-8af7d7d5cc2f
  modified: 2026-09-13T13:15:58.602Z
---

`docs/architecture/index.md`で決着した「まず閲覧サイト→後にセッション管理システム」というフェーズ分けの、閲覧サイト側の見た目を確認する試作を`docs/public/preview/`配下に作成し、GitHub Pages（VitePressのpublicディレクトリ経由）で公開している。

## 作成済みの試作ページ

- `cartagraph-zukan.html` — 用語集12項目＋グラフ（正史グラフ／PC発見グラフ）の閲覧サイト試作
- `session-play.html` — ドライバー視点のプレイ画面（場・手札・提案の様子）
- `session-gm-review.html` — GMの提案承認画面（承認待ち／採用済み／却下の状態遷移）
- `session-chat.html` — ドライバー/ナビゲーター/GMの非同期チャット

後者3つ（セッション管理系UI）は本来`architecture/index.md`が「後続フェーズ」と定めた領域だが、デザイン探索目的でユーザーの依頼により先行して試作した。実装のフェーズ分け方針自体は変更していない。

## デザイントークン（3画面共通）

- 卓上フェルト地（暗い緑 `#1f2a24`）にカルタ札（生成り紙 `#efe7d8`）を置く構図
- 朱印スタンプ＝「決着」ステータスの可視化（`docs/open-questions.md`の運用をそのまま図像化）
- 金糸（`#b8935a`）＝グラフのエッジ、赤とは役割分離
- 役割バッジの配色を統一：ドライバー＝金／ナビゲーター＝スレート／GM＝朱
- 書体：見出し・カード名＝Zen Old Mincho、本文＝Zen Kaku Gothic New

## 運用上の決定

- VitePressのビルドはmainブランチへのpushでのみデプロイされる（`.github/workflows`）。試作の確認はmainへ直接push（[[push-then-report]]）。
- サイドバーに「試作」セクションを追加済み。本実装が進んだら試作ページは外す想定。

## 次のステップ候補

- 3画面の感想を受けて調整、または`architecture/index.md`のモノレポ化（`apps/` `packages/` `infra/`）とVite+React実装へ進む。
