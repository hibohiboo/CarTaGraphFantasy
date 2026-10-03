import { useLayoutEffect, useRef, useState } from 'react';

const STEP_PX = 0.5;
// Canvas計測とDOM描画のサブピクセル丸め差を吸収する小さな余裕
const SAFETY_MARGIN_PX = 1;

// Canvas 2Dのテキスト計測は同一フォント設定なら使い回せるため、モジュール直下に1つだけ用意する
let measureCtx: CanvasRenderingContext2D | null | undefined;

function measureTextWidth(text: string, font: string): number {
  if (measureCtx === undefined) {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  if (!measureCtx) return 0;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/**
 * カード名が1行に収まるよう、はみ出す場合だけフォントサイズを段階的に縮小する。
 * tabifudaプロジェクト（packages/ui/src/components/useAutoFitTitle.ts）の実装を移植した
 * （2026-09-22、ユーザー指定：「Tabifudaと同じく、カードの名前は一行になるように」）。
 * 呼び出し側で `ref` をタイトル要素に付け、収まらない長さの名前はCSS側の
 * text-overflow: ellipsis（GameCard.module.css の [data-compact="true"] .name）で省略する。
 */
export function useAutoFitCardName(text: string, baseSizePx: number, minSizePx: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fontSize, setFontSize] = useState(baseSizePx);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const availableWidth = el.clientWidth;
    const fontFamily = getComputedStyle(el).fontFamily;

    let size = baseSizePx;
    while (
      measureTextWidth(text, `${size}px ${fontFamily}`) > availableWidth - SAFETY_MARGIN_PX &&
      size > minSizePx
    ) {
      size -= STEP_PX;
    }
    setFontSize(size);
  }, [text, baseSizePx, minSizePx]);

  return { ref, fontSize };
}
