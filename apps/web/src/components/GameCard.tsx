import { CARD_KIND_LABEL, type CardDef } from '@cartagraph/domain';
import type { CSSProperties, ReactNode } from 'react';
import { CARD_KIND_ICONS } from './cardKindIcons';
import s from './GameCard.module.css';
import { useAutoFitCardName } from './useAutoFitCardName';

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
  /** 種別ラベル・コストの行を隠す（名前＋アイコンだけの小さな表示にしたいとき） */
  hideMeta?: boolean;
  /** アイコンだけの親指サイズ表示にする（名前・種別ラベルも隠す）。タップで詳細を見せる導線向け */
  iconOnly?: boolean;
  width?: number;
  title?: string;
  children?: ReactNode;
}

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
  hideMeta,
  iconOnly,
  width,
  title,
  children,
}: GameCardProps) {
  const faceDown = card.faceDown === true;
  const style = width ? ({ '--card-width': `${width}px` } as CSSProperties) : undefined;
  // hideMeta（名前＋アイコンだけの小さな表示）のときだけ、名前が1行に収まるよう
  // フォントサイズを縮める（tabifudaのuseAutoFitTitleを移植。基準11.2px・最小7px）
  const autoFit = useAutoFitCardName(card.name, 11.2, 7);
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
  ) : iconOnly ? (
    <div
      className={s.portrait}
      style={card.portraitUrl ? { backgroundImage: `url(${card.portraitUrl})` } : undefined}
      aria-hidden="true"
    >
      {!card.portraitUrl && CARD_KIND_ICONS[card.kind]}
    </div>
  ) : (
    <>
      {!hideMeta && (
        <div className={s.kindRow}>
          <span className={s.kind}>{CARD_KIND_LABEL[card.kind]}</span>
          {cost && <span className={s.cost}>{cost}</span>}
        </div>
      )}
      {portrait && (
        <div
          className={s.portrait}
          style={card.portraitUrl ? { backgroundImage: `url(${card.portraitUrl})` } : undefined}
          aria-hidden="true"
        >
          {!card.portraitUrl && CARD_KIND_ICONS[card.kind]}
        </div>
      )}
      <div
        className={s.name}
        ref={hideMeta ? autoFit.ref : undefined}
        style={hideMeta ? { fontSize: `${autoFit.fontSize}px` } : undefined}
      >
        {card.name}
      </div>
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
    'data-compact': hideMeta ? 'true' : undefined,
    'data-icon-only': iconOnly ? 'true' : undefined,
    style,
    title: title ?? (faceDown ? '内容不明のカード' : undefined),
  } as const;

  if (onClick) {
    return (
      <button
        {...common}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={iconOnly ? (title ?? card.name) : undefined}
      >
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
