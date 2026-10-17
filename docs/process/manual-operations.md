# 人間が手で行う操作（git・PR・確認のコマンド）

[開発サイクル](index.md)の各手順で、AI が実行する git・GitHub・確認のコマンドを、人間が手で行うときのコマンド集。AI に任せず自分で進めたいとき、AI が止まったときに引き継ぐときに使う。手順の意味と判定は[開発サイクル](index.md)が正で、ここは「どのコマンドを打つか」だけを書く。コマンドの一覧は `AGENTS.md`「コマンド」が正。ここには書き写さず、流れの中で使う順に並べる。

シェルは Git Bash か PowerShell。改行コードは LF（`git config core.autocrlf` は触らない）。`gh` は GitHub CLI（初回は `gh auth login`）。

## 0. 初回の準備

```sh
pnpm install          # 依存を入れる。prepare が git フック（.githooks/）を自動で設定する
git config --local core.hooksPath   # → .githooks と出れば設定済み。出なければ git config --local core.hooksPath .githooks
gh auth status        # GitHub CLI にログインしているか
```

## 1. サイクルを始める

```sh
git switch main && git pull --ff-only     # main を最新にする
git status                                 # 作業ツリーがきれいか確かめる
node scripts/check-main-ci.mjs             # main の最新の CI が失敗していないか（失敗なら先に直す）
git switch -c feat/<機能名>                # フルの変更は作業ブランチを切る（例：feat/scenario-copy）
```

- ブランチ名は `feat/`（機能）・`fix/`（不具合）・`chore/`（雑務）に英小文字とハイフンで続ける。
- `docs/` だけの変更や小さな JSON の修正（ライト）は、ブランチを切らずに main へ直接コミット・push してよい（[適用範囲](index.md)）。

## 2. 作業中の確かめ

作業の節目で流す。lint は流さなくてよい（pre-commit が見る）。

```sh
pnpm web:typecheck && pnpm web:test                   # 最低限（apps/web）
pnpm domain:typecheck && pnpm domain:test             # packages/domain を触ったとき
pnpm schemas:typecheck && pnpm schemas:test           # packages/schemas を触ったとき
pnpm docs:build                                        # docs/ を触ったとき
pnpm tools:test                                        # scripts/・.claude/hooks/ を触ったとき
pnpm docs:build && pnpm api:docs                       # API の一覧・応答の形を触ったとき
pnpm web:test -- <ファイル名の一部>                    # テストを絞るとき（例：scenarioDrafts）
```

画面をブラウザで確かめるとき：

```sh
pnpm web:dev            # http://localhost:5173 。自分で見る用（MSW 有効。リロードで状態が消える）
pnpm web:dev:agent      # http://localhost:5174 。AI 用。人間が使う必要はない
pnpm web:dev:agent:stop # AI 用の開発サーバー・preview が残っていたら止める
pnpm docs:dev           # 仕様書サイトをローカルで確認
```

`WEB_BASE=/CarTaGraphFantasy/app/` のように `/` で始まる環境変数を Git Bash で渡すと Windows のパスに化ける。ビルドや preview は PowerShell で行うか、`MSYS_NO_PATHCONV=1` を付ける（[ローカル開発の注意](../architecture/web-app.md)）。

## 3. コミット

```sh
git status
git diff                         # 変更を自分の目で見る
git add <ファイル>               # git add -A は使わない（意図しないファイルが入る）
git commit                       # エディタで書く。短く書くなら -m
```

- メッセージの形：`<種別>: <日本語の要約>`。種別は `feat`・`fix`・`docs`・`chore`・`refactor`・`test`。docs の中でも進め方に関わるものは `docs(process): …`。
- 仕様を変えるサイクルでは、仕様（`docs/`）のコミットを最初にする。
- **pre-commit**：ステージしたファイルを Biome が整形・修正して再ステージする。`--unsafe` が要る指摘だけコミットが止まるので、指摘を見て直す。
- **commit-msg**：進め方に関わるファイル（`docs/process/` のルール、`AGENTS.md`、`CLAUDE.md`、`.claude/`）を変えたのに、体制の進化ログ（`docs/process/evolution.md` か `docs/process/evolution/<年-月>.md`）が変わっていないと止まる。記録が要らないときは、メッセージに次の行を足す。

```text
進化ログ不要: <理由>
```

- `--no-verify` は使わない。緊急時だけ。CI が同じ検査を回すので、迂回しても取りこぼしはそこで見つかる。
- 直前のコミットのメッセージだけ直す（push 前に限る）：`git commit --amend`
- 崩した箇所を `git checkout <パス>`・`git restore` で戻さない（未コミットの変更ごと消える）。

## 4. push

```sh
git push -u origin feat/<機能名>      # 初回（上流を設定する）
git push                               # 2回目以降
```

pre-push が、型検査・テスト・docs ビルド・API ドキュメントの生成を CI と同じ順に流す（数分かかる）。成功すると1行、失敗すると落ちたコマンドの出力が出る。出力を読んで直し、もう一度 push する。

