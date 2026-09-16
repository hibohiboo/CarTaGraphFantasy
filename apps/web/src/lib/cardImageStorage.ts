// カード画像の localStorage 読み書き。バックエンドが無いので、カードの portraitUrl とは
// 別に localStorage へ data URL を残し、リロード後も画像だけは復元できるようにする
// （docs/plans/2026-09-16-scene-builder.md の決定事項7）。
// 副作用（localStorage アクセス）をこの薄い層に閉じ込め、呼び出し側はテストしやすくする
// （docs/process/rules/architecture.md の Functional Core / Imperative Shell）。

const keyOf = (cardId: string) => `cartagraph:cardImage:${cardId}`;

// `window.localStorage` を明示する。bare な `localStorage` は Node 24 の実験的グローバル
// （--localstorage-file 未指定だと使えない）と衝突することがあり、jsdom 環境でも
// window 経由の方が安定する。

export function saveCardImage(cardId: string, dataUrl: string): void {
  window.localStorage.setItem(keyOf(cardId), dataUrl);
}

export function loadCardImage(cardId: string): string | undefined {
  return window.localStorage.getItem(keyOf(cardId)) ?? undefined;
}

export function removeCardImage(cardId: string): void {
  window.localStorage.removeItem(keyOf(cardId));
}
