---
name: eng-practices
description: push・PR の前に、自分の git diff を Google Engineering Practices のチェックリストでセルフレビューする。実装が一段落して commit・push・PR の直前に使う。出典 https://github.com/google/eng-practices（CC BY 3.0）
---

# eng-practices（レビューを通る差分に自分で仕上げる）

公開されている Google のコードレビュー基準を、自分の差分に当てる。別セッションの AI による独立レビュー（`docs/process/rules/review.md`、design-reviewer 等のサブエージェント）とは役割が別で、これは「自分の差分を、出す前に自分で読み直す」ことに特化する。

## 1. 差分を読み直す

`git diff HEAD`（コミット済みなら `git diff main...HEAD`）を、レビューアーになったつもりで通読する。

## 2. チェックリストを当てる

- 設計：変更はシステムに素直に収まっているか（`docs/process/rules/architecture.md` の置き場所の順序に従っているか）。過剰な作り込みはないか
- 機能：書いた本人でなくても意図通りに動くか。エッジケースの扱いは
- 複雑さ：これ以上単純にできないか。将来を見越した早すぎる一般化（2ページ目がないのに共通化した等）はないか
- テスト：変更に見合うテストがあるか。テスト自体が正しく検証しているか（骨抜きになっていないか）
- 命名とコメント：名前は意図を表すか。docs の用語と揃っているか。コメントは「なぜ」を書いているか
- 仕様：仮ルール・未解決論点に触れる箇所は「仮」と明示したか。docs を先に直すべき変更を含んでいないか

## 3. 直してから出す

指摘は自分で直す。判断に迷う点は、PR 本文（または push 時の報告）の「レビュー観点」に書き出してレビューアーへ渡す。最後に `pnpm web:typecheck && pnpm web:test` を通す。
