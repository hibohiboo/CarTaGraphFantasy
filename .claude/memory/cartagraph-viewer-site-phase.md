---
name: cartagraph-viewer-site-phase
description: CarTaGraphFantasyの「閲覧サイトを作るフェーズ」で進めている試作の現状
metadata: 
  node_type: memory
  type: project
  originSessionId: fcb20a47-5151-4109-8489-8af7d7d5cc2f
  modified: 2026-09-13T22:00:23.605Z
---

`docs/architecture/index.md`で決着した「まず閲覧サイト→後にセッション管理システム」というフェーズ分けの、見た目を確認する試作を`docs/public/preview/`配下に作成し、GitHub Pages（VitePressのpublicディレクトリ経由）で公開している。全11画面、相互にナビゲーションでつながっている。[[list-screens-before-building]]の通り、複数画面を作る前にはロール軸（PL/GM/シナリオ製作者/システム製作者）とモード軸（軽量モード/濃密モード）で棚卸しした一覧を先に示す運用にしている。

## 作成済みの試作ページ（11）

- `cartagraph-zukan.html` — 用語集12項目＋グラフ（正史グラフ／PC発見グラフ）の閲覧サイト試作
- `session-play.html` — ドライバー視点のプレイ画面（選択肢を上に固定、場/手札はタブ切り替え）
- `session-gm-review.html` — GMの提案承認画面（承認待ち／採用済み／却下の状態遷移）
- `session-chat.html` — ドライバー/ナビゲーター/GMの非同期チャット
- `session-gm-manage.html` — GMのセッション管理（参加者・ゾーン・進行フィード）
- `scenario-manage.html` — シナリオ製作者のシナリオ管理（メタデータ・デッキ構造・結末タグ）
- `session-browse.html` — プレイヤーのセッション選択（縦長カードのグリッド）
- `character-create.html` — キャラクター作成（CP予算・能力値・カードプール）
- `scene-builder.html` — シーン構築（ロケーション1枚＋NPC/イベント配置、目的/終了条件はgrilling候補）
- `scene-play.html` — シーン進行（GM視点のライブ view、session-play.htmlのPL視点と対）
- `combat-play.html` — 戦闘画面（PL視点、濃密モード。カウント制・2次元配置とグループ・射程・判定）

`cartagraph-zukan.html`以外（セッション管理・戦闘系UI）は本来`architecture/index.md`が「後続フェーズ」と定めた領域だが、デザイン探索目的でユーザーの依頼により先行して試作した。実装のフェーズ分け方針自体は変更していない。

## まだ作っていない候補（未）

- 公開閲覧サイト: カード一覧・検索、シナリオ一覧、正史グラフの操作可能な探索ビュー
- PL: 自分のPC一覧・管理、PC発見グラフの閲覧、称号タグ・結末タグの比較体験
- GM: セッション募集を出す画面、応募者一覧・参加者確定
- シナリオ製作者: 新規シナリオ作成の入り口、共有ライブラリへの公開・格上げ操作
- システム製作者（4ロール中、唯一未着手）: システム構造グラフ、進化候補の一覧・評価画面
- 濃密モードのもう一つの用途「NPCとの会話」画面（戦闘画面は済みだがこれは未）

## デザイントークン（全画面共通）

- 卓上フェルト地（暗い緑 `#1f2a24`）にカルタ札（生成り紙 `#efe7d8`）を置く構図
- 朱印スタンプ＝「決着」ステータスの可視化（`docs/open-questions.md`の運用をそのまま図像化）
- 金糸（`#b8935a`）＝グラフ/場のエッジ、赤とは役割分離
- 役割バッジの配色を統一：ドライバー＝金／ナビゲーター＝スレート／GM＝朱／戦闘の敵＝朱
- 書体：見出し・カード名＝Zen Old Mincho、本文＝Zen Kaku Gothic New
- 「grilling候補」バッジ（点線・pending色）＝docsに未決着の試験的な項目である旨の明示（scene-builder/scene-playの「目的・終了条件」など）

## 運用上の決定

- VitePressのビルドはmainブランチへのpushでのみデプロイされる（`.github/workflows`）。試作の確認はmainへ直接push（[[push-then-report]]）。
- サイドバーに「試作」セクションを追加済み。本実装が進んだら試作ページは外す想定。
- 新しいUI概念（既存docsに無い属性など）が出てきたら、勝手に決めずに`docs/open-questions.md`の「次に詰める候補」へ追記してユーザーに報告する。

## 次のステップ候補

- 「まだ作っていない候補」から必要なものを選んで追加、または`architecture/index.md`のモノレポ化（`apps/` `packages/` `infra/`）とVite+React実装へ進む。
