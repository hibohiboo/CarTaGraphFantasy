---
name: cartagraph-viewer-site-phase
description: CarTaGraphFantasyの閲覧サイト・セッション画面UI試作フェーズの状況（プロトタイプ完了、React実装フェーズへ移行済み）
metadata: 
  node_type: memory
  type: project
  originSessionId: fcb20a47-5151-4109-8489-8af7d7d5cc2f
  modified: 2026-09-15T21:56:06.717Z
---

`docs/architecture/index.md`で決着した「まず閲覧サイト→後にセッション管理システム」というフェーズ分けの、見た目を確認する試作を`docs/public/preview/`配下（全15画面、HTML/CSSのみ、GitHub Pagesで公開）に作った。2026-09-16時点でユーザーから「reactでの本ページ作成に移りたい」と表明があり、**このHTML試作フェーズは区切りがついた**。

## 引き継ぎ資料

全15画面の一覧・デザイントークン（カラー/フォント/カード比率5:7）・確立したUIパターン（CSSのみのタブ、100dvh+横スクロールナビによる1画面完結レイアウト、GM=奥/PL=手前のプレイマット表現）・未解決事項は、詳細を毎回思い出す必要がないよう [docs/architecture/prototype-handover.md](../../docs/architecture/prototype-handover.md) に書き出し済み。**今後この試作フェーズについて聞かれたら、まずこのファイルを参照する。**

## 次のステップ

- `architecture/index.md`のモノレポ化（`apps/` `packages/` `infra/`）とVite+React実装に進む想定。
- 試作フェーズで得たデザイントークン・コンポーネント境界（Card/HandDock/Hud/TurnChips/PlayMat等）はReact実装にそのまま移植可能。
- 本実装が進んだら、`docs/public/preview/`の試作ページとVitePressサイドバーの「試作」セクションは役目を終えるので外す想定（[[push-then-report]]の通り、mainへの反映はユーザー確認なしで進めてよい）。

## 運用上の学び（今後も有効）

- 複数画面のUIモックアップを作る前には、ロール軸／モード軸などで棚卸しした一覧を先に示す（[[list-screens-before-building]]）。
- 新しいUI概念（既存docsに無い属性など）が出てきたら、勝手に決めずに`docs/open-questions.md`の「次に詰める候補」へ追記してユーザーに報告する。
