import { Link } from 'react-router';
import {
  EmptyNote,
  ErrorNote,
  Loading,
  PageHeader,
  Panel,
  RoleBadge,
  StatusPill,
} from '../../components/ui';
import { relativeTime } from '../../lib/format';
import { useMe, useSessions } from '../../lib/queries';
import s from '../pages.module.css';

const STATUS_LABEL = {
  recruiting: '募集中',
  playing: '進行中',
  suspended: '中断',
  ended: '終了',
} as const;

export function GmSessionListPage() {
  const sessions = useSessions();
  const me = useMe();
  if (sessions.isPending || me.isPending) return <Loading />;
  if (sessions.error) return <ErrorNote error={sessions.error} />;

  const mine = sessions.data.filter((x) => x.gmId === me.data?.id);
  const others = sessions.data.filter((x) => x.gmId !== me.data?.id);

  return (
    <>
      <PageHeader
        title="セッション管理"
        crumb="自分がGMを務めるセッション。提案の裁定・モード切り替え・終了宣言はここから。"
        actions={<Link to="/gm/scenarios">新しく募集を出す →</Link>}
      />
      <div className={s.stack}>
        <Panel title="GMとして進行中">
          {mine.length === 0 && <EmptyNote>GMを務めるセッションはまだありません。</EmptyNote>}
          <div className={s.list}>
            {mine.map((x) => (
              <div key={x.id} className={s.listItem}>
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
                  <StatusPill status={x.status === 'playing' ? 'good' : 'neutral'}>
                    {STATUS_LABEL[x.status]}
                  </StatusPill>
                  {x.proposals.some((p) => p.status === 'pending') && (
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
