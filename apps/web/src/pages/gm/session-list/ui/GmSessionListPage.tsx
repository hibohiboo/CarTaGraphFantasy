import type { Session } from '@cartagraph/domain/session/model';
import { Link } from 'react-router';
import { useRecruitments, useSessions } from '@/entities/session/api/queries';
import { useMe } from '@/entities/user/api/queries';
import { relativeTime } from '@/shared/lib/format';
import s from '@/shared/ui/page.module.css';
import {
  EmptyNote,
  ErrorNote,
  Loading,
  PageHeader,
  Panel,
  RoleBadge,
  StatusPill,
} from '@/shared/ui/ui';
import { GmlessRecruitmentCard } from './GmlessRecruitmentCard';
import { StartFromRecruitment } from './StartFromRecruitment';

const STATUS_LABEL: Record<Session['status'], string> = {
  playing: '進行中',
  suspended: '中断',
  ended: '終了',
};

export function GmSessionListPage() {
  const sessions = useSessions();
  const recruitments = useRecruitments();
  const me = useMe();
  if (sessions.isPending || recruitments.isPending || me.isPending) return <Loading />;
  if (sessions.error) return <ErrorNote error={sessions.error} />;
  if (recruitments.error) return <ErrorNote error={recruitments.error} />;

  const mine = sessions.data.filter((x) => x.gmId === me.data?.id);
  const others = sessions.data.filter((x) => x.gmId !== me.data?.id);
  // 受付中の募集だけが返る（開始済みはサーバーが除く）。自分が出したものに絞る
  const myRecruitments = recruitments.data.filter((r) => r.gmId === me.data?.id);

  return (
    <>
      <PageHeader
        title="セッション管理"
        crumb="自分の募集からセッションを始め、GMを務めるセッションを進める。提案の裁定・モード切り替え・終了宣言はここから。"
        actions={<Link to="/gm/scenarios">新しく募集を出す →</Link>}
      />
      <div className={s.stack}>
        <Panel
          title="自分の募集"
          sub="通常の募集は、応募の中から参加させるPCとドライバーを選んで、セッションを始める（始めた募集は一覧から消える）。GM 不在の募集は、PL が自分のPCで自由に始める（受付中のまま残る）。"
        >
          {myRecruitments.length === 0 && <EmptyNote>受付中の募集はありません。</EmptyNote>}
          <div className={s.cardsRow}>
            {myRecruitments.map((rc) =>
              rc.kind === 'gmless' ? (
                <GmlessRecruitmentCard
                  key={rc.id}
                  rc={rc}
                  startedCount={sessions.data.filter((x) => x.recruitmentId === rc.id).length}
                />
              ) : (
                <StartFromRecruitment key={rc.id} rc={rc} />
              ),
            )}
          </div>
        </Panel>
        <Panel title="GMとして進行中">
          {mine.length === 0 && <EmptyNote>GMを務めるセッションはまだありません。</EmptyNote>}
          <div className={s.list}>
            {mine.map((x) => (
              <div key={x.id} className={s.listItem} data-session-row>
                <div className={s.itemLeft}>
                  <RoleBadge badgeRole="gm">GM</RoleBadge>
                  <span>
                    <Link to={`/gm/sessions/${x.id}`}>{x.scenarioTitle}</Link>
                    <br />
                    <span className={s.itemSub}>
                      パーティー「{x.partyName}」／ {x.currentScene.name}
                    </span>
                  </span>
                </div>
                <span className="u-row">
                  {x.gmless && <StatusPill status="neutral">GM 不在</StatusPill>}
                  <StatusPill status={x.status === 'playing' ? 'good' : 'neutral'}>
                    {STATUS_LABEL[x.status]}
                  </StatusPill>
                  {x.status === 'suspended' && x.suspendedFor === 'proposal' && (
                    <StatusPill status="pending">提案の裁定待ち</StatusPill>
                  )}
                  {x.suspendedFor !== 'proposal' &&
                    x.proposals.some((p) => p.status === 'pending') && (
                      <StatusPill status="pending">裁定待ちあり</StatusPill>
                    )}
                  <span className={s.itemTime}>最終反応 {relativeTime(x.lastActivityAt)}</span>
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="参加者として関わっているセッション" sub="PL側の画面へ移る。">
          <div className={s.list}>
            {others.map((x) => {
              const meP = x.participants.find((p) => p.userId === me.data?.id);
              return (
                <div key={x.id} className={s.listItem}>
                  <div className={s.itemLeft}>
                    {meP && (
                      <RoleBadge badgeRole={meP.role}>
                        {meP.role === 'driver' ? 'ドライバー' : 'ナビゲーター'}
                      </RoleBadge>
                    )}
                    <span>
                      <Link to={`/pl/sessions/${x.id}/play`}>{x.scenarioTitle}</Link>
                      <br />
                      <span className={s.itemSub}>GM：{x.gmName}</span>
                    </span>
                  </div>
                  <StatusPill status={x.status === 'playing' ? 'good' : 'neutral'}>
                    {STATUS_LABEL[x.status]}
                  </StatusPill>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}
