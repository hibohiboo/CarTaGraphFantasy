import type { CardDef } from '@cartagraph/domain/card/model';
import { SYSTEM_GM_ID } from '@cartagraph/domain/session/model';
import { heldCards, isSoloRuleCard, unplayableReason } from '@cartagraph/domain/soloVillage/rules';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { GameCard } from '../../components/GameCard';
import { HandDock, Hud, PlayScreen, ProposeForm, StatusLine, Table } from '../../components/play';
import { Button, ErrorNote, Loading, StatusPill } from '../../components/ui';
import { useCharacter, usePlayCard, usePropose, useScenario, useSession } from '../../lib/queries';
import { AutoCombatLog, AutoCombatPanel } from './AutoCombatPanel';

const PROPOSE_CARD: CardDef = {
  id: 'propose',
  kind: 'choice',
  name: '＋\n新たな選択肢を提案',
  tags: [],
};

/** ドライバー視点のプレイ画面。HUD＋卓＋手札の1画面完結レイアウト（session-play.html を移植） */
export function PlayPage() {
  const { sessionId = '' } = useParams();
  const session = useSession(sessionId);
  const play = usePlayCard();
  const propose = usePropose();
  const [proposing, setProposing] = useState(false);
  const [text, setText] = useState('');
  // GM不在のソロでは、使える条件（docs/cartagraph/solo-village.md、仮ルール）の判定にドライバーのキャラクターを使う
  const soloGm = session.data?.gmId === SYSTEM_GM_ID;
  const driverCharacterId =
    session.data?.participants.find((p) => p.role === 'driver')?.characterId ?? '';
  const character = useCharacter(soloGm ? driverCharacterId : '');
  // 結末タグの即時反映（仮ルール）を示すため、GM不在のソロが終わったらシナリオの結末を読む
  const endedSolo = soloGm && session.data?.status === 'ended';
  const scenario = useScenario(endedSolo ? (session.data?.scenarioId ?? '') : '');

  if (session.isPending) return <Loading what="卓を準備中" />;
  if (session.error) return <ErrorNote error={session.error} />;
  const s = session.data;
  const pending = s.proposals.find((p) => p.status === 'pending');
  const ended = s.status === 'ended';
  const busy = play.isPending || propose.isPending;
  // 自動戦闘の設定中は、手札と提案の代わりに戦い方のパネルを出す（docs/cartagraph/auto-combat.md）
  const choosingTactics = !ended && s.autoCombat?.status === 'awaiting-priority';
  // キャラクターを読み込むまでは判定せず、サーバーの 422 に任せる
  const held = character.data && heldCards(character.data, s.field);
  const reasonFor = held ? (card: CardDef) => unplayableReason(card, held) : undefined;
  // 仮ルールに関わるカードが手札にあれば「仮」と出す（architecture.md「境界」）
  const usesSoloRules = soloGm && s.hand.some(isSoloRuleCard);
  const gotEndingTag = scenario.data?.endings.some(
    (e) => e.grantsTag && character.data?.endingTags.includes(e.grantsTag),
  );
  const enemyName =
    s.field.plVisible.find((c) => c.id === s.autoCombat?.enemyCardId)?.name ?? '相手';

  const submitProposal = () => {
    if (!text.trim()) return;
    propose.mutate(
      { sessionId, text },
      {
        onSuccess: () => {
          setText('');
          setProposing(false);
        },
      },
    );
  };

  return (
    <PlayScreen>
      <Hud
        session={s}
        viewer="driver"
        links={
          <>
            <Link
              to={`/pl/characters/${s.participants.find((p) => p.role === 'driver')?.characterId ?? ''}`}
            >
              キャラクターシート
            </Link>
            <Link to="/pl/sessions">セッション一覧</Link>
          </>
        }
      />
      {/* 卓上の描写（Session.flavor）はGMが用意した流れなので、すべてのセッションで「GM」の台詞カードとして出す */}
      <Table
        speaker="GM"
        flavor={s.flavor}
        hint={
          ended
            ? 'このセッションは終了しています。'
            : choosingTactics
              ? '戦い方（カードの優先順位）を決めて、戦闘を始めよう。'
              : busy
                ? '…'
                : '手札から1枚選んでプレイしよう。'
        }
        mystery={s.field.plVisible.filter((c) => c.faceDown)}
      />
      {ended && s.currentScene.nodeId && <h2 className="u-serif">結末「{s.currentScene.name}」</h2>}
      {s.autoCombat && (
        <AutoCombatLog
          state={s.autoCombat}
          plName={s.participants.find((p) => p.role === 'driver')?.characterName ?? 'PL'}
          enemyName={enemyName}
        />
      )}
      <StatusLine>
        {endedSolo && gotEndingTag && (
          <span className="u-dim u-small">結末タグの即時反映は仮ルール（GM不在のソロ）</span>
        )}
        {usesSoloRules && !ended && (
          <span className="u-dim u-small">
            能力値の上がり方・お店・選べないカードの条件・シーンに入ったときの描写は仮ルール（GM不在のソロ）
          </span>
        )}
        {play.error && <ErrorNote error={play.error} />}
        {propose.error && <ErrorNote error={propose.error} />}
        {pending && (
          <>
            <span>「新たな選択肢を提案」で送信済み：{pending.text}</span>
            <StatusPill status="pending">GM裁定待ち</StatusPill>
            <span className="u-dim u-small">裁定を待たず、他の選択肢を先に選ぶこともできる。</span>
          </>
        )}
        {!pending && s.proposals[0]?.status === 'rejected' && (
          <>
            <span>提案「{s.proposals[0].text}」</span>
            <StatusPill status="rejected">却下</StatusPill>
            <span className="u-dim u-small">{s.proposals[0].resolution}</span>
          </>
        )}
        {!pending && s.proposals[0]?.status === 'approved' && (
          <>
            <span>提案「{s.proposals[0].text}」</span>
            <StatusPill status="approved">
              採用・手札に「{s.proposals[0].resolution}」が加わった
            </StatusPill>
          </>
        )}
      </StatusLine>
      {proposing && !ended && !choosingTactics && (
        <ProposeForm>
          <input
            type="text"
            aria-label="提案する行動"
            placeholder="例：扉を壊してみたい"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitProposal()}
            // biome-ignore lint/a11y/noAutofocus: プレイ中の提案入力欄。ページの主操作なので意図的にフォーカスする
            autoFocus
          />
          <Button size="sm" onClick={submitProposal} disabled={busy || !text.trim()}>
            提案を送る
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setProposing(false)}>
            やめる
          </Button>
        </ProposeForm>
      )}
      {choosingTactics ? (
        <AutoCombatPanel session={s} />
      ) : (
        <HandDock
          hand={s.hand}
          disabled={busy || ended}
          unplayableReason={reasonFor}
          onPlay={(card) => play.mutate({ sessionId, cardId: card.id })}
          extra={
            !ended &&
            s.proposalHandling !== 'disabled' && (
              <GameCard
                card={PROPOSE_CARD}
                variant="propose"
                width={110}
                centerName
                selected={proposing}
                onClick={() => setProposing((v) => !v)}
                disabled={!!pending || busy}
                title={pending ? '裁定待ちの提案があります' : undefined}
              />
            )
          }
        />
      )}
    </PlayScreen>
  );
}
