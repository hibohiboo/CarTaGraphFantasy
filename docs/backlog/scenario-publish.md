---
title: シナリオ製作者がシナリオを作って公開する
milestone: M1
status: 未着手
summary: シナリオ製作者がシナリオを作り、公開できる。ローカルの開発サーバーで公開すると、そのシナリオが JSON としてリポジトリに保存され、遊べるシナリオになる。
updated: 2026-09-28
---

# シナリオ製作者がシナリオを作って公開する

[ロードマップ](../roadmap.md) M1 の完成の条件2（シナリオ製作者がシナリオを作って公開できる）に当たる。前提は [シナリオを JSON でリポジトリ管理する](scenario-json.md)。

- 既存のシナリオ編集画面・シーン編集画面を使う（[シーン構築画面の React 化](scene-builder.md)）
- 保存先：ローカルの開発サーバー（`pnpm web:dev`）の専用の口で、`scenarios/<id>.json` に書き込む。書き込んだ JSON はそのままコミットできる
- GitHub Pages のデモは静的なので保存せず、これまでどおりメモリ上だけで動かす
- 申し送り（2026-10-03、[シナリオを JSON でリポジトリ管理する](scenario-json.md)）
  - 書き込む前の検査は `packages/domain` の `parseScenarioFile`（形・ファイル名と id・参照の整合）を使う
  - JSON の整形の正は Biome。書き込んだファイルが Biome の整形と合わないと、CI の lint で落ちる
  - `scenarios/sc-village-start.json`（村はずれの一歩）は、移す前の値のまま `libraryStatus: draft`・作者 `system` になっている。「公開＝JSON に書き込む」と `libraryStatus` の関係は、この要望で決める
