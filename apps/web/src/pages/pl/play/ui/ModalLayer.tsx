import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react';
import s from './ModalLayer.module.css';

/** 卓の上に札を広げるダイアログ（栞・場のゾーン）。
 * `<dialog>.showModal()` は使わず（jsdom に無い）、`role="dialog" aria-modal` の要素を自分で開け閉めする。
 * 開いたら最初のリンク・ボタンへフォーカスを移して Tab を中に閉じ込め、Escape・外側のクリックで onClose を呼ぶ。
 * フォーカスを開いたボタンへ戻すのは、閉じる側（onClose を渡す側）の仕事。閉じているときは描かない */
export function ModalLayer({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // 開いたら中の最初の札へフォーカスを移す（DOM の同期。状態の同期ではない）
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('a, button')?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>('a, button') ?? [])];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 外側の覆いのクリックで閉じる。キーボードは Escape と中の「卓に戻る」で閉じられる
    <div
      className={s.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={onKeyDown}
      data-testid="modal-overlay"
    >
      <div
        ref={dialogRef}
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
