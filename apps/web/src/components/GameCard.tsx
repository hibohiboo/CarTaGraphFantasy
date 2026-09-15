import { CARD_KIND_LABEL, type CardDef } from '@cartagraph/domain';
import type { CSSProperties, ReactNode } from 'react';
import s from './GameCard.module.css';

export type GameCardVariant = 'default' | 'propose';

export interface GameCardProps {
  card: Pick<CardDef, 'name' | 'kind'> & Partial<CardDef>;
  /** クリック可能にする（手札など） */
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  variant?: GameCardVariant;
  /** 人物シルエットの絵柄エリアを出す（キャラクター・NPC・プール等） */
  portrait?: boolean;
  /** 説明文を出す */
  showDescription?: boolean;
  /** タグを出す */
  showTags?: boolean;
  /** CPコスト／行動コストの表示 */
  showCost?: 'cp' | 'action';
  /** 名前を中央寄せ（手札の選択肢など） */
  centerName?: boolean;
  /** 朱印（決着）スタンプ */
  stamp?: string;
  /** ゾーンピルを表示 */
  showZone?: boolean;
  /** グリッド内などで幅を親に任せる */
  fluid?: boolean;
  width?: number;
  title?: string;
  children?: ReactNode;
}

const KIND_ICON_FALLBACK = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="9" r="4" />
    <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </svg>
);

export function GameCard({
  card,
  onClick,
  selected,
  disabled,
  variant = 'default',
  portrait,
  showDescription,
  showTags,
  showCost,
  centerName,
  stamp,
  showZone,
  fluid,
  width,
  title,
  children,
}: GameCardProps) {
  const faceDown = card.faceDown === true;
  const style = width ? ({ '--card-width': `${width}px` } as CSSProperties) : undefined;
  const cost =
    showCost === 'cp' && card.cpCost !== undefined
      ? `CP ${card.cpCost}`
      : showCost === 'action' && card.actionCost !== undefined
        ? `コスト ${card.actionCost}${card.range !== undefined ? ` / 射程 ${card.range}` : ''}`
        : null;

  const body = faceDown ? (
    <div className={s.name} role="img" aria-label={`伏せ札：${card.name}`}>
      ？
    </div>
  ) : (
    <>
      <div className={s.kindRow}>
        <span className={s.kind}>{CARD_KIND_LABEL[card.kind]}</span>
        {cost && <span className={s.cost}>{cost}</span>}
      </div>
      {portrait && (
        <div
          className={s.portrait}
          style={card.portraitUrl ? { backgroundImage: `url(${card.portraitUrl})` } : undefined}
          aria-hidden="true"
        >
          {!card.portraitUrl && KIND_ICON_FALLBACK}
        </div>
      )}
      <div className={s.name}>{card.name}</div>
      {showDescription && card.description && (
        <p className={s.desc} data-clamp={portrait ? 'true' : undefined}>
          {card.description}
        </p>
      )}
      {showTags && card.tags && card.tags.length > 0 && (
        <div className={s.tags}>
          {card.tags.map((t) => (
            <span key={t} className={s.tag}>
              {t}
            </span>
          ))}
        </div>
      )}
      {children}
      {stamp && <span className={s.stamp}>{stamp}</span>}
      {showZone && card.zone && (
        <span
          className={s.zone}
          data-zone={card.zone}
          style={{
            fontSize: '0.62rem',
            color: card.zone === 'gm' ? 'var(--seal)' : 'var(--ink-soft)',
          }}
        >
          {card.zone === 'gm' ? 'GM専用' : 'PL可視'}
        </span>
      )}
    </>
  );

  const common = {
    className: s.card,
    'data-face': faceDown ? 'down' : 'up',
    'data-variant': variant,
    'data-selected': selected ? 'true' : undefined,
    'data-layout': centerName || faceDown ? 'center' : undefined,
    'data-fluid': fluid ? 'true' : undefined,
    style,
    title: title ?? (faceDown ? '内容不明のカード' : undefined),
  } as const;

  if (onClick) {
    return (
      <button {...common} onClick={onClick} disabled={disabled} aria-pressed={selected}>
        {body}
      </button>
    );
  }
  return <article {...common}>{body}</article>;
}

/** カードを敷き詰めるグリッド（5:7 のまま自動折り返し） */
export function CardGrid({ children, min = 130 }: { children: ReactNode; min?: number }) {
  return (
    <div className={s.grid} style={{ '--card-min': `${min}px` } as CSSProperties}>
      {children}
    </div>
  );
}
