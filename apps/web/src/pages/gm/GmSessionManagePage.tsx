import {
  PARTICIPANT_ROLE_LABEL,
  PROPOSAL_STATUS_LABEL,
  type Proposal,
  type Session,
} from '@cartagraph/domain';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { GameCard } from '../../components/GameCard';
import {
  Avatar,
  Button,
  Chip,
  ChipGroup,
  ErrorNote,
  Loading,
  PageHeader,
  Panel,
  RoleBadge,
  StatGrid,
  StatTile,
  StatusPill,
} from '../../components/ui';
import { hhmm, relativeTime, untilLabel } from '../../lib/format';
import { toDictionaryForm } from '../../lib/japanese';
import {
  useApproveProposal,
  useEndSession,
  useRejectProposal,
  useSession,
  useSetMode,
} from '../../lib/queries';
import s from '../pages.module.css';

/** GMのセッション管理（session-gm-manage.html）＋提案の承認（session-gm-review.html）を1ページに統合 */
export function GmSessionManagePage() {
  const { sessionId = '' } = useParams();
  const session = useSession(sessionId);
  const setMode = useSetMode();
  const end = useEndSession();

  if (session.isPending) return <Loading />;
  if (session.error) return <ErrorNote error={session.error} />;
  const x = session.data;
  const stale = (iso: string) => Date.now() - new Date(iso).getTime() > 2 * 24 * 3600_000;
  const counts = {
    pending: x.proposals.filter((p) => p.status === 'pending').length,
    approved: x.proposals.filter((p) => p.status === 'approved' || p.status === 'approved-unused')
      .length,
    rejected: x.proposals.filter((p) => p.status === 'rejected').length,
  };

  return (
    <>
      <PageHeader
        title="セッション管理"
        crumb={
          <>
            「{x.scenarioTitle}」 ／ パーティー「{x.partyName}」 ／{' '}
            <Link to="/gm/sessions">一覧へ戻る</Link>
          </>
        }
        actions={<RoleBadge badgeRole="gm">{x.gmName}（GM）</RoleBadge>}
      />

      <StatGrid>
        <StatTile
          value={`${x.currentScene.name.split(' ')[0]} / ${x.currentScene.total}`}
          label="進行中のシーン"
        />
        <StatTile value={x.mode === 'dense' ? '濃密' : '軽量'} label="現在のモード" />
        <StatTile value={relativeTime(x.lastActivityAt)} label="最後の参加者反応" />
        {x.status === 'playing' ? (
          <StatTile
            value={untilLabel(x.suspendAt)}
            label="無反応で「中断」になるまで"
            tone="pending"
          />
        ) : (
          <StatTile value="終了" label="セッションの状態" tone="neutral" />
        )}
      </StatGrid>

      <div className={s.stack} style={{ marginTop: 22 }}>
        <Panel
          title="提案の裁定"
          sub="「新たな選択肢を提案」で届いた提案。採用するとカードを1枚生成して手札に加える。却下も理由とともに記録し、PLからも見える。"
        >
          <StatGrid>
            <StatTile value={counts.pending} label="承認待ち" tone="pending" />
            <StatTile value={counts.approved} label="採用済み" tone="approved" />
            <StatTile value={counts.rejected} label="却下" tone="rejected" />
          </StatGrid>
          <div className={[s.stack, 'u-mt'].join(' ')} style={{ paddingBottom: 0 }}>
            {x.proposals.map((p) => (
              <ProposalTicket key={p.id} p={p} session={x} />
            ))}
          </div>
        </Panel>

        <Panel
          title="参加者"
          sub="ドライバーが応答しなくなった場合、ナビゲーターやPCの所有者が引き継げる。"
        >
          <div className={s.list}>
            {x.participants.map((p) => (
              <div key={p.userId} className={s.listItem} data-plain="true">
                <div className={s.itemLeft}>
                  <Avatar name={p.characterName ?? p.name} avatarRole={p.role} />
                  <span>
                    {p.characterName ? `${p.characterName}（${p.name}）` : p.name}
                    <br />
                    <span className={s.itemSub}>{PARTICIPANT_ROLE_LABEL[p.role]}</span>
                  </span>
                </div>
                <span className={s.itemTime} data-warn={stale(p.lastSeenAt) ? 'true' : undefined}>
                  最終反応：{relativeTime(p.lastSeenAt)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="場のゾーン"
          sub="GMは両方のゾーンを見渡せる。PLはPL可視ゾーンのみ。伏せ札は存在だけが見えている。"
        >
          <div className="u-row" style={{ alignItems: 'flex-start', gap: 24 }}>
            <div>
              <div className={s.metaLabel}>GM専用ゾーン（{x.field.gmOnly.length}枚）</div>
              <div className="u-row u-mt">
                {x.field.gmOnly.map((c) => (
                  <GameCard key={c.id} card={{ ...c, faceDown: false }} width={100} showZone />
                ))}
              </div>
            </div>
            <div>
              <div className={s.metaLabel}>PL可視ゾーン（{x.field.plVisible.length}枚）</div>
              <div className="u-row u-mt">
                {x.field.plVisible.map((c) => (
                  <GameCard
                    key={c.id}
                    card={c}
                    width={100}
                    showZone
                    title={c.faceDown ? `伏せ札：${c.name}` : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="最近の進行">
          <div className={s.feed}>
            {x.feed.map((f) => (
              <div key={f.id} className={s.feedItem}>
                <span className={s.feedTime}>{hhmm(f.at)}</span>
                <span>
                  {f.cardName ? (
                    <>
                      {f.text.replace(`「${f.cardName}」`, '')}
                      <span className={s.cardChip}>{f.cardName}</span>
                    </>
                  ) : (
                    f.text
                  )}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="セッションの操作">
          <div className="u-row">
            <Button
              disabled={setMode.isPending || x.status !== 'playing'}
              onClick={() =>
                setMode.mutate({ sessionId, mode: x.mode === 'dense' ? 'light' : 'dense' })
              }
            >
              {x.mode === 'dense' ? '軽量モードに戻す' : '次のシーンを濃密モードにする'}
            </Button>
            <span className="u-small u-dim">
              戦闘イベントなど特定のカードは自動で濃密モードを要求する
            </span>
          </div>
          <div className="u-row u-mt">
            <Button
              variant="danger"
              disabled={end.isPending || x.status !== 'playing'}
              onClick={() =>
                window.confirm(
                  'セッションを終了しますか？結末タグの配布はPCの所有者が反映を選びます。',
                ) && end.mutate({ sessionId })
              }
            >
              セッションを終了する
            </Button>
            <span className="u-small u-dim">
              シナリオを使い切った時、またはGMが任意のタイミングで宣言できる
            </span>
          </div>
          {(setMode.error || end.error) && (
            <div className="u-mt">
              <ErrorNote error={setMode.error ?? end.error} />
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function ProposalTicket({ p, session }: { p: Proposal; session: Session }) {
  const approve = useApproveProposal();
  const reject = useRejectProposal();
  const [cardName, setCardName] = useState(toDictionaryForm(p.text));
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const busy = approve.isPending || reject.isPending;

  return (
    <article className={s.ticket} data-status={p.status}>
      <div className={s.ticketHead}>
        <div>
          <RoleBadge badgeRole="driver">{p.byName}</RoleBadge>
          <div className="u-small u-dim">シーン {p.sceneName}</div>
        </div>
        <span className="u-small u-dim u-num">{relativeTime(p.createdAt)}</span>
      </div>
      <p className={s.ticketText}>{p.text}</p>
      <div className="u-mt">
        <ChipGroup>
          {p.presentedChoices.map((c, i) => (
            <Chip key={c} tone="off">
              {i === 0 ? `提示中：${c}` : c}
            </Chip>
          ))}
        </ChipGroup>
      </div>
      <div className="u-mt">
        <StatusPill status={p.status}>{PROPOSAL_STATUS_LABEL[p.status]}</StatusPill>
      </div>

      {p.status === 'pending' && session.status === 'playing' && (
        <>
          {!rejecting ? (
            <div className={s.ticketAction}>
              <label className="u-small u-dim" htmlFor={`card-${p.id}`}>
                生成する選択肢カード名
              </label>
              <input
                id={`card-${p.id}`}
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
              />
              <Button
                variant="approve"
                disabled={busy || !cardName.trim()}
                onClick={() =>
                  approve.mutate({ sessionId: session.id, proposalId: p.id, cardName })
                }
              >
                採用してカード化
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => setRejecting(true)}>
                却下
              </Button>
            </div>
          ) : (
            <div className={s.ticketAction}>
              <label className="u-small u-dim" htmlFor={`reason-${p.id}`}>
                却下理由（PLにも見える）
              </label>
              <input
                id={`reason-${p.id}`}
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="例：このシーンには反応する仕掛けを用意していないため"
              />
              <Button
                variant="danger"
                disabled={busy || !reason.trim()}
                onClick={() => reject.mutate({ sessionId: session.id, proposalId: p.id, reason })}
              >
                却下を確定
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>
                戻る
              </Button>
            </div>
          )}
          {(approve.error || reject.error) && (
            <div className="u-mt">
              <ErrorNote error={approve.error ?? reject.error} />
            </div>
          )}
          <p
            className={s.ticketResolution}
            style={{ borderTop: 'none', paddingTop: 6, marginTop: 6 }}
          >
            ドライバーは裁定を待たず他の選択肢を先に選ぶこともできる。その場合この提案は「今回は使われなかった」として記録される。
          </p>
        </>
      )}
      {p.resolution && p.status !== 'pending' && (
        <p className={s.ticketResolution}>
          {p.status === 'approved' ? (
            <>
              <span className={s.cardChip}>{p.resolution}</span> を生成して手札に加えた。
            </>
          ) : p.status === 'rejected' ? (
            <>却下理由：{p.resolution}</>
          ) : (
            p.resolution
          )}
        </p>
      )}
    </article>
  );
}
