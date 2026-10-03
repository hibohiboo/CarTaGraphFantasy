// カード画像の localStorage 読み書き。バックエンドが無いので、カードの portraitUrl とは
// 別に localStorage へ data URL を残し、リロード後も画像だけは復元できるようにする
// （docs/plans/2026-09-16-scene-builder.md の決定事項7）。
// 副作用（localStorage アクセス）をこの薄い層に閉じ込め、呼び出し側はテストしやすくする
// （docs/process/rules/architecture.md の Functional Core / Imperative Shell）。
//
// 保存形式は { version, dataUrl } のJSON（docs/plans/2026-09-22-react-best-practices適用.md 3.3）。
// まだ本リリース前でユーザーの既存データが無いため、旧形式（バージョン無しの生data URL
// 文字列）との互換は持たない。version・dataUrl の形が合わないデータは「読めないデータ」
// として undefined を返す。

const CURRENT_VERSION = 1;

type StoredImage = { version: typeof CURRENT_VERSION; dataUrl: string };

const keyOf = (cardId: string) => `cartagraph:cardImage:${cardId}`;

// `window.localStorage` を明示する。bare な `localStorage` は Node 24 の実験的グローバル
// （--localstorage-file 未指定だと使えない）と衝突することがあり、jsdom 環境でも
// window 経由の方が安定する。

export function saveCardImage(cardId: string, dataUrl: string): void {
  const stored: StoredImage = { version: CURRENT_VERSION, dataUrl };
  window.localStorage.setItem(keyOf(cardId), JSON.stringify(stored));
}

export function loadCardImage(cardId: string): string | undefined {
  const raw = window.localStorage.getItem(keyOf(cardId));
  // JSON.parse(null) は例外を投げず値 null を返すため、パース前にここで弾く。
  // 画像が未設定のカードでも毎レンダー呼ばれる最頻の通常系。
  if (raw === null) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredImage> | null;
    if (parsed && parsed.version === CURRENT_VERSION && typeof parsed.dataUrl === 'string') {
      return parsed.dataUrl;
    }
  } catch {
    // JSON構文として壊れている（旧形式の生data URL文字列を含む）
  }
  // JSONとして読めなかった、または読めても期待した形（version・dataUrl）ではない。
  return undefined;
}

export function removeCardImage(cardId: string): void {
  window.localStorage.removeItem(keyOf(cardId));
}
