import { ARCHETYPE_LABEL, deriveArchetype } from '@cartagraph/domain';
import { Link } from 'react-router';
import { routes } from '../app/routes';
import { Loading, RoleBadge } from '../components/ui';
import { useCharacters, useMe, useSessions } from '../lib/queries';
import s from './pages.module.css';

// トップページはプレイヤーの入り口だけをメインで見せる（「全部見える」トップにしない）。
// GM・シナリオ作成者向けの入り口はヘッダー下のフッターへ、システム管理者向けはさらに
// 控えめにフッターの隅へ移した（AppShell.tsx参照）。
const plRoutes = routes.filter((r) => r.group === 'pl' && !r.path.includes(':'));

export function HomePage() {
  const me = useMe();
  const sessions = useSessions();
  const characters = useCharacters();

  const mySessions = (sessions.data ?? []).filter(
    (x) => x.status === 'playing' && x.participants.some((p) => p.userId === me.data?.id),
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
          {sessions.isPending || characters.isPending ? (
            <Loading />
          ) : (
            <div className={s.homeLinks}>
              {mySessions.map((x) => {
                const mine = x.participants.find((p) => p.userId === me.data?.id);
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
