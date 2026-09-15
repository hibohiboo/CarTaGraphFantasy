import { Link } from 'react-router';
import { PageHeader, StatusPill } from '../../components';
import { DOCS_BASE, type RuleSection, rulebook } from '../../content/rulebook';
import { useMe } from '../../lib/queries';
import s from '../pages.module.css';

export function RulebookSectionPage({ sectionId }: { sectionId: RuleSection['id'] }) {
  const sec = rulebook.find((r) => r.id === sectionId)!;
  const me = useMe();
  const read = me.data?.readRules.includes(sec.id);

  return (
    <>
      <PageHeader
        title={sec.title}
        crumb={
          <>
            <Link to="/rulebook">ルールブック</Link> › {sec.title}
          </>
        }
        actions={
          read ? (
            <StatusPill status="approved">読了（自己申告）</StatusPill>
          ) : (
            <StatusPill status="neutral">未読</StatusPill>
          )
        }
      />
      <article className={s.prose} style={{ paddingBottom: 40 }}>
        <p className="u-dim">{sec.lede}</p>
        {sec.blocks.map((b) => (
          <section key={b.heading}>
            <h2>{b.heading}</h2>
            {b.paragraphs?.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {b.bullets && (
              <ul>
                {b.bullets.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            )}
            {b.table && (
              <div className={s.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      {b.table.head.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.table.rows.map((r) => (
                      <tr key={r[0]}>
                        {r.map((c, i) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: rulebook.ts の固定データを並べるだけで、並び替え・増減はしない
                          <td key={`${r[0]}-${i}`}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className={s.source}>
              出典：<a href={`${DOCS_BASE}${b.source}`}>{b.source.replace(/#.*$/, '')}</a>
            </p>
          </section>
        ))}
      </article>
    </>
  );
}
