# プラン：シーン構築画面のReact化

書式は `docs/process/index.md` の「プランドキュメントの8項目」。開発サイクル（C4）を初めてフルで回す題材。インタビュー（グリリング）の質問・回答は本文中に反映済み。

**手順2〜3（AI相互レビュー）を実施済み。** design-reviewer相当（設計整合性）・spec-reviewer相当（仕様整合性）・テスト網羅レビューの3観点をサブエージェントで並列実行した。設計整合性・テスト網羅のP0〜P2はこのプランに反映済み。仕様整合性のP0（「目的・終了条件」が既存の3要素構造・セッション終了条件と役割が重複しないか）は、AIが独断で決めるべきではない判断のため、人間に確認中（末尾「未確定事項」参照）。

## 1. 概要

シナリオ製作者がシーン単位でロケーション・NPC・情報・イベント・エネミーカードを編集できる画面を`apps/web`に追加する。`docs/public/preview/scene-builder.html`の試作をもとにReact化する。

## 2. 背景

- 対応する仕様ページ：[カードの裏表](../cartagraph/card-face-back.md#個々のカード種別ごとの裏表の運用決着)（ロケーションカードの暫定分類）、[カード・デッキの考え方](../cartagraph/card-and-deck.md)、[場・手札・プレイ](../cartagraph/play-and-field.md)（ゾーン構造）
- 未解決論点：[docs/open-questions.md](../open-questions.md)の「シーンカードの『目的』『終了条件』という属性」は未決のまま。今回は仮ルールとして実装する（後述）
- 現状のギャップ：[CreatorScenarioEditPage.tsx](../../apps/web/src/pages/creator/CreatorScenarioEditPage.tsx)は「シーン内のカード編集（ロケーション・NPC・イベントの配置）は次の段階で追加する」と明記したまま止まっている
- このサイクル自体が、`docs/process/index.md`の開発サイクルを初めてフルで回す実証（基盤整備プランのC4）

### インタビューでの決定事項

1. **シーンの「目的・終了条件」** — 仮ルールとして実装し、画面に「仮」と明示する（能力値配分と同じ前例に倣う）。フィールドは、既存コードを調査した結果、`CardDef(kind: 'scene')`は`Session.field`専用（GM専用ゾーンに置く「未開示の次シーン」を表すランタイム概念）で`Scenario.deck`内では使われていないことを確認したため、**`DeckNode`自体に`objective`/`endCondition`として追加する**（新しいCardDefは作らない）
2. **画面の持ち主ロールとURL** — シナリオ製作者専用。`/creator/scenarios/:scenarioId/scenes/:sceneId`。GM向けシーン編集は別サイクルに回す
3. **シーンのカード構造** — シーンの`cards`配列を「そのシーンに直接置かれたカード」として扱い、シーンノード単体で完結させる。`DeckNode.children`は使わない。独立したnpc/info/enemyのプールノード（既存データに一部存在する）は今回触らない
4. **MVPの操作範囲** — ロケーションの差し替え、NPC/情報/イベント/エネミーカードの追加・削除、ゾーン切替、裏表切替、**画像設定（localStorageモック）**、保存。並べ替え（D&D）と共有ライブラリからのコピーはスコープ外
5. **保存** — 既存の`useUpdateScenario`（`PATCH /api/scenarios/:id`）＋「draft state＋dirty＋保存ボタン」パターンを踏襲（`CreatorScenarioEditPage.tsx`と同型）
6. **新規カード追加の母集団** — その場で新規作成（名前必須、kindはnpc/info/choice/enemyから選択）。共有ライブラリからのコピーは見送り
7. **画像設定の実装方式** — ファイル選択→`FileReader`でdata URL化。**保存ボタンを押したタイミングで**`localStorage`（キー：`cartagraph:cardImage:<cardId>`）へ書き込む。表示・PATCH本文には通常の`portraitUrl`と同様に流す。読み込み時に`portraitUrl`が無ければ`localStorage`の値で補う。容量が大きい場合は軽い警告のみ（圧縮等はしない）

## 3. 詳細設計

### ルート

`apps/web/src/app/routes.ts`に追加：

```ts
{
  path: '/creator/scenarios/:scenarioId/scenes/:sceneId',
  title: 'シーン編集',
  group: 'creator',
  description: 'ロケーション・NPC・情報・イベントカードの配置、目的・終了条件（仮）の編集',
  example: '/creator/scenarios/sc-gray-mansion/scenes/d-s2',
  prototype: 'scene-builder.html',
}
```

**`apps/web/src/app/router.tsx`にも対応するルートオブジェクトを追加する**（`CreatorSceneEditPage`のインポート＋登録）。`routes.ts`だけでは画面に到達できず、`pages.test.tsx`の「routerのパス一覧とroutes.tsが一致する」テストも失敗する（design-reviewer相当のレビューで指摘されたP0）。

### ドメイン型（`packages/domain/src/index.ts`）

`DeckNode`に追加：

```ts
/** シーンの目的（仮ルール。docs/open-questions.md「シーンカードの『目的』『終了条件』という属性」が未決のため、正式仕様ではない） */
objective?: string;
/** シーンの終了条件（同上、仮ルール） */
endCondition?: string;
```

用語の意味を変えるわけではなく未解決論点への仮対応のため、architecture.mdの「先にdocsを更新」ルールの対象外（キャラクター作成の能力値配分と同じ扱い）。`docs/open-questions.md`は「未決」のまま変更しない。

型は`DeckNode`全体に追加するため、`intro`/`ending`/`npc`等の非シーンノードにも技術的には設定可能になる（意図は「シーンのみ」）。型レベルでの強制はせず、フィールドのコメントと実装（UIで`kind === 'scene'`のときだけ表示・保存）で意図を示す（仕様整合性レビューのP2、対応は軽微のため実装時のコメントで済ませる）。

### 新規：`apps/web/src/lib/cardImageStorage.ts`

画像のlocalStorage読み書きを薄い層に切り出す（Functional Core/Imperative Shell）。

```ts
const keyOf = (cardId: string) => `cartagraph:cardImage:${cardId}`;
export function saveCardImage(cardId: string, dataUrl: string): void
export function loadCardImage(cardId: string): string | undefined
export function removeCardImage(cardId: string): void
```

`lib/`に置く理由（設計整合性レビューのP1に対応）：architecture.mdの判断順は「1ページでしか使わないなら`pages/<ロール>/`」を「APIアクセスなら`lib/`」より優先するが、localStorageの読み書きはHTTP APIではなくブラウザの副作用であり、Functional Core/Imperative Shellの「DBの読み書き・外部API・時刻・乱数・環境変数参照は外部の薄い層へ寄せる」に該当する。`lib/format.ts`・`lib/japanese.ts`と同じ「薄い変換・副作用の層」として`lib/`に置く。将来2ページ目の利用者が現れなくても、副作用を隔離してテストしやすくする狙いを優先する。

### 新規：`apps/web/src/pages/creator/CreatorSceneEditPage.tsx`

- `useParams<{scenarioId, sceneId}>()` → `useScenario(scenarioId)` → `draft.deck`から`id === sceneId`の`DeckNode`を検索
- 見つからない場合は`ErrorNote`相当の表示（既存の`scenario.error`分岐に倣う）
- 編集項目：シーン名、目的（仮）、終了条件（仮）、ロケーション（1枚・差し替え）、その他のカード一覧（追加・削除・ゾーン切替・裏表切替・画像設定）
  - ロケーション枠：既存データにはロケーション0枚のシーン（`sc-galleon`の`g-s1`・`g-s3`）がある。カードが無ければボタン文言を「ロケーションを設定」、あれば「差し替え」にする（同じ入力フォームを開く）。ボタンは1つの`kind === 'location'`の`CardDef`を作成／置換するだけで、2枚目以降の扱いは決めない（card-face-back.mdの「現時点では1シーン1ロケーションを想定した暫定分類」のとおり）
  - 新規カードの名前は必須。空のまま追加しようとした場合は追加せずインラインでエラー表示する
  - 画像が一定サイズ（目安200KB）を超えるdata URLになった場合は、保存は止めず画面に軽い警告を出す
- 保存：`useUpdateScenario()`で**シナリオ全体**の`deck`を含めてPATCH（既存パターンと同じ粒度）。画像は保存と同時に`cardImageStorage`へ書き込む
- `GameCard`・`ui.tsx`の既存コンポーネント（`Panel`・`Button`・`Field`・`PageHeader`・`ZonePill`等）を再利用し、試作HTMLのクラス構造は持ち込まない

### 既存ファイルの変更

- `CreatorScenarioEditPage.tsx`：各シーンノードに「編集」リンク（`Link to`）を追加。末尾の「次の段階で追加する」という注記を削除
- `docs/architecture/web-app.md`：「未React化の画面」節からシーン構築を外す（戦闘画面のみ残す）

## 4. テスト影響範囲

- `apps/web/src/test/pages.test.tsx`の「router のパス一覧と routes.ts が一致する」「全ルートにh1が出る」テストは、新ルート追加で自動的に対象へ入る（`example`を指定するため）
- `CreatorScenarioEditPage`に対する既存の専用テストは無く、上記のh1描画テストのみが対象。編集リンク追加による破壊的変更はない

## 5. 新規テストケース

`apps/web/src/test/CreatorSceneEditPage.test.tsx`（新規。テスト網羅レビューの指摘を反映）：

- 正常系：シーン名・目的・終了条件を編集して保存すると、再取得結果に反映される
- 正常系：ロケーションカードを差し替えると場所が変わる
- 正常系：ロケーションが無いシーンでは「ロケーションを設定」ボタンが出て、設定すると1枚追加される
- 正常系：NPC/情報/イベント/エネミーの各kindを新規追加すると、対応するラベル表示で一覧に増える（4種すべてを確認する。1種だけで済ませない）
- 正常系：カードを削除すると一覧から消える
- 正常系：ゾーン（GM専用⇄PL可視）を切り替えられる
- 正常系：裏表（faceDown）を切り替えられる
- 正常系：画像をアップロードして保存すると、`localStorage`に書き込まれる
- 正常系：`portraitUrl`が無いカードで、事前に`localStorage`へ値がある場合は画面表示に反映される（読み込みフォールバック）
- 異常系：画像をアップロードしただけ（保存前）では`localStorage`に書き込まれない
- 異常系：カード名を空のまま追加しようとすると追加されず、インラインエラーが出る
- 境界値：カードが0枚のシーンでも一覧が空で表示され、追加できる
- 異常系：存在しない`sceneId`でアクセスするとエラー表示になる
- 表示：目的・終了条件の欄に「仮」の表示があることを確認する
- 表示：画像が大きい場合に警告が出る
- 回帰：`CreatorScenarioEditPage`から「編集」リンクをクリックすると`/creator/scenarios/:id/scenes/:sceneId`へ遷移する（`pages.test.tsx`の既存パターン「予算内なら作成でき、シートへ遷移する」に倣い、`router.state.location.pathname`を検証）
- 回帰：シーンを編集・保存しても、独立プールノード（`d-npc`等）の内容は変化しない
- 回帰：`pages.test.tsx`の「routerのパス一覧とroutes.tsが一致する」テストが通ること

`apps/web/src/test/cardImageStorage.test.ts`（新規。`testing.md`の「対象ファイル名を反映」規則どおり`test/`配下に置く）：

- 保存→読み込みで同じdata URLが返る
- 未保存のcardIdは`undefined`を返す
- 削除後は`undefined`を返す

## 6. 実装順

| # | タスク | 担当の目安 |
|---|---|---|
| 1 | `packages/domain`：`DeckNode`に`objective`/`endCondition`を追加 | 軽いモデルで可 |
| 2 | `lib/cardImageStorage.ts`をTDDで実装（Red→Green） | 軽いモデルで可 |
| 3 | `routes.ts`と`router.tsx`にルート追加（両方） | 軽いモデルで可 |
| 4 | `CreatorSceneEditPage.tsx`をTDDで実装（画面骨格→カード編集→保存の順） | 強いモデル推奨（設計判断を伴う） |
| 5 | `CreatorScenarioEditPage.tsx`に編集リンク追加、注記を削除 | 軽いモデルで可 |
| 6 | `docs/architecture/web-app.md`を更新 | 軽いモデルで可 |
| 7 | `CreatorSceneEditPage.test.tsx`をTDDで実装、`pages.test.tsx`の一致性を確認 | tddスキルに沿って進める |
| 8 | AIレビュー（design-reviewer／edge-case-reviewer／spec-reviewerを並列） | サブエージェント |
| 9 | `pnpm lint && pnpm web:typecheck && pnpm web:test && pnpm docs:build` | — |

## 7. コミット前テスト実行

```sh
pnpm lint && pnpm web:typecheck && pnpm web:test && pnpm docs:build
```

## 8. スコープ外

- GM向けシーン編集画面（インタビューで作成者専用に決定）
- シーン進行画面（`scene-play.html`）・戦闘画面のReact化
- カードの並べ替え（ドラッグ＆ドロップ）
- 共有ライブラリからのカードコピー
- 目的・終了条件の正式仕様化（未解決論点のまま。仮ルールとして実装するのみ）
- 画像のサーバー保存・圧縮・厳密なサイズ制限（軽い警告のみ）
- 独立したnpc/info/enemyのプールノードの編集（既存データに残っているが今回は対象外）

## 未確定事項（人間の判断待ち）

仕様整合性レビュー（サブエージェント）から、次の指摘があった。

> `docs/open-questions.md`の当該項目は「持たせる場合、既存の3要素構造や[セッションの終了条件](../cartagraph/party-and-session.md#非同期セッションの進行決着)と役割が重複しないかも要確認」と、実装前の検証事項を明示している。プランはこの検証を行わずに「仮ルールとして実装してよい」と結論づけている。

`play-and-field.md`の3要素構造を確認したところ、「発火条件・効果・GM向け補足」は**カード1枚**に対する記述（そのカードが発火したときどうなるか）で、シーン単位の「目的・終了条件」は**シーン（複数カードの集まり）**に対する記述（GMがこのシーンをいつ終えて次へ進むかの目安）である。粒度が違うため、私の読みでは強い重複はないと考える。`party-and-session.md`の「セッションの終了条件」（シナリオ消化／GM宣言／無反応での中断）も、セッション全体（マクロ）の話でありシーン単位（ミクロ）の話とは階層が異なる。

ただし、これはゲームデザイン上の判断であり、AIが独断で「重複しない」と決めて進めるべきではないと判断した（AGENTS.md最重要ルール1・3、`docs/process/index.md`「未解決論点に関わる実装判断は、AIが決めずに人間へ渡す」）。**次のいずれかを選んで、着手前に回答してほしい。**

1. 上記の読み（粒度が違うので重複しない）で問題ない。このまま仮ルールとして実装を進める
2. 重複の懸念があるので、フィールド名・役割を見直したい（例：「終了条件」は「GM向け補足」に統合し、シーン単位では「目的」だけ持たせる 等）
3. この論点自体をgrillingで先に決着させてから実装したい（サイクルが増える）

➡️ 1を推奨する（上記の理由）。
