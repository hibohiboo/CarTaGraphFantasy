import type { CardDef } from '@cartagraph/domain/card/model';
import type { Proposal } from '@cartagraph/domain/session/model';
import { isAtEnding } from '@cartagraph/domain/session/narrate';
import { findDeckNode } from '@cartagraph/domain/session/transition';
import { heldCards, isSoloRuleCard, unplayableReason } from '@cartagraph/domain/soloVillage/rules';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { GameCard } from '@/entities/card/ui/GameCard';
import { useCharacter } from '@/entities/character/api/queries';
import { useScenarioVersion } from '@/entities/scenario/api/queries';
import { usePlayCard, usePropose, useResume } from '@/entities/session/api/mutations';
import { useSession } from '@/entities/session/api/queries';
import { useMe } from '@/entities/user/api/queries';
import { Button, ErrorNote, Loading, StatusPill } from '@/shared/ui/ui';
import { HandDock, ProposeForm, SpeechCard, StatusLine } from '@/widgets/play-screen/ui/play';
import { AutoCombatLog, AutoCombatPanel, type PriorityRow, RetryCard } from './AutoCombatPanel';
import { Bookmark } from './Bookmark';
import { FieldZone } from './FieldZone';
import { PartyCard } from './PartyCard';
import { Placard } from './Placard';
import { TableLayout } from './TableLayout';

const PROPOSE_CARD: CardDef = {
  id: 'propose',
  kind: 'choice',
  name: '＋\n新たな選択肢を提案',
  tags: [],
};

/** 提案の状態（裁定待ち・却下・採用）の行 */
function ProposalStatus({
  proposals,
  ended,
  suspended,
}: {
  proposals: Proposal[];
  ended: boolean;
  suspended: boolean;
}) {
  const pending = proposals.find((p) => p.status === 'pending');
  const latest = proposals[0];
  if (pending) {
    // 終わったセッションでは、裁定待ちの提案を出さない
    if (ended) return null;
    return (
      <>
        <span>「新たな選択肢を提案」で送信済み：{pending.text}</span>
        <StatusPill status="pending">GM裁定待ち</StatusPill>
        {!suspended && (
          <span className="u-dim u-small">裁定を待たず、他の選択肢を先に選ぶこともできる。</span>
        )}
      </>
    );
  }
  if (latest?.status === 'rejected') {
    return (
      <>
        <span>提案「{latest.text}」</span>
        <StatusPill status="rejected">却下</StatusPill>
        <span className="u-dim u-small">{latest.resolution}</span>
      </>
    );
  }
  if (latest?.status === 'approved') {
    return (
      <>
        <span>提案「{latest.text}」</span>
        <StatusPill status="approved">採用・手札に「{latest.resolution}」が加わった</StatusPill>
      </>
    );
  }
  return null;
}

/** 終わったセッションで出す案内（終了・中断中・裁定待ち・裁定が済んだ）。それ以外は案内を出さない（手札の縁の光が案内になる） */
function hintFor(ended: boolean, suspended: boolean, pending: boolean): string | undefined {
  if (ended) return 'このセッションは終了しています。';
  if (!suspended) return undefined;
  return pending ? 'GM の裁定を待っています（中断中）' : '裁定が済んだ。続きを遊ぼう。';
}

/** ドライバー視点のプレイ画面。ヘッダもリンクも無い「カードを広げた卓」（場面の札・語りの札・場のゾーン・パーティの札・扇形の手札）。
 * 画面から抜ける操作は右上の栞にまとめる */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: 既存の違反。分けるまで個別に抑える（docs/architecture/known-issues.md「複雑度・行数の上限を超える既存のコード」）
