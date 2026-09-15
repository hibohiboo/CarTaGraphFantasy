import { useState } from 'react';
import { Link, useParams } from 'react-router';
import type { CardDef } from '@cartagraph/domain';
import { usePlayCard, usePropose, useSession } from '../../lib/queries';
import { Button, ErrorNote, GameCard, HandDock, Hud, Loading, PlayScreen, ProposeForm, StatusLine, StatusPill, Table } from '../../components';

const PROPOSE_CARD: CardDef = { id: 'propose', kind: 'choice', name: '＋\n新たな選択肢を提案', tags: [] };

/** ドライバー視点のプレイ画面。HUD＋卓＋手札の1画面完結レイアウト（session-play.html を移植） */
export function PlayPage() {
  const { sessionId = '' } = useParams();
  const session = useSession(sessionId);
  const play = usePlayCard();
  const propose = usePropose();
  const [proposing, setProposing] = useState(false);
  const [text, setText] = useState('');

  if (session.isPending) return <Loading what="卓を準備中" />;
  if (session.error) return <ErrorNote error={session.error} />;
  const s = session.data;
  const pending = s.proposals.find((p) => p.status === 'pending');
  const ended = s.status === 'ended';
  const busy = play.isPending || propose.isPending;

  const submitProposal = () => {
    if (!text.trim()) return;
    propose.mutate({ sessionId, text }, { onSuccess: () => { setText(''); setProposing(false); } });
  };

  return (
    <PlayScreen>
      <Hud
        session={s}
        viewer="driver"
        links={
          <>
            <Link to={`/pl/characters/${s.participants.find((p) => p.role === 'driver')?.characterId ?? ''}`}>キャラクターシート</Link>
            <Link to="/pl/sessions">セッション一覧</Link>
          </>
        }
      />
      <Table
        flavor={s.flavor}
        hint={ended ? 'このセッションは終了しています。' : busy ? '…' : '手札から1枚選んでプレイしよう。'}
        mystery={s.field.plVisible.filter((c) => c.faceDown)}
      />
      <StatusLine>
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
            <StatusPill status="approved">採用・手札に「{s.proposals[0].resolution}」が加わった</StatusPill>
          </>
        )}
      </StatusLine>
      {proposing && !ended && (
        <ProposeForm>
          <input
            type="text"
            aria-label="提案する行動"
            placeholder="例：扉を壊してみたい"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitProposal()}
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
      <HandDock
        hand={s.hand}
        disabled={busy || ended}
        onPlay={(card) => play.mutate({ sessionId, cardId: card.id })}
        extra={
          !ended && (
            <GameCard card={PROPOSE_CARD} variant="propose" width={110} centerName selected={proposing} onClick={() => setProposing((v) => !v)} disabled={!!pending || busy} title={pending ? '裁定待ちの提案があります' : undefined} />
          )
        }
      />
    </PlayScreen>
  );
}
