import type { CardDef } from '@cartagraph/domain/card/model';
import { useRef, useState } from 'react';
import s from './FieldZone.module.css';
import { ModalLayer } from './ModalLayer';

/** 場のゾーン（プレイマット）。確認したいときに開く（卓には「場」の札のボタンだけを置く）。
 * PL可視ゾーンの札だけを受け取って並べる（GM専用ゾーンは渡さない。card-face-back.md「場のゾーン構造」）。
 * 表の札は名前と状態タグ、裏の札は札の裏だけを出す（名前・説明を DOM に出さない。GameCard は伏せ札の名前を出すので使わない）。
 * 閉じているときは札を DOM に出さない */
export function FieldZone({ cards }: { cards: CardDef[] }) {
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
        aria-label="場を見る"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">場</span>
        <span className={s.count} aria-hidden="true">
          {cards.length}
        </span>
      </button>
      {open && (
        <ModalLayer label="場のゾーン" onClose={close}>
          <section className={s.zone} aria-label="場の札">
            <span className={s.mark} aria-hidden="true">
              場
            </span>
            {cards.length === 0 && <p className={s.empty}>場に札はありません。</p>}
            <ul className={s.list}>
              {cards.map((c) =>
                c.faceDown ? (
                  <li key={c.id} className={s.back} data-face="down">
                    <span className={s.backMark} aria-hidden="true">
                      ？
                    </span>
                    <span className={s.srOnly}>伏せられた札</span>
                  </li>
                ) : (
                  <li key={c.id} className={s.card} data-face="up">
                    <span className={s.name}>{c.name}</span>
                    {c.tags.length > 0 && (
                      <span className={s.tags}>
                        {c.tags.map((t) => (
                          <span key={t} className={s.tag}>
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                  </li>
                ),
              )}
            </ul>
          </section>
          <button type="button" className={s.close} onClick={close}>
            卓に戻る
          </button>
        </ModalLayer>
      )}
    </>
  );
}
