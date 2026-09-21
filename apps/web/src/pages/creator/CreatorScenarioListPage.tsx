import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Button,
  ErrorNote,
  Loading,
  PageHeader,
  Panel,
  RoleBadge,
  StatusPill,
} from '../../components/ui';
import { relativeTime } from '../../lib/format';
import { useCreateScenario, useScenarios } from '../../lib/queries';
import s from '../pages.module.css';

/** シナリオ作成者のシナリオ管理：自分が作ったシナリオの一覧と新規作成 */
export function CreatorScenarioListPage() {
  const scenarios = useScenarios(true);
  const create = useCreateScenario();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');

  if (scenarios.isPending) return <Loading />;
  if (scenarios.error) return <ErrorNote error={scenarios.error} />;

  return (
    <>
      <PageHeader
        title="自分のシナリオ"
        crumb="シナリオ製作者＝シナリオを作る人。GMとの兼任は妨げない。共有ライブラリに公開すると、他のGMが選べるようになる。"
        actions={<RoleBadge badgeRole="creator">シナリオ製作者</RoleBadge>}
      />
      <div className={s.stack}>
        <Panel
          title="新しいシナリオを作る"
          sub="共有ライブラリの設定をテンプレートとして使える（ルールブック → 共有設定）。"
        >
          <div className="u-row">
            <input
              type="text"
              style={{ maxWidth: 360 }}
              placeholder="シナリオのタイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button
              disabled={create.isPending || !title.trim()}
              onClick={() =>
                create.mutate(
                  { title },
                  { onSuccess: (sc) => navigate(`/creator/scenarios/${sc.id}`) },
                )
              }
            >
              下書きを作成
            </Button>
          </div>
          {create.error && (
            <div className="u-mt">
              <ErrorNote error={create.error} />
            </div>
          )}
        </Panel>
        <Panel title="シナリオ一覧">
          <div className={s.list}>
            {scenarios.data.map((sc) => (
              <div key={sc.id} className={s.listItem}>
                <div className={s.itemLeft}>
                  <span>
                    <Link to={`/creator/scenarios/${sc.id}`}>{sc.title}</Link>
                    <br />
                    <span className={s.itemSub}>
                      シーン {sc.deck.filter((n) => n.kind === 'scene').length}・結末{' '}
                      {sc.endings.length}・更新 {relativeTime(sc.updatedAt)}
                    </span>
                  </span>
                </div>
                <StatusPill status={sc.libraryStatus === 'published' ? 'approved' : 'neutral'}>
                  {sc.libraryStatus === 'published' ? '共有ライブラリ公開中' : '下書き'}
                </StatusPill>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
