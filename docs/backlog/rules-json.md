---
title: ルールと基本カードプールを JSON でリポジトリ管理する
milestone: local-flow
status: 完了
summary: システム製作者が作るルールと基本カードプール（キャラクター作成で選べるカードなど）を、JSON ファイルとしてリポジトリで管理する。local-flow では専用の画面は作らず、JSON を直してコミットする。
plans:
  - 2026-10-10-ルールとカードプールのJSON管理.md
cycles:
  - { name: ルールと基本カードプールの JSON 管理, status: 完了, pr: 19 }
updated: 2026-10-10
---

# ルールと基本カードプールを JSON でリポジトリ管理する

[ロードマップ](../roadmap.md#local-flow) local-flow の完成の条件1（システム製作者）に当たる。

- システム製作者の専用の画面は、進化のループ（evolution-loop）で作る
- どこまでを JSON にするかは、2026-10-10 に決めた：システムのカード一覧・基本カードプール・キャラクター作成の数値（CP 予算・能力値の配分・作成時の HP）。自動戦闘・村の成長の仮ルールの計算はコードのまま（プランの D1）
- 2026-10-10 に PR #19 で完了。これで local-flow の完成の条件がすべてそろった。残したもの（仮ルールの一覧、API の能力値の検査、シナリオでしか得られないカードの仮置き）は、別の要望（[仮ルールの一覧をダッシュボードに出し、決めたら消す](provisional-rules-dashboard.md)）と[既知の問題](../architecture/known-issues.md)に置いた
- 申し送り（2026-10-03、[シナリオを JSON でリポジトリ管理する](scenario-json.md)）：`scenarios/sc-village-start.json` は、お店で習う戦闘スキルのカードと試験官の数値を中身ごと持っていて、`apps/web/src/mocks/fixtures.ts` と重複している（[既知の問題](../architecture/known-issues.md)）。カードプールを作るときに、シナリオからは id で参照する形へ統合する
