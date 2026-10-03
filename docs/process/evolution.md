# 開発体制の進化ログ

開発プロセス自体の変更を「候補 → 評価 → 採用／却下」の型で記録する。運用は[開発プロセス](index.md#体制の進化)が正。カルタグラフ本体の[進化候補の評価](../concept/index.md#進化候補の評価決着)と同じく、却下も削除せず理由付きで残す。

記録するのは「ルール・依頼文・スキル・サブエージェント・CI など、進め方に関する変更」であり、機能の設計判断はプランドキュメント（`docs/plans/`）に書く。

## 候補（未評価）

サイクルの途中で気づいた人（人間・AIどちらでも）が追記する。書式：`- [ ] <候補> — <気づいた状況・根拠>（<日付>）`

- [x] `apps/web/src/components/index.ts` の barrel export を解消する — アーキテクチャルールで barrel 禁止を採用した結果、既存コードが唯一の逸脱になった。テスト駆動リファクタリングの定期作業で扱う（2026-09-16）。**2026-09-21 実施。** 下記「採用済み」参照
- [ ] `noNonNullAssertion`（5箇所）・`noDescendingSpecificity`（GameCard.module.css 2箇所）の警告を解消する — Biome導入時（2026-09-16）に検出。lintはブロックしないが、C5のリファクタリング定期作業で見直す
- [x] `RoleBadge`/`Avatar` の `role` prop 名を ARIA の `role` 属性と衝突しない名前（例：`badgeRole`）に変える — Biome導入時（2026-09-16）に `lint/a11y/useValidAriaRole` の誤検知が19箇所見つかり、`biome-ignore` コメントで個別に抑制した。プロパティ名を変えれば誤検知自体がなくなるが、アプリコードの広範囲な書き換えになるためC2の範囲外とした。**2026-09-21 実施。** 下記「採用済み」参照
- [x] 肥大化した1ページ1ファイルの分割先が未定義 — C5の barrel 解消時に `CreatorSceneEditPage.tsx`（399行）の分割を検討したが、`docs/process/rules/architecture.md` の「構造」表は pages/ を「1ページ1ファイル」と定め、「1ファイル1責務」節の分割例は `components/` への抽出のみを挙げている。一方「複数ページで共有するUI → components/。ただし2ページ目が現れるまで共通化しない」（同ファイル）があるため、1ページでしか使わない大きな区画を分割する置き場所のルールが存在しない。ルールを拡張する（例：pages/<ロール>/ 内の兄弟ファイルを許可する）か、行数だけでは分割しない方針にするか、人間の判断が要る。判断が出るまで `CreatorSceneEditPage.tsx` の分割は保留し、barrel 解消とprop改名だけをC5として完了させた（2026-09-21） **2026-10-03 採用（FSD 移行で解決）。** 下記「採用済み」参照
- [x] CI で `pnpm web:typecheck && pnpm web:test` を必ず回す — 2026-09-16 に `.github/workflows/ci.yml` として実施（プランの C1）。下記「採用済み」参照
- [x] `apps/`・`packages/` の変更を PR 経由にする — 現状は main へ直 push。AI相互レビューと CI をマージ条件にするなら PR が要る。docs のみの修正は直 push のまま（2026-09-16）。**判断：基盤整備が終わってから採用（プランの C6）。それまでスピード重視で直 push**。**実施済み**（基盤整備プラン `docs/plans/2026-09-16-dev-process-foundation.md` の C6。2026-09-21 の PR #2 から PR 運用。2026-10-02、ダッシュボードで未評価のまま残っていたのに気づき、完了に直した）
- [x] lint・フォーマッタの導入（Biome） — 2026-09-16 に実施（プランの C2）。下記「採用済み」参照
- [x] Claude Code の自動メモリにある運用知識を `docs/` へ移す — 2026-09-16 に実施（プランの C3a）。下記「採用済み」参照
- [x] 普段と違うモデルで1サイクル試走し、`AGENTS.md`・依頼文の不足を洗う — 2026-09-16 に Opus でのサブエージェント試走を実施（プランの C3b）。下記「採用済み」参照。Codex 等の別ツールでの試走は未実施（余裕があれば別途）
- [x] `docs/plans/<日付>-<機能>.md` のファイル名規約（機能名部分の言語）を明文化する — C3bのOpus試走で「唯一の実例（dev-process-foundation）がローマ字で、日本語かローマ字か規約に書かれていない」と指摘された（2026-09-16）。次にプランを作る際にでも一言足せばよい軽微な指摘。**2026-09-21 実施。** 下記「採用済み」参照
- [x] E2E（Playwright）の導入時期 — バックエンド着手時に再評価、それまではページ描画テストで代替という方針だった（2026-09-16）。**判断：早期導入に変更（2026-09-21、人間の判断）。** 理由：スクリーンショットをGitHub Pagesから確認できるようにしたいという要望が優先する。詳細設計は `docs/plans/2026-09-21-e2e導入.md` へgrillingで落とし込み、design-reviewerのレビュー（P0×2・P1×4・P2×3の指摘を反映）を経て実施した。**2026-09-21 実施。** 下記「採用済み」参照
- [ ] AIレビュー観点に「開発フェーズを踏まえた設計の重さ」の確認を加えるか検討する — react-best-practices適用サイクル（`docs/plans/2026-09-22-react-best-practices適用.md`）で、`cardImageStorage.ts` の旧形式データ互換（自動マイグレーション）をAIが設計・実装した。プランのAI相互レビュー（設計整合性／仕様整合性／運用の3観点）でも、実装のAI相互レビュー（プラン整合／異常系／仕様整合の3観点）でも指摘は出ず、人間レビューで初めて「まだ本リリース前で既存データが無いので、互換コード・テストは不要」と判断され削除した（2026-09-23）。バックエンド未実装・本リリース未実施というフェーズは `AGENTS.md`・`docs/architecture/web-app.md` に明記されているが、既存のレビュー観点（`docs/process/rules/review.md`）のいずれも「今のフェーズに対して設計が過剰でないか」を問う項目を持たない。観点として追加する価値があるか、それとも人間レビューに委ねる領域として残すのが適切か、判断が要る
- [ ] docs にも「1ファイル1責務」を広げる（1つの文書は1つの問いに答える。定義・進捗・優先順位・経緯を1ファイルに混ぜない） — 2026-09-28、ロードマップを作るときに、AI が「ゴールとマイルストーンの定義」「状態と進捗」「今・次・いつか（優先順位）」を1ファイルに混ぜる案を出し、人間の指摘で分けた。いまの「1ファイル1責務」はアーキテクチャルール（`docs/process/rules/architecture.md`）の中にあり、対象は `apps/`・`packages/` のコードだけ。採用するなら `docs/process/rules/` に docs 用のルールを新しく作る（参考：tabifuda の ADR 0007「SSOT と単一責務」）

- [x] プランの AI レビュー（依頼文「2」）で、実コードを読ませることを明記する — 2026-10-03、シナリオの JSON 管理のプランレビューで、P0 の1つ（テスト用セッション `ss-village-human-gm` が古い id を参照し、fixtures の読み込みで例外になる）は、依頼文に「実コードに照らして確かめる」と書いた設計整合の観点だけが見つけた。いまの依頼文「2」は判定の基準にルール・仕様ページだけを挙げ、コードを読むことを求めていない **2026-10-03 採用。** 下記「採用済み」参照
- [x] 人間のコードレビューで出た「構造の読みやすさ」を、AI レビューの観点に足すか検討する — 2026-10-03、PR #11 で人間が「`packages/domain` の配下がフラットで読みづらい」と指摘した（要望 [packages/domain をドメインごとのディレクトリに分ける](../backlog/domain-structure.md)）。プランレビュー3観点・実装レビュー3観点のどれも、ディレクトリ構成やファイルの分け方を問わない。上の「開発フェーズを踏まえた設計の重さ」と同じく、観点に足すか、人間レビューに委ねるかの判断が要る **2026-10-03 採用。** 下記「採用済み」参照
- [x] Windows の Git Bash で、`/` で始まる値の環境変数が Windows のパスに書き換えられることを、手順に書く — 2026-10-03、ブラウザでの確認で `WEB_BASE=/CarTaGraphFantasy/app/ pnpm build` を Git Bash から実行したところ、base が `/Program Files/Git/CarTaGraphFantasy/app/` に化けて preview が 404 になった。PowerShell で実行し直して確かめた（Git Bash なら `MSYS_NO_PATHCONV=1` を付ける）。置き場所の候補は `docs/architecture/web-app.md` か CLAUDE.md の Claude Code 固有の補足 **2026-10-03 採用。** 下記「採用済み」参照

- [x] 機械的な検査を自前で書く前に、既存のツール（Biome など）のルールで書けないか調べる — 2026-10-03、PR #12 で依存の向きの検査を自前のテスト（`layers.test.ts`、正規表現で import を拾う）で作り、すり抜けを塞ぐテストを積み増した。人間レビューで「Linter で検知できるのでは」と問われ、Biome 2.5 の `noRestrictedImports`・`noImportCycles`・`noBarrelFile` で置き換えられた。プランレビューもテスト網羅レビューも自前のテストの網羅を深めるだけで、手段そのものは問わなかった。プランの「詳細設計」で、機械的な検査を足すときは既存ツールのルールを先に調べ、採らなかった理由を書く、をルールにするか **2026-10-03 採用。** 下記「採用済み」参照
- [x] ディレクトリ構成など「一覧」の重複を、レビューで見つけられなかった — 2026-10-03、PR #12 の人間レビューで、コードのディレクトリ構成が README・AGENTS.md・architecture.md・web-app.md の4か所に重なり、正がどこかも食い違っていると指摘された（architecture.md に一本化した）。AI レビューは「domain の一覧が表・web-app.md・テストに重なる」までは見つけたが、文書をまたいだ全体の重複には届かなかった。仕様整合のレビュー（spec-reviewer）の観点に「書き換えた文書と同じ情報を持つ文書（README・AGENTS.md を含む）を grep で洗う」を足すか **2026-10-03 採用。** 下記「採用済み」参照
- [x] （Claude Code 固有）heredoc でスクリプトを渡して壊すことが、CLAUDE.md に注意があっても再発する — 2026-10-03、PR #12 の作業中に、Python を heredoc で渡してバックスラッシュが崩れ、2回失敗した（Write でファイルにしてやり直した）。PR #11 でも同じ種類の失敗があった。ルールを読ませるだけでは止まらないので、Claude Code のフック（PreToolUse で、Bash の `<<` と `python`・`node` の組み合わせを止める）で機械的に止めるか **2026-10-03 採用。** 下記「採用済み」参照
- [x] （Claude Code 固有）`git commit --no-verify` を、許可なく使った — 2026-10-03、PR #12 の「移動だけ」のコミットで、型検査が落ちる中間状態だからと `--no-verify` を付けた。pre-commit は Biome だけなので不要だった。Claude Code の設定（`permissions.deny` に `Bash(git commit --no-verify*)` など）で止めるか **2026-10-03 採用。** 下記「採用済み」参照
- [ ] 進化のタイムラインを、ビルド時に自動で組み立ててサイトに出す — 2026-10-03、人間から「どう進化していったか後から辿れると面白い」と要望があった。採用済みの見出しと「きっかけ」「止め方」から、年表と止め方の内訳を、ダッシュボードと同じ仕組み（docs/.vitepress/*.data.ts）で作る。書き写さないので SSOT を崩さない。人間の判断で、「きっかけ」「止め方」の記録が数件たまってから着手する（2026-10-03）

## 採用済み

新しいものを上に。書式：`### <日付> <タイトル>` の下に、内容・理由・反映先と、次の2つを書く（2026-10-03 から。それより前の項目にも遡って書いた）。

- **きっかけ** — 誰が・何で気づいたか：人間レビュー／AI レビュー／作業中の失敗／人間の要望／計画（基盤整備などのプラン）
- **止め方** — 同じことをどう防ぐか：機械（CI・git フック・lint・Claude Code のフック・ビルド時の検査や自動生成）／レビュー観点／手順・ルール（文書に書く）／置き場所（ページ・ファイルを新設・移動する）。複数あれば並べる

後から「改善がどこから生まれ、どれだけ機械で止められるようになったか」を辿れるようにするため。

### 2026-10-03 肥大化したページの分割先を、FSD のスライスで決めた（候補を閉じた）

- **内容** — apps/web を Feature-Sliced Design に並べ替え（`docs/plans/2026-10-03-webのFSD移行.md`、PR #13）、ページの中の大きな一区画は、そのページのスライスの `ui/` に別ファイルとして切り出す、と決めた（例：プレイ画面の `AutoCombatPanel`、チュートリアルの `PlayMat`）。複数のページで使うなら widgets・entities へ。`CreatorSceneEditPage.tsx` の分割そのものは、肥大化したときに行う
- **理由** — 2026-09-21 の候補は、1ページでしか使わない大きな区画の置き場所がルールに無く、分割を保留していた。FSD のスライスとセグメントで置き場所が決まった
- **反映先** — `docs/process/rules/architecture.md`「構造」「迷ったらこの順で問う」「1ファイル1責務」
- **きっかけ** — 作業中の保留（2026-09-21 の定期リファクタリング） ／ **止め方** — 手順・ルール（置き場所）

### 2026-10-03 react-best-practices のスキルを取り込み、止められるルールを Biome に入れた

- **内容** — Vercel Labs の react-best-practices（MIT）を `.claude/skills/react-best-practices/` に取り込んだ（コミットを固定し、手で直さない）。使い方（対象外のルール、Biome で止めるもの・止めないもの）は `docs/process/rules/architecture.md`「React の書き方」に書き、レビュー観点4から指した。Biome に `correctness/noNestedComponentDefinitions`・`useHookAtTopLevel` を足した（既存の違反0件）。`noLeakedRender` は誤検知が多いので入れず、`useTopLevelRegex` は既存の違反を直してから入れる（既知の問題）
- **理由** — 2026-09-22 は一度レビューに使っただけで、リポジトリに残らなかった。M1 の残りで画面を多く作るので常に参照できるようにし、FSD 移行の判断（公開 API と barrel）の材料にもする。スキルを読ませるだけでなく、止められるものは lint で止める（「改善は仕組みで」）
- **反映先** — `.claude/skills/react-best-practices/`（`VENDOR.md` を含む）、`biome.json`、`docs/process/rules/architecture.md`・`review.md`、`CLAUDE.md`、`docs/architecture/known-issues.md`、`docs/backlog/react-best-practices.md`
- **きっかけ** — 人間の要望 ／ **止め方** — 機械（lint）、手順・ルール（参照資料）

### 2026-10-03 domain のディレクトリ分割（PR #12）の振り返りから4件を採用

`docs/plans/2026-10-03-domainのディレクトリ分割.md` の振り返りでAIが出した候補を、人間がすべて採用した。

1. **機械的な検査を足すときは、既存のツールで書けないかを先に調べる**
   - 理由：依存の向きの検査を自前のテスト（`layers.test.ts`）で作り、すり抜けを塞ぐテストを積み増したが、人間レビューで Biome の既存ルールに置き換えた。プランレビューもテスト網羅レビューも、自前のテストの網羅を深めるだけで、手段を問わなかった
   - 反映先：`docs/process/index.md`「プランドキュメントの8項目」の3、`docs/process/prompt-sample.md`「2」
   - きっかけ：人間レビュー ／ 止め方：手順・ルール（プランの詳細設計）
2. **仕様整合のレビューで、書き換えた情報と同じものを持つ文書を洗う**
   - 理由：コードのディレクトリ構成が README・AGENTS.md・architecture.md・web-app.md の4か所に重なっていたのを、人間レビューで見つけた。AI レビューは差分の中の重複までしか見なかった
   - 反映先：`docs/process/rules/review.md`「レビュー観点」の1、`.claude/agents/spec-reviewer.md`
   - きっかけ：人間レビュー ／ 止め方：レビュー観点
3. **（Claude Code 固有）インタプリタへの heredoc を、フックで止める**
   - 理由：CLAUDE.md に注意があるのに、PR #11・#12 で続けて heredoc の Python が壊れた。ルールを読ませるだけでは止まらないので、機械で止める（基盤の原則5）
   - 反映先：`.claude/hooks/guard-bash.mjs`（PreToolUse、Bash・PowerShell）、`.claude/settings.json`
   - きっかけ：作業中の失敗 ／ 止め方：機械（Claude Code のフック）
4. **（Claude Code 固有）git commit・push のフックの省略を、フックで止める**
   - 理由：PR #12 の移動だけのコミットで、許可なくフックを省略した。設定の `permissions.deny` は前方一致で、オプションの位置が変わると漏れるので、3 と同じフックの中で、コマンドのどこにあっても止める
   - 反映先：同上。コミットメッセージの文字列の中にオプション名が出てくるだけでも止める（安全側）
   - きっかけ：作業中の失敗 ／ 止め方：機械（Claude Code のフック）

### 2026-10-03 シナリオの JSON 管理（PR #11）の振り返りから3件を採用

`docs/plans/2026-10-03-シナリオのJSON管理.md` の振り返りでAIが出した候補を、人間がすべて採用した。

1. **プランの AI レビューで、実コードも読む**
   - 理由：プランレビューの P0（テスト用セッションが古い id を参照し、fixtures の読み込みで例外になる）は、依頼文に「実コードに照らして」と書き足した観点だけが見つけた。依頼文「2」は判定の基準にルールと仕様ページしか挙げていなかった
   - 反映先：`docs/process/prompt-sample.md`「2」
   - きっかけ：AI レビュー（実コードを読んだ観点だけが P0 を見つけた） ／ 止め方：手順・ルール（依頼文）
2. **構造の読みやすさを、レビュー観点4（設計）に足し、design-reviewer が担当する**
   - 理由：PR #11 で人間が「`packages/domain` の配下がフラットで読みづらい」と指摘した。AI レビューの観点のどれも構成を問わず、観点4（設計）はどのサブエージェントも担当していなかった
   - 反映先：`docs/process/rules/review.md`「レビュー観点」、`.claude/agents/design-reviewer.md`、`docs/process/index.md` の手順6、`docs/process/prompt-sample.md`「6」
   - きっかけ：人間レビュー ／ 止め方：レビュー観点
3. **（Claude Code 固有）Git Bash でパスを渡す前に、ローカル開発の注意を読む**
   - 理由：ブラウザでの確認で、`WEB_BASE` が Git Bash に書き換えられて preview が 404 になった。対処は `docs/architecture/web-app.md`「ローカル開発の注意」に既に書いてあったが、AI が読まずに実行した。知識を足すのではなく、読む場所への参照を足す
   - 反映先：`CLAUDE.md`「Claude Code 固有の補足」（ツール固有の話なので `docs/process/` には書かない）
   - きっかけ：作業中の失敗 ／ 止め方：手順・ルール（CLAUDE.md の参照）

### 2026-09-27 トップページをダッシュボードにする（試行）

- **内容** — サイトのトップページを、PO 向け（決めないといけないこと、要望の進み具合）と開発者向け（要望ごとのサイクルと PR、既知の問題の判断待ち、進化ログの未評価の候補）のダッシュボードにした。要望（PBI）は `docs/backlog/` に1要望1ファイルで置き、ダッシュボードはビルド時にそこと各文書から集める。開発サイクルを回す AI が、プランの作成時とマージ時に要望ファイルを更新する
- **理由** — 人間の要望。AI との共同開発で、進み具合や判断待ちをどんな形で見られるのがよいかを試す。状況を手で書き写すと SSOT が崩れるので、情報源から自動で組み立てる
- **反映先** — `docs/index.md`、`docs/.vitepress/components/Dashboard.vue`・`backlog.data.ts`・`decisions.data.ts`、`docs/backlog/`、`docs/process/index.md` の手順1・8、`AGENTS.md`、`.claude/skills/dev-cycle`
- **きっかけ** — 人間の要望 ／ **止め方** — 機械（ビルド時の自動生成）
- **試行の扱い** — 数サイクル使ってから、見せ方・情報源・更新の手間を見直す。経緯と決めたことは要望ファイル `docs/backlog/dashboard.md`
- **付随して** — `biome.json` の overrides で、`.vue` の `noUnusedImports`・`noUnusedVariables` を止めた。Biome は Vue のテンプレート内での使用を解析できず、安全な自動修正（pre-commit）で必要な import を消してしまうため。`biome.json` はコメントを書けない（書くと設定の読み込みが失敗し、既定の整形が適用される）ので、理由はここに残す

### 2026-09-27 村スタート冒険者キャンペーン C3〜C5 の振り返りから5件を採用

C3（`docs/plans/2026-09-27-村パート.md`、PR #8）、C4（`docs/plans/2026-09-27-街道と結末タグ.md`、PR #9）、C5（見出しアンカーの修正、PR #10）の振り返りでAIが出した候補を、人間がすべて採用した。

1. **条件を外して落ちるか確かめるときは、外す書き換えが実際に入ったことを先に確かめる**
   - 理由：C3 で、整形（Biome）で折り返された行に文字列の置換が当たらなかった。条件を外したつもりで「落ちない」と出て、テストが骨抜きだと誤って判断しかけた。C4 でも同じ空振りが2回あった
   - 反映先：`docs/process/rules/testing.md`「骨抜き禁止」
   - きっかけ：作業中の失敗 ／ 止め方：手順・ルール
2. **仮ルールを足すプランは、詳細設計に「画面で『仮』と出す場所と条件」を書く**
   - 理由：C3 でも C4 でも、仕様整合のレビューが「仮ルールなのに画面に『仮』が出ない場面がある」と P1 で指摘した。プランの表示条件が、2回とも architecture.md の境界ルールに足りていなかった
   - 反映先：`docs/process/index.md`「プランドキュメントの8項目」の3
   - きっかけ：AI レビュー ／ 止め方：手順・ルール（プランの詳細設計）
3. **判定に条件を足したら、既存の画面テストがまだ各条件を区別できているかを見直す**
   - 理由：C4 で「仮」表示の判定に1条件を足すと、村の手札には必ずそれに当てはまるカードが入るため、既存テスト2件が条件を消しても通る状態になった（再レビューで発見し、判定を純粋関数に切り出した）。C3 でも、テスト用のデータが確かめたい条件を最初から満たしていたことがあった
   - 反映先：`docs/process/rules/testing.md`「単体とページ描画の切り分け」
   - きっかけ：AI レビュー ／ 止め方：手順・ルール
4. **`pnpm docs:build` で見出しへのリンクを検査する**（C5 で実施済みの事後記録）
   - 理由：見出しへのリンク183件のうち145件が、サイト上で見出しまで飛んでいなかった。VitePress 既定の見出しIDは括弧をハイフンにし、NFKD 正規化で濁点を分解する。リンクは GitHub の規則で書かれていた。`vitepress build` はページへのリンク切れしか見ないため、気づいたのは C3 の作業中の偶然で、AI が「実際のIDで書いた」はずのリンクも濁点のせいで壊れていた。人間の目でもAIの確認でも拾えない種類の問題なので、機械で止める
   - 反映先：`docs/.vitepress/config.mts`（見出しIDを GitHub の規則に）、`scripts/check-doc-anchors.mjs`、`package.json` の `docs:build`、`AGENTS.md` のコマンド一覧
   - きっかけ：作業中の失敗（偶然の発見） ／ 止め方：機械（ビルド時の検査）
5. **（Claude Code 固有）書き換えのスクリプトはファイルにして、UTF-8 で出力する**
   - 理由：C3〜C5 で、heredoc で渡したスクリプトがバックスラッシュの解釈や cp932 への出力で失敗し、途中まで書き換えて止まることが数回あった
   - 反映先：`CLAUDE.md`「Claude Code 固有の補足」（ツール固有の話なので `docs/process/` には書かない）
   - きっかけ：作業中の失敗 ／ 止め方：手順・ルール（CLAUDE.md）。2026-10-03 に機械（Claude Code のフック）へ

### 2026-09-27 C2（自動戦闘エンジン）の振り返りから5件を採用

C2（`docs/plans/2026-09-23-自動戦闘エンジン.md`、PR #6）の振り返りでAIが出した候補を、人間がすべて採用した。

1. **人間レビューの前に、AIが変更した画面をブラウザで通しで操作して確かめる**
   - 理由：人間レビューで初めて見つかった問題が4件あった（村スタートの名乗りの流れ、GMの台詞カード、「辺りを見回す」での行き止まり、自動戦闘パネルのレイアウト崩れ）。AIレビューを計5ラウンド回し、テストも121件あったが、どれも拾えなかった。ページ描画テストは画面の重なりを判定できず、APIのテストは「画面で次に何を押せるか」を見ていなかった
   - 反映先：`docs/process/index.md` の手順7、`docs/process/rules/review.md`「静的レビューの限界」、`docs/process/prompt-sample.md` の依頼文7、`.claude/skills/dev-cycle`
   - きっかけ：人間レビュー ／ 止め方：手順・ルール
2. **人間が補えない進行は、画面から最後まで通すテストを新規テストケースに必ず含める**
   - 理由：GM不在のセッションの行き止まりは C1 からあった。C1 のテストは API の単発の操作が中心で、画面から先へ進み続けられるかを確かめていなかった
   - 反映先：`docs/process/index.md`「プランドキュメントの8項目」の5、`docs/process/prompt-sample.md` の依頼文3（[4]を追加）
   - きっかけ：人間レビュー ／ 止め方：手順・ルール（プランの新規テストケース）
3. **ガード・回帰のテストは、守っている条件を一時的に外して落ちることを確かめる**
   - 理由：「ガードを消しても別の経路で同じ結果になり、通ってしまうテスト」が2回見つかった（終了済みセッションの拒否、人間GMのセッションの回帰）。どちらも AI レビューの指摘で直した
   - 反映先：`docs/process/rules/testing.md`「骨抜き禁止」、`.claude/skills/tdd`
   - きっかけ：AI レビュー ／ 止め方：手順・ルール
4. **プランを書き終えたら、関連する正式仕様の決着と各決定事項を突き合わせる**
   - 理由：プランの AI レビューで、決着済みの仕様との矛盾が P0 として2件出た（カウント制は濃密モード専用、HP0で戦闘不能タグ）。grilling で決めた方針が、既存の決着を踏まえていなかった
   - 反映先：`docs/process/index.md` の手順1、`docs/process/prompt-sample.md` の依頼文1、`.claude/skills/dev-cycle`
   - きっかけ：AI レビュー ／ 止め方：手順・ルール
5. **人間レビューで出た追加要望は、受け入れ条件に必要なものだけ同じPRで対応する**
   - 理由：PR #6 には人間レビュー後に3つの追加が積み上がり（条件付きの方針、シミュレーションの仕組み化、導入体験の修正）、30ファイルを超えた。一方で画面の崩れは別の課題に分けており、分け方が場面ごとに違った
   - 反映先：`docs/process/index.md`「手順」の直後、`.claude/skills/dev-cycle`
   - きっかけ：人間レビュー ／ 止め方：手順・ルール

### 2026-09-27 実装の不具合・見送った課題の置き場所として「既知の問題」を新設

- **内容** — `docs/architecture/known-issues.md` を新設し、実装で見つかった不具合と、レビューで見送った課題（P2 など）をここに置く。ゲームの仕様の論点は `docs/open-questions.md`、開発プロセスの改善候補はこのページと使い分ける。直したら項目を消す
- **理由** — レビュールールは「P2 は時間がなければ TODO 化」としていたが、その TODO の置き場所が決まっておらず、見送った課題が各プランの末尾に散らばっていた。PR #6 の人間レビューで見つかった画面の崩れを「別の問題」としてリポジトリ内に残す場所も無かった（人間の判断で新設）
- **反映先** — `docs/architecture/known-issues.md`、`docs/process/rules/review.md`「指摘の優先度分類」、サイドバー。C2 で見送った課題を移した（C1 以前のプランの見送り分は移していない）
- **きっかけ** — 人間レビュー（PR #6 の画面の崩れを残す場所が無かった） ／ **止め方** — 置き場所

### 2026-09-21 E2E（Playwright）を早期導入し、GitHub Pagesでスクリーンショット付きレポートを公開できるようにした

- **内容** — `apps/web/e2e/smoke.test.ts` を新設し、`routes.ts`（サイトマップの唯一の情報源）の全20ルートを実ブラウザ（Chromium）で巡回する。動的ルートは既存の `route.example` を使う。合否判定は「遷移が例外なく完了」「`role="alert"`のエラー表示が無い」「console error/pageerrorが無い」の汎用3点チェック（`route.title`と実際の見出しの一致は見ない。動的ページでは意味を持たないため）。`/admin/components`（UI部品カタログ）は`ErrorNote`を見本として意図的に表示するため、アラートチェックのみ除外している
- **CI・deployの非対称構成** — `ci.yml`にE2Eを追加してPRをブロックする条件にした。`deploy.yml`ではE2Eが失敗してもデプロイを止めない（`continue-on-error: true`）。C1の「型検査・テストはCIでゲート、デプロイはテストの成否を待たずに走る」という決定と同じ構成に揃えた
- **GitHub Pagesへの公開** — GitHub Pagesが「1サイト1アーティファクト」（`actions/deploy-pages`）である制約に対応するため、新設した `scripts/copy-e2e-report-to-pages.mjs` でPlaywrightのHTMLレポートを`docs/.vitepress/dist/e2e-report/`へコピーしてから、既存のPages公開パイプラインに相乗りさせた。既存の`copy-web-to-pages.mjs`と異なり、レポートが存在しない場合は警告のみで正常終了する（`if: always()`で必ず実行されるステップのため、デプロイ全体を落とさないように）
- **設計の経緯** — `docs/plans/2026-09-21-e2e導入.md` をgrillingスキルで作成し、design-reviewerのレビューでP0が2件（スクリーンショット設定の欠落、`testing.md`との矛盾）、P1が4件（CI内の二重ビルド、`testDir`未指定、pre-pushフックとの関係未定義、レポート欠損時の失敗設計）、P2が3件（`web-app.md`未更新、`.gitignore`未更新、excludeパターンの頑健性）見つかり、すべて反映してから実装した
- **確認** — `pnpm web:typecheck`・`pnpm web:test`・`pnpm web:e2e`（20件全通過）・`pnpm docs:build` は全て通過
- **反映先** — `apps/web/playwright.config.ts`（新設）、`apps/web/e2e/smoke.test.ts`（新設）、`apps/web/vite.config.ts`、`apps/web/tsconfig.json`、`apps/web/package.json`、`package.json`、`.gitignore`、`scripts/copy-e2e-report-to-pages.mjs`（新設）、`.github/workflows/ci.yml`・`deploy.yml`、`docs/process/rules/testing.md`、`docs/architecture/web-app.md`、`docs/plans/2026-09-21-e2e導入.md`
- **きっかけ** — 人間の要望 ／ **止め方** — 機械（CI）

### 2026-09-21 定期リファクタリング（C5）でbarrel exportを解消し、RoleBadge/Avatarのpropを改名した。プランファイル名規約も明文化した

- **内容（barrel解消）** — `apps/web/src/components/index.ts` を削除し、19ファイルの import をすべて実ファイル（`./components/ui`・`./components/GameCard`・`./components/play`・`./components/DeckTree`）への直接importに書き換えた。アーキテクチャルールの「barrel export は新規に作らない」の既存の唯一の逸脱を解消した
- **内容（RoleBadge/Avatarのprop改名）** — `RoleBadge` の `role` prop を `badgeRole` に、`Avatar` の `role` prop を `avatarRole` に改名した（`ui.tsx`・呼び出し元23箇所）。ARIAの `role` 属性と衝突しなくなったため、Biome導入時に付けた `biome-ignore lint/a11y/useValidAriaRole` コメント19箇所を全て削除できた。DOM側の `data-role` 属性・CSSセレクタ（`ui.module.css`）は変更していない
- **内容（プランファイル名規約）** — `docs/process/index.md`「プランドキュメントの8項目」に、`<機能>` 部分は日本語で書ける内容なら日本語にする旨を追記した。既存のローマ字ファイル（`2026-09-16-dev-process-foundation.md`）はリネームしない
- **保留（肥大ファイル分割）** — `CreatorSceneEditPage.tsx`（399行）の分割は、置き場所のルールが未定義だったため見送った。詳細は上の候補一覧を参照
- **確認** — `pnpm web:typecheck`・`pnpm web:test`（64件）・`pnpm lint` は全て通過（既存の警告4件は今回の変更と無関係）
- **理由** — ユーザーから、進化ログの候補一覧（RoleBadge/Avatarのprop改名・プランファイル名規約・E2E導入時期）とプランのC5・C6を進めたいと依頼された。prop改名は「今後のprop名を混乱させないため」明示的に要望があった
- **反映先** — `apps/web/src/components/index.ts`（削除）、`apps/web/src/components/ui.tsx`・`play.tsx`、`apps/web/src/pages/**`（19ファイル）、`docs/process/index.md`、`docs/process/evolution.md`
- **きっかけ** — 人間の要望（候補の消化） ／ **止め方** — コードの整理（lint の抑制コメントが不要に）、手順・ルール（プランのファイル名）

### 2026-09-21 フック化で不要になったAI向け指示を削減し、Biomeでさらに2ルールを機械化した

- **内容（不要な指示の削減）** — C2・pre-push導入（2026-09-16〜21）でlint・型検査・テスト・docsビルドがgitフックで自動化されたのに、`.claude/skills/eng-practices`・`create-pr`・`docs/process/index.md`・`docs/process/rules/testing.md`には、AIに同じチェックを手動で再実行させる記述がそのまま残っていた。フックが直後に同じチェックを再実行するだけの箇所（eng-practicesの仕上げ、create-prのPR本文用の再実行）は削除し、ライトルートの「コミット前テストを必ず通す」という表現も「フックが自動でやる」に書き換えた。tdd・prompt-sampleの「作業の節目で自分で実行して確認する」系の指示は、フックとは目的が違う（開発中の早期フィードバック、AIレビュー前の安全網）ため残した
- **内容（新規ルールの機械化）** — `biome.json`に`suspicious.noConsole`・`suspicious.noSkippedTests`・`suspicious.noFocusedTests`を`error`で追加し、`linter.domains.test`を`"all"`にした（vitestのdomain検出だけでは発火しなかったため明示指定が必要だった）。`scripts/**`（Node.jsのビルドスクリプト）は`overrides`で`noConsole`を除外。これにより、`docs/process/rules/architecture.md`の「業務コードにconsole.*を残さない」と`docs/process/rules/testing.md`の「.only/.skipを残したままコミットしない」が、人間・AIが覚えてgrepする運用からコミット前フックでの機械的な検知に変わった
- **理由** — ユーザーから「lintやtestをhookにしたことで、エージェントやスキルで無駄になったところはないか確認して削除してほしい。他にhookにできるものがあれば提案して」と依頼された。モデル非依存の基盤の原則5「AIにlint結果を読ませてトークンを使うより、機械で止める」に沿って、フックで担保済みの確認をAIに二重に行わせない方針を徹底した
- **反映先** — `biome.json`、`.claude/skills/eng-practices/SKILL.md`、`.claude/skills/create-pr/SKILL.md`、`docs/process/index.md`、`docs/process/rules/testing.md`、`docs/process/rules/architecture.md`
- **きっかけ** — 人間の要望 ／ **止め方** — 機械（lint）

### 2026-09-21 pre-commitフックが安全な指摘を自動修正・再ステージするよう変更

- **内容** — `.githooks/pre-commit` を `biome check --staged`（チェックのみ）から `biome check --staged --write`（安全な指摘は自動修正）に変更。`--write`で直った内容を`git add`で再ステージしてからコミットを続行する。`--unsafe`が要る指摘（C2で意図的に自動適用しない方針にしたもの）だけ引き続きコミットを止める
- **理由** — ユーザーが`vite.config.ts`にコードを1行足した際、ダブルクォート等のフォーマット崩れだけでコミットが止まり、`pnpm lint:fix`を別途手で挟む必要があった。フォーマット崩れは判断の要らない機械的な指摘なので、直すことも機械にやらせる方が「AIにトークンを使わせず機械的に止める」という狙いに合う
- **反映先** — `.githooks/pre-commit`、`AGENTS.md`
- **きっかけ** — 人間の要望（作業中の不便） ／ **止め方** — 機械（git フック）

### 2026-09-16 モデル非依存の実証（C3）— メモリの運用知識をdocsへ移し、Opusでの試走で確認した

- **内容（C3a: メモリ→docs）** — Claude Code の自動メモリにあった `apps/web` の運用知識のうち、他ツール・他モデルにも必要なもの（`MSYS_NO_PATHCONV=1` が要る理由、pnpm workspace の peer 解決で vitest が壊れる件と `.npmrc` の意図、シーン構築・戦闘画面がまだReact化されていない旨）を `docs/architecture/web-app.md` に「ローカル開発の注意」「未React化の画面」として書き出した。Claude Code のBashツール固有の癖（長いheredocが壊れる→Writeツールを使う）は `docs` ではなく `CLAUDE.md`（Claude Code固有の補足）に置いた。元のメモリファイル（`web-app-react-phase.md`）は要点とdocsへのポインタだけに縮めた
- **内容（C3b: 別モデルでの試走）** — このセッション（Sonnet 5）から、Opus 5 のサブエージェントを1体、会話文脈ゼロの状態で起動。「シーン構築画面をReact化したい。プロジェクトのルールに従って進めてください」という一文だけを与え、ファイル変更は禁止（読み取りのみ）で、実際の挙動を再現させた
- **結果：良好。** `AGENTS.md` → `docs/process/index.md` → `dev-cycle`／`grilling` スキルを自力で発見し、①フルルートが適用されると正しく判定、②プランが無いので実装せず質問ラウンドを出す、という最重要ルール4どおりの挙動を取った。`docs/open-questions.md` の未決論点（シーンの「目的・終了条件」）に触れる箇所は、AIが決めずにユーザーへの質問にした（グリリングの「未解決論点に関わる判断だけをユーザーに委ねる」を遵守）。質問の根拠として `docs/process/rules/architecture.md`・`prototype-handover.md`・既存コードの用語を具体的に引用しており、思考の型が本セッションの振る舞いと近い水準だった
- **副産物として見つけた不具合** — Opus が「`docs/architecture/web-app.md` の『未React化の画面』が実装と食い違っている（サイトマップ`/admin/sitemap`からは辿れないのに『試作元として参照している』と書いてある）」と指摘。確認したところ事実で、**この指摘自体がC3aで数分前に私（Sonnet 5）が書いた記述の誤り**だった。サイトマップの `prototype` フィールドは `routes.ts` に既にあるルートにしか付けられないため、まだReact化されていない画面はサイトマップから辿れない。該当箇所を修正した（試作は実際にはVitePressサイドバーの「試作」から見る）
- **評価** — 「別モデルでも `AGENTS.md` だけで正しい手順に入れるか」というC3の目的に対して肯定的な結果。加えて「独立したAIレビューが自分の作業の誤りを見つける」という `docs/process/rules/review.md` の狙いも、プロセス文書自体の執筆というメタな場面で実証された
- **反映先** — `docs/architecture/web-app.md`、`CLAUDE.md`、`.claude/memory/web-app-react-phase.md`、`.claude/memory/MEMORY.md`
- **きっかけ** — 計画（基盤整備） ／ **止め方** — 置き場所（メモリから docs へ）

### 2026-09-16 Biome を導入し、コミット前フックとCIでlintを回す（C2）

- **内容** — `biome.json`（既存コードのスタイルに合わせてシングルクォート・セミコロンあり・トレイリングカンマ）を追加し、`pnpm lint` / `pnpm lint:fix` を用意。`.githooks/pre-commit` が `biome check --staged` を実行してコミットを止め、`pnpm install` の `prepare` スクリプト（`scripts/setup-git-hooks.mjs`）が `core.hooksPath` を自動設定する。CI にも `pnpm lint` を追加（フック未設定・`--no-verify` の取りこぼし検出）
- **既存コードへの適用** — 安全なフォーマット・import整理を全体に適用。a11yの指摘4件（`useAriaPropsSupportedByRole`・`noLabelWithoutControl`・`noArrayIndexKey`×2）は手で修正・理由を明記して抑制。`useValidAriaRole` の誤検知19箇所（`RoleBadge`/`Avatar` の独自 `role` prop を ARIA の role 属性と誤認）は `biome-ignore` コメントで個別に抑制した
- **`--unsafe` 自動修正は使わない方針にした** — 一度 `biome check --write --unsafe` を試したところ、上記の誤検知を「無効なARIAロール」として `role` 属性ごと削除してしまい、UIの見た目（`RoleBadge`/`Avatar` が役割を表示できなくなる）と `tsc` の型エラー（`noNonNullAssertion` の安全でない除去による）の両方を壊すことが判明した。安全網（typecheck・test）で検出できたため実害はなかったが、以降は `--write`（safeのみ）だけを使い、`--unsafe` の指摘は個別に判断する
- **残課題** — `noNonNullAssertion`（5箇所）・`noDescendingSpecificity`（2箇所）は警告のまま残した（lintはブロックしない）。`RoleBadge`/`Avatar` の `role` prop 名を変える案は「候補」に追記した
- **反映先** — `biome.json`、`package.json`、`.githooks/pre-commit`、`scripts/setup-git-hooks.mjs`、`.github/workflows/ci.yml`、`AGENTS.md`、既存の `apps/web/src/**`（フォーマット・a11y修正）
- **きっかけ** — 計画（基盤整備） ／ **止め方** — 機械（lint・git フック・CI）

### 2026-09-16 push前に型検査・テスト・docsビルドを通す `.githooks/pre-push` を追加

- **内容** — `pre-commit`（lintのみ）に加えて `pre-push` を追加し、push前に `pnpm web:typecheck && pnpm web:test && pnpm docs:build`（CIと同じ3つ）をローカルで実行してから push させるようにした。失敗時は push を中止する
- **理由** — ユーザーから「push の前にもテストがローカルで通ることを確認する hook が欲しい」との要望。コミット単位では途中経過のコミットがテスト未通過でも構わない場合があるが、push（他者・CIに見える境界）の前には確実に通したい
- **反映先** — `.githooks/pre-push`、`AGENTS.md`
- **きっかけ** — 人間の要望 ／ **止め方** — 機械（git フック）

### 2026-09-16 CI に型検査・テスト・docsビルドの安全網を追加（C1）

- **内容** — `.github/workflows/ci.yml` を新設。`main` への push と PR（C6 で PR 運用を始めたときのため）で `pnpm web:typecheck` → `pnpm web:test` → `pnpm docs:build`（リンク切れ検査）を順に実行する。既存の `deploy.yml`（ビルド・デプロイ）とは分離し、デプロイは従来どおりテストの成否を待たずに走る
- **理由** — これまで型検査・テストが落ちていてもデプロイされる状態だった。lint はコミット前フック（C2）に任せ、CI では取りこぼし検出はまだ担わない（C2 実装時に `pnpm lint` を追加する）
- **反映先** — `.github/workflows/ci.yml`、`docs/plans/2026-09-16-dev-process-foundation.md`（C1 完了）
- **きっかけ** — 計画（基盤整備） ／ **止め方** — 機械（CI）

### 2026-09-16 『プロフェッショナルAI駆動開発』のサンプル構成を移植し、開発プロセスを文書化

- **内容** — ローカルにある書籍サンプル（`proffesional-ai/`、git 管理外）の AGENTS.md・rules・agents・skills・依頼文雛形を、このプロジェクトの構成（pnpm モノレポ、React + MSW、バックエンド未実装、直 push 運用）に合わせて書き直した
- **主な判断**
  - 開発プロセスの正を `docs/process/` に置き、`AGENTS.md` をツール非依存の入口、`.claude/` を呼び出し口の薄い層にした（Fable・Claude Code が使えなくても回るように）
  - サンプルの `docs/rules/` は `docs/process/rules/` に、`.claude/plans/` は既存設定に合わせて `docs/plans/` にした
  - database・logging のルールはバックエンド未着手のため独立ファイルにせず、アーキテクチャルールの「将来のバックエンド（予約）」に原則だけ残した
  - サンプルの「PR前に必ずAIレビュー」は、直 push 運用と衝突するため「`apps/`・`packages/` の振る舞いを変える変更は push 前」「docs のみは省略可」というフル／ライトの2ルートに変えた
  - サブエージェントは `model: inherit` にし、サンプルの security-reviewer の代わりに、このプロジェクトで価値の高い spec-reviewer（docs SSOT との整合）を置いた
  - `docs/prompt-sample.md` は丸写しで存在しないパスを参照していたため、`docs/process/prompt-sample.md` に移して書き直した
  - grilling スキルの「本プロジェクトでの位置づけ」節が別プロジェクト（tabifuda）の構成を参照していたため、この開発サイクルに合わせて直した
- **反映先** — `AGENTS.md`、`CLAUDE.md`、`docs/process/`、`.claude/agents/`、`.claude/skills/`、`docs/plans/2026-09-16-dev-process-foundation.md`
- **きっかけ** — 人間の要望 ／ **止め方** — 手順・ルール（文書化）、置き場所

## 却下

新しいものを上に。書式は採用済みと同じ（理由を必ず書く）。

### 2026-10-03 Biome の設定に対する固定のテスト（違反を書いた見本のファイルに lint をかける）

- **内容（候補）** — FSD 移行（PR #13）で、Biome の層の検査が効くことを、実ファイルに違反を一時的に入れる手作業（46ケース）で確かめた。設定を後で壊したときに気づけるよう、見本のファイルに lint をかけるテストを常設する案
- **却下の理由** — 人間の判断。中身は設定値だけで、今回確かめたなら足りる。見本のファイルは、層やスライスを変えるたびに直す手間がかかり、ごみになりかねない。設定を壊しても、既存のコードの違反が出る形で気づける場面が多い
- **きっかけ** — 作業中の振り返り（AI の提案） ／ **止め方** — （作らない）
