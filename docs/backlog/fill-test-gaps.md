---
title: 完了した要望のテストの穴を埋める
status: 未着手
summary: 実装は済んでいるのにテストが無く、トレースのページで「未達」と出る要望について、ユースケースの E2E とルールの節のテストを足す。
trace:
  usecases: [PL-3, PL-4, PL-6, PL-7, SC-4]
  rules: [play-and-field/GMレスセッションでの提案の扱い, scenario-flow/シナリオの公開, scenario-flow/シナリオの入手元, character-growth/CP予算はハードな制約, party-and-session/通常進行とじっくり進行, solo-village/引換カードとお店, scenario-type/PCはすべて冒険者]
updated: 2026-10-27
---

# 完了した要望のテストの穴を埋める

2026-10-27、[アイデアから実装までをたどれるようにする](trace-report.md)の人間レビューで出た要望。トレースのページで、完了した要望の10件が「未達」と出た。原因はすべて、つなぎ先のテストが無いこと（「テストなし」）。人間は未実装だと思っていたが、実装は済んでいてテストが無い状態なので、テストを足したい（人間の判断）。

## テストの無いつなぎ先（2026-10-27 時点）

| つなぎ先 | 種類 | 未達の要望 |
|---|---|---|
| PL-3 | ユースケースの E2E | [gmless-session-publish](gmless-session-publish.md) |
| PL-4 | ユースケースの E2E | [gm-play-as-pl](gm-play-as-pl.md)・[gmless-session-publish](gmless-session-publish.md) |
| PL-6 | ユースケースの E2E | [village-campaign](village-campaign.md) |
| PL-7 | ユースケースの E2E | [progress-mode-names](progress-mode-names.md) |
| SC-4 | ユースケースの E2E | [creator-flow-clarity](creator-flow-clarity.md) |
| `play-and-field/GMレスセッションでの提案の扱い` | ルールの節のテスト | [gmless-session-publish](gmless-session-publish.md) |
| `scenario-flow/シナリオの公開` | ルールの節のテスト | [scenario-draft-api](scenario-draft-api.md)・[scenario-publish](scenario-publish.md) |
| `scenario-flow/シナリオの入手元` | ルールの節のテスト | [scenario-json](scenario-json.md) |
| `character-growth/CP予算はハードな制約` | ルールの節のテスト | [rules-json](rules-json.md) |
| `party-and-session/通常進行とじっくり進行` | ルールの節のテスト | [progress-mode-names](progress-mode-names.md) |
| `solo-village/引換カードとお店` | ルールの節のテスト | [village-campaign](village-campaign.md) |
| `scenario-type/PCはすべて冒険者` | ルールの節のテスト | [adventurer-only](adventurer-only.md) |

## 考えていること（プランで詰める）

- ルールの節は、確かめているテストが既にあって、タグ（`rule:<ページ>/<見出し>`）を付けていないだけのものがあるかもしれない。先に既存のテストを洗い、無いものだけを足す
- ユースケースの E2E は `apps/web/e2e/usecases/` に足す。[ユースケースの E2E を、1ユースケース1シナリオに分ける](usecase-e2e-per-scenario.md) と分け方を合わせる
- 一覧はトレースのページ（Pages の `/trace-report/`）の未達から作った。着手するときに最新のページで数え直す
