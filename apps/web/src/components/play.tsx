import type { CardDef, Session } from '@cartagraph/domain';
import type { ReactNode } from 'react';
import { CARD_KIND_ICONS } from './cardKindIcons';
import { GameCard } from './GameCard';
import s from './play.module.css';
import { Avatar, RoleBadge } from './ui';

/** 1画面完結レイアウトの外枠（HUD＋卓＋手札） */
export function PlayScreen({ children }: { children: ReactNode }) {
  return <div className={s.screen}>{children}</div>;
}

export function Hud({
  session,
  viewer,
  links,
}: {
  session: Session;
  viewer: 'driver' | 'gm';
  links?: ReactNode;
}) {
  const driver = session.participants.find((p) => p.role === 'driver');
  const others = session.participants.filter((p) => p.role !== 'driver' && p.role !== 'gm');
  return (
    <header className={s.hud}>
      <h1 className={s.hudTitle}>{session.scenarioTitle}</h1>
      <span className={s.hudScene}>{session.currentScene.path}</span>
      {viewer === 'driver' ? (
        <RoleBadge badgeRole="driver">
          {driver?.characterName ?? driver?.name}（ドライバー）
        </RoleBadge>
      ) : (
        <RoleBadge badgeRole="gm">{session.gmName}（GM）</RoleBadge>
      )}
      <RoleBadge badgeRole="mode">
        {session.mode === 'dense' ? '濃密モード' : '軽量モード'}
      </RoleBadge>
      <div className={s.hudParty}>
        {others.map((p) => (
          <Avatar key={p.userId} name={p.characterName ?? p.name} avatarRole={p.role} />
        ))}
        {links}
      </div>
    </header>
  );
}

/** 台詞・地の文を出す「台詞カード」。GameCard（5:7）を横向きにした比率（7:5）。
 * 発言者名はGameCardと同じくカード左上を維持し、その下に肖像（あれば）＋台詞欄を横並びで置く。
 * speakerCard（NPCの台詞など）は肖像つきの発言者、speaker（GMの情景描写など）は
 * 肖像なしでラベルだけ出す。onClickを渡すとカード全体がボタンになり、右下に次へ進む合図を出す
 * （2026-09-22ユーザー指定：台詞は1枚ずつ出し、クリックで次のカードへ進める） */
export function Table({
  speaker,
  speakerCard,
  flavor,
  hint,
  mystery,
  onClick,
}: {
  speaker?: string;
  speakerCard?: Pick<CardDef, 'name' | 'kind'> & Partial<CardDef>;
  flavor: string;
  hint?: string;
  mystery?: CardDef[];
  /** 次の台詞があるときだけ渡す。カード全体がクリック可能になる */
  onClick?: () => void;
}) {
  const label = speakerCard?.name ?? speaker;
  const body = (
    <>
      {label && <div className={s.speaker}>{label}</div>}
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
  return (
    <main className={s.table}>
      {onClick ? (
        <button type="button" className={s.speechCard} onClick={onClick}>
          {body}
        </button>
      ) : (
        <div className={s.speechCard}>{body}</div>
      )}
      {mystery && mystery.length > 0 && (
        <div className={s.mystery}>
          {mystery.map((c) => (
            <GameCard key={c.id} card={c} width={56} />
          ))}
        </div>
      )}
    </main>
  );
}

export function StatusLine({ children }: { children: ReactNode }) {
  return <p className={s.statusLine}>{children}</p>;
}

export function ProposeForm({ children }: { children: ReactNode }) {
  return <div className={s.proposeForm}>{children}</div>;
}

/** 横スクロールの手札列。選択肢とそれ以外を区切り線で分ける */
export function HandDock({
  hand,
  onPlay,
  selectedId,
  disabled,
  extra,
}: {
  hand: CardDef[];
  onPlay: (card: CardDef) => void;
  selectedId?: string;
  disabled?: boolean;
  /** 選択肢の末尾に置く追加カード（「新たな選択肢を提案」など） */
  extra?: ReactNode;
}) {
  const choices = hand.filter((c) => c.kind === 'choice');
  const rest = hand.filter((c) => c.kind !== 'choice');
  return (
    <div className={s.dock}>
      <div className={s.dockRow}>
        {choices.map((c) => (
          <GameCard
            key={c.id}
            card={c}
            width={110}
            centerName
            onClick={() => onPlay(c)}
            selected={c.id === selectedId}
            disabled={disabled}
            showCost="action"
          />
        ))}
        {extra}
        {rest.length > 0 && <div className={s.dockDivider} />}
        {rest.map((c) => (
          <GameCard
            key={c.id}
            card={c}
            width={110}
            centerName
            onClick={() => onPlay(c)}
            selected={c.id === selectedId}
            disabled={disabled}
            showCost="action"
          />
        ))}
      </div>
    </div>
  );
}
