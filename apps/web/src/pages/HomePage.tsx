import { Link } from 'react-router';
import { deriveArchetype, ARCHETYPE_LABEL } from '@cartagraph/domain';
import { useCharacters, useMe, useSessions } from '../lib/queries';
import { GROUP_LABEL, routes, type RouteGroup } from '../app/routes';
import { Loading, RoleBadge } from '../components';
import s from './pages.module.css';

const groups: RouteGroup[] = ['pl', 'gm', 'creator', 'rulebook', 'admin'];

export function HomePage() {
  const me = useMe();
  const sessions = useSessions();
  const characters = useCharacters();

  const mySessions = (sessions.data ?? []).filter((x) => x.status === 'playing' && x.participants.some((p) => p.userId === me.data?.id));
  const myChars = (characters.data ?? []).filter((c) => c.ownerId === me.data?.id);

  return (
    <>
      <section className={s.hero}>
        <h1 className={s.heroTitle}>
          カードを開き、糸をたどって、
          <br />
          世界を読む。
        </h1>
        <p className={s.heroLede}>
          カルタグラフは、ルールも世界もシナリオも「カード」で読めるTRPGです。
          {me.data && ` ${me.data.name}さん、`}今日はどの役割で卓につきますか。
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
                const to = mine?.role === 'gm' ? `/gm/sessions/${x.id}` : `/pl/sessions/${x.id}/play`;
                return (
                  <span key={x.id} className="u-row">
                    <RoleBadge role={mine?.role ?? 'navigator'}>{mine?.role === 'gm' ? 'GM' : mine?.role === 'driver' ? 'ドライバー' : 'ナビゲーター'}</RoleBadge>
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

        {groups.map((g) => (
          <section key={g} className={s.homeCard}>
            <h2>{GROUP_LABEL[g]}</h2>
            <div className={s.homeLinks}>
              {routes
                .filter((r) => r.group === g && !r.path.includes(':'))
                .map((r) => (
                  <span key={r.path}>
                    <Link to={r.path}>{r.title}</Link>
                    <span className="u-dim u-small"> — {r.description}</span>
                  </span>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
