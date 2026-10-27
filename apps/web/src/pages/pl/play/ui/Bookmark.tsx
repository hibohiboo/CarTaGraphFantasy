import { useRef, useState } from 'react';
import { Link } from 'react-router';
import s from './Bookmark.module.css';
import { ModalLayer } from './ModalLayer';

/** 栞。画面から抜ける操作をまとめる、右上の縦長の札。開くと札を並べたダイアログを出す。
 * Escape・外側のクリック・「卓に戻る」で閉じて、栞のボタンへフォーカスを戻す（ダイアログの作りは ModalLayer）。
 * どの札もセッションの状態を変えない（「中断」は仕様では状態の名前なので使わない） */
export function Bookmark({
  sessionId,
  characterId,
  isGm,
}: {
  sessionId: string;
  /** ドライバーの PC。無いときは「キャラクターシートを見る」を出さない */
  characterId?: string;
  /** 見ている人が GM 本人のときだけ「GMの画面へ」を出す */
  isGm: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={s.tab}
        aria-label="栞を開く"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">栞</span>
      </button>
      {open && (
        <ModalLayer label="栞" onClose={close}>
          {characterId && (
            <Link className={s.item} to={`/pl/characters/${characterId}`}>
              キャラクターシートを見る
            </Link>
          )}
          <Link className={s.item} to="/home">
            ホームへ戻る
          </Link>
          {isGm && (
            <Link className={s.item} to={`/gm/sessions/${sessionId}`}>
              GMの画面へ
            </Link>
          )}
          <button type="button" className={s.item} onClick={close}>
            卓に戻る
          </button>
        </ModalLayer>
      )}
    </>
  );
}
