---
title: シナリオを JSON でリポジトリ管理する
milestone: M1
status: 完了
summary: 遊べるシナリオ（村はずれの一歩、灰色館の一夜など）を、コードの中ではなく JSON ファイル（`scenarios/`）で管理し、アプリは MSW 経由で取得する。GM 不在のシナリオも JSON から結末まで遊べる。
plans:
  - 2026-10-03-シナリオのJSON管理.md
cycles:
  - { name: シナリオの JSON 管理, status: 完了, pr: 11 }
updated: 2026-10-03
---

# シナリオを JSON でリポジトリ管理する

[ロードマップ](../roadmap.md) M1 の完成の条件2（シナリオを JSON で管理し、MSW 経由で取得する）と5（GM 不在のシナリオも JSON から遊べる）に当たる。

- 置き場所はリポジトリ直下の `scenarios/`。将来バックエンドができたときに、同じ JSON を投入データとして使えるようにするため
- JSON にするのは遊べるシナリオだけ。テスト専用のシナリオは、これまでどおり `apps/web/src/mocks/fixtures.ts` に置く
- JSON は型で検査する
