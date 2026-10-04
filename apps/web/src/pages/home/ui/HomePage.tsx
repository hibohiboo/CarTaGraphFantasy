import { deriveArchetype } from '@cartagraph/domain/character/archetype';
import { ARCHETYPE_LABEL } from '@cartagraph/domain/character/model';
import type { Session } from '@cartagraph/domain/session/model';
import { checkResume } from '@cartagraph/domain/session/start';
import { Link } from 'react-router';
import { useCharacters } from '@/entities/character/api/queries';
import { useSessions } from '@/entities/session/api/queries';
import { useMe } from '@/entities/user/api/queries';
import { routes } from '@/shared/routes/routes';
import s from '@/shared/ui/page.module.css';
import { Loading, RoleBadge, StatusPill } from '@/shared/ui/ui';

// トップページはプレイヤーの入り口だけをメインで見せる（「全部見える」トップにしない）。
// GM・シナリオ作成者向けの入り口はヘッダー下のフッターへ、システム管理者向けはさらに
// 控えめにフッターの隅へ移した（AppShell.tsx参照）。
const plRoutes = routes.filter((r) => r.group === 'pl' && !r.path.includes(':'));

export function HomePage() {
  const me = useMe();
  const sessions = useSessions();
  const characters = useCharacters();

  // 中断中（提案の裁定待ちなど）も、再開しに戻れるように出す（docs/cartagraph/party-and-session.md「中断」）
  const mySessions = (sessions.data ?? []).filter(
    (x) => x.status !== 'ended' && x.participants.some((p) => p.userId === me.data?.id),
  );
  const myChars = (characters.data ?? []).filter((c) => c.ownerId === me.data?.id);

  return (
    <>
      <section className={s.hero}>
        <h1 className={s.heroTitle}>ホーム</h1>
        <p className={s.heroLede}>
          {me.data && `${me.data.name}さん、`}今日はどの役割で卓につきますか。
        </p>
      </section>

      <div className={s.home}>
        <section className={s.homeCard}>
          <h2>いま進んでいること</h2>
          {sessions.isPending || characters.isPending || me.isPending ? (
            <Loading />
          ) : (
            <div className={s.homeLinks}>
              {myChars.length === 0 && (
                <span className="u-row">
                  <span className="u-dim u-small">まだキャラクターがいません。</span>
                  <Link to="/pl/tutorial">旅立ちの酒場へ行く</Link>
                  {/* 入口のチュートリアルが2つ並んでいる。どちらを入口にするかは人間の判断待ち
                      （docs/backlog/entrance-tutorial.md） */}
                  <Link to="/pl/village-start">村はずれの一歩から始める</Link>
                </span>
              )}
              {mySessions.map((x) => {
                // GM とドライバーを兼ねる（GM 不在の募集・GM が PL を兼ねる）なら、プレイ画面へ行くドライバーの行を優先する
                const rows = x.participants.filter((p) => p.userId === me.data?.id);
                const mine = rows.find((p) => p.role === 'driver') ?? rows[0];
                const to =
                  mine?.role === 'gm' ? `/gm/sessions/${x.id}` : `/pl/sessions/${x.id}/play`;
                return (
                  <span key={x.id} className="u-row">
                    <RoleBadge badgeRole={mine?.role ?? 'navigator'}>
                      {mine?.role === 'gm'
                        ? 'GM'
                        : mine?.role === 'driver'
                          ? 'ドライバー'
                          : 'ナビゲーター'}
                    </RoleBadge>
                    <Link to={to}>{x.scenarioTitle}</Link>
                    <span className="u-dim u-small">{x.currentScene.name}</span>
                    {x.status === 'suspended' && <SuspendedPill session={x} meId={me.data?.id} />}
                  </span>
                );
              })}
              {myChars.map((c) => (
                <span key={c.id} className="u-row">
                  <span className="u-dim u-small">PC</span>
                  <Link to={`/pl/characters/${c.id}`}>{c.name}</Link>
                  <span className="u-dim u-small">{ARCHETYPE_LABEL[deriveArchetype(c)]}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className={[s.homeCard, s.homeCardMain].join(' ')}>
          <h2>プレイヤーとして卓につく</h2>
          <div className={s.homeLinks}>
            {plRoutes.map((r) => (
              <span key={r.path}>
                <Link to={r.path}>{r.title}</Link>
                <span className="u-dim u-small"> — {r.description}</span>
              </span>
            ))}
          </div>
        </section>
      </div>
      <p className="u-small u-dim u-mt">
        GM・シナリオ作成者向けの入り口はページ下部に、システム管理者向けはさらにその隅にあります。
      </p>
    </>
  );
}

/**
 * 中断中のセッションが、いま再開できるか（docs/cartagraph/party-and-session.md「中断」）。GM の裁定が済んで
 * 自分が再開できるようになったことを、プレイ画面を開かなくても分かるようにする。判定はサーバーと同じ checkResume
 */
function SuspendedPill({ session, meId }: { session: Session; meId?: string }) {
  if (meId && checkResume(session, meId).ok)
    return <StatusPill status="approved">中断中：再開できます</StatusPill>;
  if (session.proposals.some((p) => p.status === 'pending'))
    return <StatusPill status="pending">中断中：GM の裁定待ち</StatusPill>;
  return <StatusPill status="neutral">中断中</StatusPill>;
}
