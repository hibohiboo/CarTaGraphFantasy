# プラン：React Best Practices（Vercel Labs）適用リファクタリング

書式は `docs/process/index.md` の「プランドキュメントの8項目」。

## 1. 概要

Vercel Labsが公開している「react-best-practices」スキル（70ルール・8カテゴリ、[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)）の観点で `apps/web` をレビューし、CRITICAL・HIGH相当の指摘に対応する。ルート単位のコード分割とSuspense境界の導入、QueryClientのキャッシュ方針の明文化、localStorageのバージョニング対応、不要な `useEffect`・IIFEの解消を行う。`packages/domain` の型変更はない。初回表示時に一瞬入るローディング表示（3.1）を除き、画面の見た目・操作結果（振る舞い）は変えない。

## 2. 背景

- ユーザー依頼により、react-best-practicesの観点でのコードレビューをサブエージェントで実施した（2026-09-22）
- 本プロジェクトはNext.jsではなくVite SPA・バックエンド未実装（MSW）のため、70ルールのうちRSC・Server Actions・`next/dynamic`・`after()` 前提のルール（カテゴリ3の大半）はレビュー対象から除外した
- 調査の結果、TanStack Queryの使い方自体は健全で、ウォーターフォール（カテゴリ1）の重大な違反は見つからなかった。実害はバンドルサイズ（カテゴリ2）と再レンダー最適化（カテゴリ5）に集中していた
- 対応方針は `grilling` スキルによるインタビューで確定した（本プラン作成時点の対話）
- 関連する未解決論点（`docs/open-questions.md`）はない。パフォーマンス・構造面の改善であり、仕様判断を伴わない
- 対応する仕様ページ（`docs/cartagraph/` 等）はない。純粋に実装上のリファクタリングであり、ゲームデザイン仕様には触れない

## 3. 詳細設計

### 3.1 CRITICAL：ルート単位のコード分割 + Suspense境界

対象は `admin/*`（`SitemapPage`・`ComponentCatalogPage`）と `creator/*`（`CreatorScenarioListPage`・`CreatorScenarioEditPage`・`CreatorSceneEditPage`）の計5ページ。いずれも通常のプレイヤー・GM導線では訪れないロール別ページ。

- `apps/web/src/app/router.tsx` で、対象5ページのimportを `React.lazy(() => import('../pages/.../XxxPage').then((m) => ({ default: m.XxxPage })))` に変更する（named exportのため `.then` でdefault化する）
- 各lazyコンポーネントの `element` を `<Suspense fallback={<Loading />}><XxxPage /></Suspense>` でラップする。`Loading` は `components/ui.tsx` の既存コンポーネントを流用し、新規コンポーネントは作らない。5箇所とも `what` は指定せずデフォルトの「読み込み中」表示に統一する（対象5ページの既存 `isPending` 分岐も全て `<Loading />` のみを使っており、個別メッセージの慣習がない）。ラップ処理は5箇所で同一のため、`router.tsx` 内に小さなヘルパー関数 `lazyPage(element)` を置いて重複を避けてよい（新規コンポーネントではなく実装上のヘルパー関数）
- `gm/*`・`pl/*`・`rulebook/*`・`HomePage`・`EntrancePage` はプレイヤー・GMが高頻度で使う画面のため対象外（現状の静的importを維持）

### 3.2 HIGH：QueryClientのキャッシュ方針の明文化

- `apps/web/src/main.tsx` の `QueryClient` 設定値（`retry: false, staleTime: 5_000`）は変更しない
- `docs/architecture/web-app.md` の「位置づけ」節（バックエンド未実装の説明がある箇所）に、現在の設定値とその理由、「実バックエンド接続後に実測してから見直す」という方針を一文で追記する
- 理由：バックエンドが未実装（MSWモック、状態はメモリ上）でレイテンシ・更新頻度が測定できない段階のため、数値のチューニングは行わない。これは `docs/process/rules/architecture.md` の「将来のバックエンド（予約）」節そのものの内容（DBマイグレーション方針等）ではなく、同節が体現する「バックエンドができるまで詳細を決め切らず原則だけ置く」という姿勢に倣ったもの

### 3.3 HIGH：localStorageのバージョニング（`cardImageStorage.ts`）

- 保存形式を「data URL文字列そのもの」から `{ version: 1, dataUrl: string }` のJSONへ変更する
- `saveCardImage` / `loadCardImage` / `removeCardImage` の関数シグネチャ（呼び出し側から見えるインターフェース）は変えない
- `loadCardImage`：`localStorage.getItem` した生の値 `raw` を次の順で処理する。
  1. **`raw === null`（キー未保存）なら即座に `undefined` を返す。** `JSON.parse(null)` は例外を投げず暗黙的に `"null"` として解釈され値 `null` を返すため、このガードを`JSON.parse`より前に置かないと「画像が設定されていないカード」を表示するたびに後続処理が `null` を触って例外になる（`CreatorSceneEditPage.tsx` は画像の無いカードでも毎レンダー `loadCardImage` を呼ぶため、最頻の通常系で壊れる）
  2. `raw` に対し `JSON.parse` を試みる。成功して `version` と `dataUrl` を持つオブジェクトならその `dataUrl` を返す
  3. パースに失敗した場合、またはパースに成功しても期待した形（`version`・`dataUrl`）でない場合は `undefined` を返す
