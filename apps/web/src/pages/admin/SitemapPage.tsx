import { Link } from 'react-router';
import { GROUP_LABEL, type RouteGroup, routes } from '../../app/routes';
import { PageHeader, Panel } from '../../components/ui';
import s from '../pages.module.css';

const order: RouteGroup[] = ['common', 'pl', 'gm', 'creator', 'rulebook', 'admin'];

/** サイトマップ。routes.ts をそのまま表にする（ナビと同じ情報源） */
export function SitemapPage() {
  return (
    <>
      <PageHeader
        title="サイトマップ"
        crumb="全ページの一覧。ルート定義（routes.ts）から生成しているので、ナビゲーションと食い違わない。"
      />
      <div className={s.stack}>
        {order.map((g) => (
          <Panel key={g} title={GROUP_LABEL[g]}>
            <div className={s.tableWrap}>
              <table className={[s.prose, s.sitemapTable].join(' ')} style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th>パス</th>
                    <th>ページ</th>
                    <th>役割</th>
                  </tr>
                </thead>
                <tbody>
                  {routes
                    .filter((r) => r.group === g)
                    .map((r) => (
                      <tr key={r.path}>
                        <td>
                          <code className="u-small">{r.path}</code>
                        </td>
                        <td>
                          <Link to={r.example ?? r.path}>{r.title}</Link>
                          {r.example && <span className="u-small u-dim">（例）</span>}
                        </td>
                        <td>{r.description}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