export function PlayPage() {
  const { sessionId = '' } = useParams();
  const session = useSession(sessionId);
  const play = usePlayCard();
  const propose = usePropose();
  const resume = useResume();
  const [proposing, setProposing] = useState(false);
  const [text, setText] = useState('');
  // 自動戦闘の優先順位。パネルを閉じても残す。負けた後の「もう一度挑む」で開いたときの判定は retry（戦闘のノードと挑戦の回数）
  const [priority, setPriority] = useState<PriorityRow[]>([]);
  const [retry, setRetry] = useState<{ nodeId: string; attempts: number } | null>(null);
  // GM不在のセッションでは、使える条件（docs/cartagraph/solo-village.md、仮ルール）の判定にドライバーのキャラクターを使う
  const gmless = session.data?.gmless === true;
  const driverCharacterId =
    session.data?.participants.find((p) => p.role === 'driver')?.characterId ?? '';
  const character = useCharacter(gmless ? driverCharacterId : '');
  const me = useMe();
  // 終わったセッションでは、結末に着いて終わったかの判定と、GM不在のセッションの結末タグの即時反映（仮ルール）を示すため、
  // シナリオを読む
  const endedAny = session.data?.status === 'ended';
  const endedGmless = gmless && endedAny;
  const scenario = useScenarioVersion(
    endedAny ? (session.data?.scenarioId ?? '') : '',
    session.data?.scenarioVersion ?? 1,
  );

  if (session.isPending) return <Loading what="卓を準備中" />;
  // ヘッダ・フッタが無いので、読めないときも出る手段を残す
  if (session.error)
    return (
      <>
        <ErrorNote error={session.error} />
        <Link to="/home">ホームへ戻る</Link>
      </>
    );
  const s = session.data;
  const driver = s.participants.find((p) => p.role === 'driver');
  const pending = s.proposals.some((p) => p.status === 'pending');
  const ended = s.status === 'ended';
  // 中断中（GM 不在の募集のセッションで、提案の裁定を待つ）は、再開するまでプレイも提案もできない
  // （docs/cartagraph/party-and-session.md「中断」）
  const suspended = s.status === 'suspended';
  const busy = play.isPending || propose.isPending || resume.isPending;
  // 自動戦闘の設定中は、手札と提案の代わりに戦い方のパネルか「もう一度挑む」を出す（docs/cartagraph/auto-combat.md）
  const choosingTactics = !ended && s.autoCombat?.status === 'awaiting-priority';
  const hasResult = s.autoCombat?.lastResult !== undefined;
  // 初めて試験に入ったときはすぐパネルを出す。負けた後は、「もう一度挑む」を選んだときだけ開く
  const panelOpen =
    choosingTactics &&
    (!hasResult ||
      (retry?.nodeId === s.autoCombat?.nodeId && retry?.attempts === s.autoCombat?.attempts));
  const showRetry = choosingTactics && !panelOpen;
  // キャラクターを読み込むまでは判定せず、サーバーの 422 に任せる
  const held = character.data && heldCards(character.data, s.field);
  const reasonFor = held ? (card: CardDef) => unplayableReason(card, held) : undefined;
  // 選べる札があって待っているときだけ、手札の縁を光らせる
  const awaiting =
    !ended &&
    !suspended &&
    !busy &&
    !choosingTactics &&
    s.hand.some((c) => c.kind !== 'choice' || (reasonFor?.(c) ?? null) === null);
  // 仮ルールに関わるカードが手札にあれば「仮」と出す（architecture.md「境界」）
  const usesSoloRules = gmless && s.hand.some(isSoloRuleCard);
  // 結末タグのカードは、このセッションが至った結末で得たもの（前の周回で別の結末のカードを持っていても数えない）
  const reachedEndingId = findDeckNode(scenario.data?.deck ?? [], s.currentScene.nodeId ?? '')?.node
    .endingId;
  const gotEndingTag = character.data?.deck.some(
    (c) => c.ending?.scenarioId === s.scenarioId && c.ending.endingId === reachedEndingId,
  );
  const enemyName =
    s.field.plVisible.find((c) => c.id === s.autoCombat?.enemyCardId)?.name ?? '相手';
  // GM が結末以外のシーンで終了を宣言することもあるので、結末のノードにいるときだけ「結末」にする
  const atEnding = ended && scenario.data && isAtEnding(scenario.data.deck, s.currentScene.nodeId);
  // パーティは PC の集まり。GM の行と、PC を持たないナビゲーターは札にしない（party-and-session.md）
  const partyMembers = s.participants.filter((p) => p.role !== 'gm' && p.characterId);

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

  const story = (
    <>
      {/* 卓上の描写（Session.flavor）はGMが用意した流れなので、すべてのセッションで「GM」の語りの札として出す */}
      <SpeechCard
        speaker={atEnding ? '結末' : 'GM'}
        flavor={s.flavor}
        hint={hintFor(ended, suspended, pending)}
        heading={atEnding ? <h2 className="u-serif">結末「{s.currentScene.name}」</h2> : undefined}
      />
      {s.autoCombat && (
        <AutoCombatLog
          state={s.autoCombat}
          plName={driver?.characterName ?? 'PL'}
          enemyName={enemyName}
        />
      )}
      <StatusLine>
        {endedGmless && gotEndingTag && (
          <span className="u-dim u-small">結末タグの即時反映は仮ルール（GM不在）</span>
        )}
        {usesSoloRules && !ended && (
          <span className="u-dim u-small">仮ルール（GM不在）：成長・お店・選べない条件・描写</span>
        )}
        {play.error && <ErrorNote error={play.error} />}
        {propose.error && <ErrorNote error={propose.error} />}
        <ProposalStatus proposals={s.proposals} ended={ended} suspended={suspended} />
        {suspended && !pending && (
          <Button size="sm" onClick={() => resume.mutate({ sessionId })} disabled={busy}>
            続きを遊ぶ
          </Button>
        )}
        {resume.error && <ErrorNote error={resume.error} />}
      </StatusLine>
      {proposing && !ended && !suspended && !choosingTactics && (
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
    </>
  );

  const hand = panelOpen ? (
    <AutoCombatPanel
      session={s}
      priority={priority}
      onPriorityChange={setPriority}
      showNote={!hasResult}
    />
  ) : showRetry ? (
    <RetryCard
      onRetry={() =>
        setRetry({ nodeId: s.autoCombat?.nodeId ?? '', attempts: s.autoCombat?.attempts ?? 0 })
      }
    />
  ) : (
    <HandDock
      layout="fan"
      awaiting={awaiting}
      hand={s.hand}
      disabled={busy || ended || suspended}
      unplayableReason={reasonFor}
      onPlay={(card) => play.mutate({ sessionId, cardId: card.id })}
      extra={
        !ended &&
        !suspended &&
        s.proposalHandling !== 'disabled' && (
          <GameCard
            card={PROPOSE_CARD}
            variant="propose"
            width={110}
            centerName
            selected={proposing}
            onClick={() => setProposing((v) => !v)}
            disabled={pending || busy}
            title={pending ? '裁定待ちの提案があります' : undefined}
          />
        )
      }
    />
  );

  return (
    <TableLayout
      placard={<Placard session={s} />}
      bookmark={
        <Bookmark
          sessionId={s.id}
          characterId={driver?.characterId}
          isGm={me.data?.id === s.gmId}
        />
      }
      field={<FieldZone cards={s.field.plVisible} />}
      story={story}
      hand={hand}
      party={
        <ul aria-label="パーティ">
          {partyMembers.map((p) => (
            <PartyCard key={`${p.userId}-${p.role}-${p.characterId}`} participant={p} />
          ))}
        </ul>
      }
    />
  );
}
