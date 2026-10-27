import type { CardDef } from '@cartagraph/domain/card/model';
import type { CSSProperties, ReactNode } from 'react';
import { CARD_KIND_ICONS } from '@/entities/card/ui/cardKindIcons';
import { GameCard } from '@/entities/card/ui/GameCard';
import s from './play.module.css';

/** 台詞・地の文を出す「台詞カード」。GameCard（5:7）を横向きにした比率（7:5）。
 * 発言者名はGameCardと同じくカード左上を維持し、その下に肖像（あれば）＋台詞欄を横並びで置く。
 * speakerCard（NPCの台詞など）は肖像つきの発言者、speaker（GMの情景描写など）は
 * 肖像なしでラベルだけ出す。onClickを渡すとカード全体がボタンになり、右下に次へ進む合図を出す
 * （2026-09-22ユーザー指定：台詞は1枚ずつ出し、クリックで次のカードへ進める）。
 * `<main>` は使わない（AppShell の `<main>` と入れ子になるため。チュートリアルなどは Table が包む）。
 * ラベルがあるときは、ラベルを名前にした `section` として出す */
export function SpeechCard({
  speaker,
  speakerCard,
  flavor,
  hint,
  heading,
  onClick,
}: {
  speaker?: string;
  speakerCard?: Pick<CardDef, 'name' | 'kind'> & Partial<CardDef>;
  flavor: string;
  hint?: string;
  /** 札の中の見出し（結末など） */
  heading?: ReactNode;
  /** 次の台詞があるときだけ渡す。カード全体がクリック可能になる */
  onClick?: () => void;
}) {
  const label = speakerCard?.name ?? speaker;
  const body = (
    <>
      {label && <div className={s.speaker}>{label}</div>}
      {heading}
      <div className={s.speechRow}>
        {speakerCard && (
          <div
            className={s.speechPortrait}
            style={
              speakerCard.portraitUrl
                ? { backgroundImage: `url(${speakerCard.portraitUrl})` }
                : undefined
            }
            aria-hidden="true"
          >
            {!speakerCard.portraitUrl && CARD_KIND_ICONS[speakerCard.kind]}
          </div>
        )}
        <p className={s.flavor}>
          {flavor}
          {hint && <span className={s.flavorDim}>{hint}</span>}
        </p>
      </div>
      {onClick && <span className={s.speechNext}>次へ ▶</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={s.speechCard} onClick={onClick}>
        {body}
      </button>
    );
  }
  return (
    <section className={s.speechCard} aria-label={label}>
      {body}
    </section>
  );
}

/** チュートリアル・村スタートの卓。台詞カードを中央に1枚置く */
export function Table(props: Parameters<typeof SpeechCard>[0]) {
  return (
    <main className={s.table}>
      <SpeechCard {...props} />
    </main>
  );
}

export function StatusLine({ children }: { children: ReactNode }) {
  return <p className={s.statusLine}>{children}</p>;
}

export function ProposeForm({ children }: { children: ReactNode }) {
  return <div className={s.proposeForm}>{children}</div>;
}

/** 扇形の手札で、札ごとの傾きと沈み（hover で揃う）。n 枚のうち i 番目 */
function fanStyle(i: number, n: number): CSSProperties {
  const mid = (n - 1) / 2;
  const offset = i - mid;
  return {
    '--rot': `${offset * 3}deg`,
    '--drop': `${Math.abs(offset) ** 2 * 1.5}px`,
  } as CSSProperties;
}

/** 横スクロールの手札列。選択肢とそれ以外を区切り線で分ける。
 * layout='fan' は卓の手札（札を扇形に重ねる）。awaiting は「選べる札があって待っている」合図（縁の明滅） */
export function HandDock({
  hand,
  onPlay,
  selectedId,
  disabled,
  extra,
  unplayableReason,
  layout = 'row',
  awaiting,
}: {
  hand: CardDef[];
  onPlay: (card: CardDef) => void;
  selectedId?: string;
  disabled?: boolean;
  /** 選択肢の末尾に置く追加カード（「新たな選択肢を提案」など） */
  extra?: ReactNode;
  /** 選べない選択肢カードの理由（GM不在のソロの使える条件。docs/cartagraph/solo-village.md、仮ルール） */
  unplayableReason?: (card: CardDef) => string | null;
  layout?: 'row' | 'fan';
  awaiting?: boolean;
}) {
  const choices = hand.filter((c) => c.kind === 'choice');
  const rest = hand.filter((c) => c.kind !== 'choice');
  const fan = layout === 'fan';
  // 扇形では、札を1枚ずつ傾きの付く枠に入れる。区切り線は扇では出さない
  const total = choices.length + (extra ? 1 : 0) + rest.length;
  let slotIndex = 0;
  const slot = (key: string, node: ReactNode) => {
    if (!fan) return node;
    const style = fanStyle(slotIndex++, total);
    return (
      <div key={key} className={s.fanSlot} style={style}>
        {node}
      </div>
    );
  };
  return (
    <div className={s.dock} data-layout={layout} data-awaiting={awaiting ? 'true' : undefined}>
      <div className={s.dockRow}>
        {choices.map((c) => {
          const reason = unplayableReason?.(c) ?? null;
          return slot(
            c.id,
            <GameCard
              key={c.id}
              card={c}
              width={110}
              centerName
              onClick={() => onPlay(c)}
              selected={c.id === selectedId}
              disabled={disabled || reason !== null}
              title={reason ?? undefined}
              showCost="action"
            >
              {reason && <span className={s.unplayable}>{reason}</span>}
            </GameCard>,
          );
        })}
        {extra && slot('extra', extra)}
        {!fan && rest.length > 0 && <div className={s.dockDivider} />}
        {rest.map((c) =>
          slot(
            c.id,
            <GameCard
              key={c.id}
              card={c}
              width={110}
              centerName
              onClick={() => onPlay(c)}
              selected={c.id === selectedId}
              disabled={disabled}
              showCost="action"
            />,
          ),
        )}
      </div>
    </div>
  );
}