- `saveCardImage`：常に `JSON.stringify({ version: 1, dataUrl })` で書き込む
- 選定理由：カード画像はクリエイターが手動でアップロードした資産であり、他のMSWモックデータ（リロードで消える前提）とは異なり意図的に永続化している。値にバージョンを持たせることで、将来スキーマが変わってもマイグレーション関数を挟んで既存データを失わずに引き継げる余地を残す（キーにバージョンを埋め込む方式は実装は軽いが、バージョンアップのたびに黙って画像が読めなくなり、孤児化したキーがlocalStorage容量を圧迫する）
- **旧形式（バージョン無しの生data URL文字列）との互換は持たない。** まだ本リリース前でユーザーの既存データが存在しないため、旧形式のデータは「読めないデータ」として扱い `undefined` を返す（人間レビューでの判断、2026-09-23）。マイグレーション関数を挟める設計（バージョンを値に持たせる）自体は維持しつつ、今は互換コード・テストを持たないことでシンプルさを優先する

### 3.4 HIGH：`useEffect` でのdirty同期をレンダー中の直接計算に変更

対象：`apps/web/src/pages/creator/CreatorScenarioEditPage.tsx:50-52`、`apps/web/src/pages/creator/CreatorSceneEditPage.tsx:86-88`

- `const [dirty, setDirty] = useState(false); useEffect(() => setDirty(JSON.stringify(draft) !== JSON.stringify(sc)), [draft, sc]);` を `const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(sc), [draft, sc]);` に置き換える（`useState`・`useEffect` を削除。両ファイルで `useEffect` のimportが不要になるので除去し、代わりに `useMemo` をimportする）
- 単純な直接計算（`const dirty = JSON.stringify(draft) !== JSON.stringify(sc);`）ではなく `useMemo` を使う理由：`draft`/`sc` は `CardDef.portraitUrl` に最大200KB級のdata URLを含みうる大きなオブジェクトで、`JSON.stringify` による比較はコストが軽くない。直接計算だと、画像アップロード時のエラーメッセージ更新など `draft`/`sc` と無関係なローカルstateの変化でも毎レンダー実行されてしまう。`useMemo` で `[draft, sc]` に依存させることで、`useEffect` 除去によるstate同期アンチパターンの解消と、従来どおり必要な時だけ計算する性能特性の両方を保つ

### 3.5 HIGH：`GameCard` の不要なIIFEを除去

対象：`apps/web/src/components/GameCard.tsx:87-127`

- IIFE `(() => {...})()` をやめ、`nameEl` / `metaRow` / `portraitEl` の算出と `centerName` による出し分けをコンポーネント本体のトップレベルに展開する。挙動は変えない

## 4. テスト影響範囲

- `apps/web/src/test/pages.test.tsx`：対象5ルート（`admin/sitemap`・`admin/components`・`creator/scenarios`・`creator/scenarios/:id`・`creator/scenarios/:id/scenes/:id`）が、lazy化後も `findByRole`（自動待機）でそのまま描画確認できる見込み。テストコード自体の変更は不要
- `apps/web/src/test/cardImageStorage.test.ts`：既存4件は `saveCardImage` → `loadCardImage` のラウンドトリップのみを検証しており、内部形式が変わってもAPIの意味は変わらないためそのまま通る見込み。新形式の内部確認と、読めないデータの扱いを新規テストとして追加する（5.参照）
- `apps/web/src/test/CreatorSceneEditPage.test.tsx`：画像保存関連の既存テスト（150-284行）は `cardImageStorage` の内部形式変更の影響を受けない見込み（`loadCardImage` の戻り値の型・意味は変わらない）
- `apps/web/e2e/smoke.test.ts`：`page.waitForLoadState('networkidle')` を使っているため、lazy chunkの読み込み待ちも自然にカバーされる見込み。テストコード変更不要
- `docs/architecture/web-app.md` を編集するため、`pnpm docs:build` の確認対象になる

## 5. 新規テストケース

`apps/web/src/test/cardImageStorage.test.ts` に追加：

- 新形式（`{ version: 1, dataUrl }`）で保存した後、`window.localStorage.getItem` で取得した生の値がJSON文字列になっていること（内部形式の回帰防止）
- 壊れ方の代表2パターンで `undefined` が返ること（異常系。旧形式互換を持たないため、パースに失敗する・失敗しないは問わず「読めないデータ」を代表2件に統合して検証する。人間レビューでの判断、2026-09-23）
  - JSON構文として壊れているデータ（旧形式の生data URL文字列を代表例として使う）
  - JSON構文としては正しいが期待した形でないデータ（`JSON.parse` が例外を投げず `null` を返す `"null"` を代表例として使う。`raw===null`（キー未保存）とは別の経路であることを明示的に検証する回帰防止テスト）

