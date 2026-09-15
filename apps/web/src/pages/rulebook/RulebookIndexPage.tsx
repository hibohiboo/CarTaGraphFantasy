import { useNavigate } from 'react-router';
import { GameCard, PageHeader } from '../../components';
import { DOCS_BASE, rulebook } from '../../content/rulebook';
import { useMe } from '../../lib/queries';
import s from '../pages.module.css';

/** ルールブック目次。ルールもカードのモチーフで読む（cartagraph/index.md「Webサイト」） */
export function RulebookIndexPage() {
  const navigate = useNavigate();
  const me = useMe();
  const read = new Set(me.data?.readRules ?? []);

  return (
    <>
      <PageHeader
        title="ルールブック"
        crumb={
          <>
            遊び方・判定ルール・積みあがった共有設定。仕様の正は{' '}
            <a href={DOCS_BASE}>設計ドキュメント</a>
            で、ここはプレイヤー向けの要約。朱印は「読んだ」の自己申告（制作側の学習的アンロック）。
          </>
        }
      />
      <div className={s.tocGrid}>
        {rulebook.map((sec) => (
          <GameCard
            key={sec.id}
            card={{ kind: 'info', name: sec.title, description: sec.lede }}
            fluid
            showDescription
            stamp={read.has(sec.id) ? '読' : undefined}
            onClick={() => navigate(`/rulebook/${sec.id}`)}
          >
            <p className="u-small" style={{ color: 'var(--ink-soft)', marginTop: 8 }}>
              {sec.blocks.length}節
            </p>
          </GameCard>
        ))}
        <GameCard
          card={{
            kind: 'relation',
            name: '共有設定',
            description:
              'セッションから積みあがり、共有ライブラリへ格上げされた設定・カード。新しいシナリオの土台に使える。',
          }}
          fluid
          showDescription
          onClick={() => navigate('/rulebook/library')}
        />
      </div>
    </>
  );
}
