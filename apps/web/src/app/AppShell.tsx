import { NavLink, Outlet, useLocation } from 'react-router';
import s from './AppShell.module.css';
import { GROUP_LABEL, navRoutes, type RouteGroup } from './routes';

const DOCS_URL = 'https://hibohiboo.github.io/CarTaGraphFantasy/';

const groupOrder: RouteGroup[] = ['common', 'pl', 'gm', 'creator', 'rulebook', 'admin'];

export function AppShell() {
  const location = useLocation();
  // プレイページは1画面完結レイアウトなので、main を縦に埋める
  const fill = /^\/pl\/sessions\/[^/]+\/play$/.test(location.pathname);

  return (
    <div className={s.shell}>
      <nav className={[s.nav, s.inner].join(' ')} aria-label="主要ナビゲーション">
        <NavLink to="/" className={s.brand}>
          カルタグラフ
        </NavLink>
        {groupOrder.map((g) => {
          const items = navRoutes.filter((r) => r.group === g && r.path !== '/');
          if (items.length === 0) return null;
          return (
            <div key={g} className={s.group}>
              <span className={s.groupLabel}>{GROUP_LABEL[g]}</span>
              {items.map((r) => (
                <NavLink key={r.path} to={r.path} className={s.link}>
                  {r.title.replace(/（.*）/, '')}
                </NavLink>
              ))}
            </div>
          );
        })}
        <span className={s.mockPill} title="バックエンド未実装。MSWでAPIを代替しています">
          モックAPI
        </span>
      </nav>
      <main className={s.main} data-fill={fill ? 'true' : undefined}>
        <div className={s.inner}>
          <Outlet />
        </div>
      </main>
      {!fill && (
        <footer className={[s.footer, s.inner].join(' ')}>
          仕様の正は <a href={DOCS_URL}>設計ドキュメント（docs）</a>
          。この画面はバックエンド未実装のモックデータで動いています。
        </footer>
      )}
    </div>
  );
}
