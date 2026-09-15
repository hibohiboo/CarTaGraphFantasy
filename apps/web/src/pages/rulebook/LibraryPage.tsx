import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CARD_KIND_LABEL, type CardKind } from '@cartagraph/domain';
import { useLibrary } from '../../lib/queries';
import { Button, CardGrid, ErrorNote, GameCard, Loading, PageHeader, Panel } from '../../components';
import { relativeTime } from '../../lib/format';
import s from '../pages.module.css';

/**
 * 共有設定＝正史グラフから格上げされた共有ライブラリ（graph.md「正史グラフの共有ライブラリ化」）。
 * セッションで生まれたカード・関係性が人間の判断で格上げされ、新しいシナリオの土台になる。
 */
export function LibraryPage() {
  const library = useLibrary();
  const [kind, setKind] = useState<CardKind | 'all'>('all');

  const kinds = useMemo(() => [...new Set((library.data ?? []).map((e) => e.kind))], [library.data]);
  if (library.isPending) return <Loading />;
  if (library.error) return <ErrorNote error={library.error} />;

  const entries = library.data.filter((e) => kind === 'all' || e.kind === kind);

  return (
    <>
      <PageHeader title="共有設定" crumb={<><Link to="/rulebook">ルールブック</Link> › 共有設定。セッションから生まれたカード・関係性のうち、他のシナリオでも使えると判断されたものが共有ライブラリとして積みあがる。既存シナリオのカードを書き換えることはない。</>} />
      <div className={s.stack}>
        <div className="u-row">
          <Button size="sm" variant={kind === 'all' ? 'primary' : 'ghost'} onClick={() => setKind('all')}>
            すべて（{library.data.length}）
          </Button>
          {kinds.map((k) => (
            <Button key={k} size="sm" variant={kind === k ? 'primary' : 'ghost'} onClick={() => setKind(k)}>
              {CARD_KIND_LABEL[k]}
            </Button>
          ))}
        </div>
        <CardGrid min={200}>
          {entries.map((e) => (
            <GameCard key={e.id} card={{ kind: e.kind, name: e.name, description: e.description, tags: e.tags }} fluid showDescription showTags stamp="決" title={`${e.originScenarioTitle}から格上げ`}>
              <p className="u-small" style={{ color: 'var(--ink-soft)', marginTop: 6 }}>
                出自：{e.originScenarioTitle}
                <br />
                格上げ：{e.promotedBy}・{relativeTime(e.promotedAt)}
              </p>
            </GameCard>
          ))}
        </CardGrid>
        <Panel title="格上げの流れ" sub="進化候補の評価フローと同じ、人間の判断を挟むボトムアップの仕組み。">
          <ol className="u-small" style={{ margin: 0, paddingLeft: '1.4em' }}>
            <li>セッション中に生まれたカード・関係性（GMが生成した選択肢など）がセッションログに残る。</li>
            <li>誰でも「これは他のシナリオでも使えそうだ」と発見・記録できる。</li>
            <li>システム製作者またはシナリオ製作者が判断し、採用したものを共有ライブラリへ格上げする。却下も理由とともに残る。</li>
            <li>新しいシナリオは、共有ライブラリの設定をテンプレートとして選べる。</li>
          </ol>
        </Panel>
      </div>
    </>
  );
}