`dirty` 同期の変更（3.4）・IIFE除去（3.5）・ルート分割（3.1）・QueryClient方針明文化（3.2）は、既存の振る舞いを変えない純粋なリファクタリングのため新規テストは追加しない。既存テスト（`pages.test.tsx` の保存ボタンdisabled確認を含む一連、`CreatorSceneEditPage.test.tsx`）を回帰の安全網とする。

## 6. 実装順

1. `cardImageStorage.ts` をバージョニング対応に変更（3.3）。既存テストがRedにならないことを確認してから、新規テスト（5.）をTDDで追加する
2. `CreatorScenarioEditPage.tsx`・`CreatorSceneEditPage.tsx` の `dirty` を `useEffect` 無しに変更する（3.4）
3. `GameCard.tsx` のIIFEを除去する（3.5）
4. `router.tsx` で対象5ページをlazy化し、Suspense境界を追加する（3.1）
5. `main.tsx` のQueryClient設定はそのままに、`docs/architecture/web-app.md` へキャッシュ方針を追記する（3.2）
6. `pnpm web:typecheck && pnpm web:test && pnpm docs:build` を通す
7. 実装のAI相互レビュー（design-reviewer / edge-case-reviewer / spec-reviewer）→ 人間レビュー → push

全タスク（1〜5）は既存パターンの適用・局所的な書き換えで完結する定型作業であり、設計判断を伴わないため、軽いモデルに割り当ててよい。サブエージェントへの分担はしない（ファイル間に読み書きの依存はないが、変更対象が6ファイルと少なく、1セッションで順に進める方が「実装順」の前提通りに各ステップ後の型検査を都度確認しやすい）。7のAI相互レビューは `docs/process/rules/review.md` の定義どおり3体のサブエージェントを並列実行する。

## 7. コミット前テスト実行

```sh
pnpm web:typecheck && pnpm web:test && pnpm docs:build
```

このコマンドは `.githooks/pre-push` が常に実行する3点セットで、対象ファイルによらず固定。今回は `docs/architecture/web-app.md` も編集するため、`docs:build` の結果（リンク切れ等）を実装中にも確認しておく。

## 8. スコープ外

今回のレビューで見つかったが、今回は対応しないもの：

- **1.5 Promise.all()**：`HomePage.tsx`・`SessionBrowsePage.tsx` 等は既にTanStack Queryが並列fetchしており対応不要（確認のみ、既知の課題ではない）
- **2.1 barrel export**：`components/index.ts` は既に存在せず解消済み（AGENTS.mdの既知課題と重複、確認のみ）
- **MEDIUM**：`TutorialPage.tsx` のstep遷移が二重レンダーになる設計、`useAutoFitCardName.ts` のフォントサイズ計測が未メモ化（`CardGrid` で多数枚表示する画面でのボトルネック候補）
- **LOW**：`format.ts` の `new Date()` 生成、`mocks/handlers.ts` のdeep clone、`SessionBrowsePage.tsx` の `fitOf`/`hasTag` のO(n×m)、`CreatorSceneEditPage.tsx`/`GmSessionManagePage.tsx` のコンポーネント内クロージャ再定義、`RulebookSectionPage.tsx` のkey生成
- **確認したが問題なしと判定**：`cardKindIcons.tsx` のモジュールスコープ定数、`japanese.ts` の正規表現、`lib/queries.ts` のTanStack Query利用（生fetch/useEffectでのデータ取得は無し）、`GameCard.tsx`/`PlayMat.tsx`/`play.tsx` の不要なグローバルイベントリスナー登録なし
- MEDIUM以降で今後対応が必要になったものは、別サイクルとして改めてプランを立てる
- 旧形式（バージョン無しの生data URL文字列）からの自動マイグレーション読み込みは持たない（3.3参照）。まだ本リリース前でユーザーの既存データが無いための判断であり、本リリース後に同種の変更をする場合はマイグレーション方針を別途検討する
- 3.1のReact.lazy化により、対象5ページはチャンク取得失敗（オフライン、デプロイ後のチャンクハッシュ不一致等）という新しい失敗モードを持つ。本アプリにはError Boundary／`errorElement`がルート全体に1件も無く、`Suspense`はこの失敗をキャッチしないため、発生すると画面が白crashする。ただしError Boundary未整備は本プラン以前からの既存ギャップ（対象5ページに限らない）であり、対象は低頻度アクセスのページに限っているため、今回はこのプランの中で対応しない。`errorElement`をルート単位で整備するかどうかは、別サイクルで判断する