push の前に一度 `pnpm web:e2e`（Playwright。初回は `pnpm exec playwright install` が要ることがある）。

main への直接 push は、docs のみ・JSON のみのライトの変更だけ。`git push origin main` の前に `git pull --ff-only` で最新にする。

## 5. プルリクエスト（PR）

対象は `apps/`・`packages/` の振る舞いを変える変更（フル）。docs のみは直 push でよい。

### 5-1. 本文を用意する

本文の形は 課題／解決策／テスト／レビュー観点。AI が書いた「PR 下書き」はプランの末尾にある（`docs/plans/<日付>-<機能>.md`）。自分で書くときも同じ見出しにする。型検査・テスト・docs ビルドは pre-push と CI が確かめるので、結果は貼らなくてよい。

```sh
git diff main...HEAD --stat           # 変更の全体
git log main..HEAD --oneline          # コミットの一覧
```

### 5-2. 作成する

```sh
gh pr create --base main --title "<タイトル>" --body-file <本文のファイル>
# 本文を手で書くなら --body-file の代わりに --web でブラウザの画面を開く： gh pr create --base main --web
```

本文の末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` を付けるのは AI が書いたときだけ。自分で書いたときは付けない。

### 5-3. CI を見る

```sh
gh pr checks            # 現在の PR の CI の結果
gh pr checks --watch    # 終わるまで待つ
gh run list --limit 5   # 直近の実行
gh run view <run-id> --log-failed    # 落ちたジョブのログだけ
gh pr view --web        # ブラウザで開く
```

CI が通ってから人間のレビューに回す。CI が落ちたら、ログを読んで直して push する（PR は自動で更新される）。CI でだけ落ちるテストは、`scripts/check-main-ci.mjs` が見る main の失敗と区別して記録する（[進化ログ](evolution.md)）。

### 5-4. レビューの指摘を直す

```sh
git switch feat/<機能名>
# 直す → 3. のコミット → 4. の push（同じブランチに積む。force push は要らない）
gh pr view --comments       # コメントを端末で読む
```

同じ PR で直すのは、受け入れ条件に対する不具合・漏れだけ。それ以外は[既知の問題](../architecture/known-issues.md)か次のサイクルに回す（[人間レビューで出た追加の要望](index.md)）。

## 6. マージとあと片づけ

マージは人間が判定する（[人間レビュー](index.md)）。このリポジトリは「Merge pull request」のマージコミットを使う（squash・rebase は使わない）。

```sh
gh pr merge <番号> --merge --delete-branch     # マージして、リモートの作業ブランチを消す
git switch main && git pull --ff-only           # main を最新にする
git branch -d feat/<機能名>                     # ローカルの作業ブランチを消す（マージ済みなら -d で通る）
git fetch --prune                               # 消えたリモートブランチの記録を掃除する
```

ブラウザでマージしてもよい（GitHub の PR 画面の「Merge pull request」）。`gh pr merge` の `--delete-branch` で、カレントのブランチを消そうとして失敗したときは、先に `git switch main` する。

マージのあと（振り返り。[手順8](index.md)）：

1. 要望ファイル（`docs/backlog/<要望>.md`）のサイクルの状態・PR 番号・更新日を直す。要望が終われば状態を「完了」にする
2. プランの状態の行を「完了（PR #番号、日付）」にする
3. 進め方に関わる気づきは、[体制の進化ログ](evolution.md)の「候補（未評価）」に追記する（書式は同ページの「候補」の節）
4. これらは docs のみなので、main に直接コミットして push してよい

## 7. 困ったとき

| 状況 | 対処 |
|---|---|
| pre-commit が止まる | 出力の指摘を読んで直す。Biome の自動修正は再ステージ済み。`pnpm lint:fix` で安全な修正をまとめて当てられる |
| commit-msg が止まる | 進化ログを足すか、メッセージに `進化ログ不要: <理由>` を書く |
| pre-push が止まる | 落ちた `pnpm <コマンド>` の出力を読み、そのコマンドだけ単独で流して直す |
| push が non-fast-forward で拒否される | `git pull --rebase` で取り込んでから push。force push はしない（共有ブランチを壊す） |
| main と見比べたい | `git show main:<パス>`・`git grep <パターン> main -- <パス>`・`git diff main...HEAD -- <パス>`。`git stash` は使わない（pop でステージが解ける） |
| 開発サーバーがポートを塞いでいる | `pnpm web:dev:agent:stop`。人間の `pnpm web:dev`（5173）は自分で止める |
| 直前のコミットを取り消したい（push 前） | `git reset --soft HEAD~1`（変更は残る）。`--hard` は未コミットの変更ごと消えるので使わない |
| push 済みのコミットを取り消したい | `git revert <コミット>` で打ち消しのコミットを足す |
| ブランチを切り替えたら変更が邪魔 | コミットしてから切り替える（stash は使わない） |
