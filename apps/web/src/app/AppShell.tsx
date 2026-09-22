import { NavLink, Outlet, useLocation } from 'react-router';
import s from './AppShell.module.css';
import { GROUP_LABEL, navRoutes, type RouteGroup } from './routes';

const DOCS_URL = 'https://hibohiboo.github.io/CarTaGraphFantasy/';

// ヘッダーはプレイヤー（主役）とルールブック（誰でも参照する）だけを常時表示する。
// GM・シナリオ作成者向けの入り口はフッターへ、システム管理者向けはさらに控えめに
// フッターの隅へ移した（トップページを「全部見える」状態にしないための整理）。
const headerGroupOrder: RouteGroup[] = ['common', 'pl', 'rulebook'];
const footerGroupOrder: RouteGroup[] = ['gm', 'creator'];

export function AppShell() {
  const location = useLocation();
  // プレイページは1画面完結レイアウトなので、main を縦に埋める
  const fill = /^\/pl\/sessions\/[^/]+\/play$/.test(location.pathname);
  // 入口（扉のカード1枚だけの最初の画面）はヘッダーを出さない
  const isEntrance = location.pathname === '/';
  // チュートリアル（旅立ちの酒場）はNPCとの問答に集中させるため、ヘッダー・フッターとも出さない
  const isTutorial = location.pathname === '/pl/tutorial';

  return (
    <div className={s.shell}>
      {!isEntrance && !isTutorial && (
        <nav className={[s.nav, s.inner].join(' ')} aria-label="主要ナビゲーション">
          <NavLink to="/" className={s.brand}>
            カルタグラフ
          </NavLink>
          {headerGroupOrder.map((g) => {
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
      )}
      <main className={s.main} data-fill={fill ? 'true' : undefined}>
        <div className={s.inner}>
          <Outlet />
        </div>
      </main>
      {!fill && !isTutorial && (
        <footer className={[s.footer, s.inner].join(' ')}>
          <p>
            仕様の正は <a href={DOCS_URL}>設計ドキュメント（docs）</a>
            。この画面はバックエンド未実装のモックデータで動いています。
          </p>
          <div className={s.footerNav}>
            {footerGroupOrder.map((g) => {
              const items = navRoutes.filter((r) => r.group === g);
              if (items.length === 0) return null;
              return (
                <span key={g} className={s.footerGroup}>
                  <span className={s.groupLabel}>{GROUP_LABEL[g]}</span>
                  {items.map((r) => (
                    <NavLink key={r.path} to={r.path} className={s.link}>
                      {r.title.replace(/（.*）/, '')}
                    </NavLink>
                  ))}
                </span>
              );
            })}
            <NavLink to="/admin/sitemap" className={s.footerAdmin}>
              システム管理者向け
            </NavLink>
          </div>
        </footer>
      )}
    </div>
  );
}
