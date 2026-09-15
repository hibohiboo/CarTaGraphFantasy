import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useCreateRecruitment, useScenario } from '../../lib/queries';
import { Button, Chip, ChipGroup, DeckTree, ErrorNote, Field, Loading, PageHeader, Panel, RoleBadge } from '../../components';
import s from '../pages.module.css';

/**
 * GMのカスタマイズ＝シナリオデッキの中から今回使うカード・シーンを選ぶ／外す（scenario-flow.md）。
 * 難易度調整や設定差し替えも裁量で許容されるが、この画面ではまず取捨選択だけを扱う。
 */
export function GmScenarioDetailPage() {
  const { scenarioId = '' } = useParams();
  const scenario = useScenario(scenarioId);
  const recruit = useCreateRecruitment();
  const navigate = useNavigate();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [capacity, setCapacity] = useState(3);
  const [note, setNote] = useState('');

  if (scenario.isPending) return <Loading />;
  if (scenario.error) return <ErrorNote error={scenario.error} />;
  const sc = scenario.data;

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <PageHeader title={sc.title} crumb={<>シナリオ製作者：{sc.authorName} ／ <Link to="/gm/scenarios">シナリオ一覧へ戻る</Link></>} actions={<RoleBadge role="gm">GMとしてカスタマイズ中</RoleBadge>} />
      <div className={s.twoCol}>
        <aside className="u-stack">
          <Panel title="メタデータ" sub="募集を出すときPLに明示される。前提タグはソフトガイドで、満たさない応募も止めない。">
            <div className={s.metaRow}>
              <div className={s.metaLabel}>参照するデータ種別</div>
              <ChipGroup>
                {sc.referenceTags.length === 0 && <Chip tone="off">なし（旅人向け）</Chip>}
                {sc.referenceTags.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </ChipGroup>
            </div>
            <div className={s.metaRow}>
              <div className={s.metaLabel}>前提タグ</div>
              <ChipGroup>
                {sc.prerequisiteTags.length === 0 && <Chip tone="off">なし（誰でも応募可）</Chip>}
                {sc.prerequisiteTags.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </ChipGroup>
            </div>
            <div className={s.metaRow}>
              <div className={s.metaLabel}>想定人数</div>
              <div className={s.metaValue}>{sc.partySize.min}〜{sc.partySize.max}人（ドライバー1人）</div>
            </div>
            <div className={s.metaRow}>
              <div className={s.metaLabel}>空間モデル</div>
              <div className={s.metaValue}>{sc.spaceModel === '2d' ? '2次元' : sc.spaceModel === '1d' ? '1次元' : '戦闘なし'}</div>
            </div>
            <div className={s.metaRow}>
              <div className={s.metaLabel}>推奨CP／基本CP</div>
              <div className={s.metaValue}>{sc.recommendedCp}枚分／クリア時 {sc.baseCp}</div>
            </div>
          </Panel>
          <Panel title="募集を出す" sub="想定人数・前提タグ・空間モデルは自動で明示される。">
            <div className={s.form}>
              <Field label="募集人数（ドライバー候補＋PC）">
                <input type="number" min={1} max={sc.partySize.max} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
              </Field>
              <Field label="募集メモ（任意）">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：初心者歓迎。前提を満たさなくても相談を" />
              </Field>
              <Button
                block
                disabled={recruit.isPending}
                onClick={() =>
                  recruit.mutate(
                    { scenarioId: sc.id, capacity, note: note || undefined, excludedNodeIds: [...excluded] },
                    { onSuccess: () => navigate('/pl/sessions') },
                  )
                }
              >
                {recruit.isPending ? '募集を作成中…' : `この構成で募集を出す（${excluded.size}件を外す）`}
              </Button>
              {recruit.error && <ErrorNote error={recruit.error} />}
            </div>
          </Panel>
        </aside>
        <div className="u-stack">
          <Panel title="シナリオデッキの取捨選択" sub="今回使うシーン・カードを選ぶ／外す。外したシーンはこのセッションのスナップショットに含まれない。">
            <DeckTree
              nodes={sc.deck}
              excludedIds={excluded}
              renderActions={(n) =>
                n.kind === 'intro' || n.kind === 'ending' ? null : (
                  <Button size="sm" variant="ghost" onClick={() => toggle(n.id)}>
                    {excluded.has(n.id) ? '戻す' : '外す'}
                  </Button>
                )
              }
            />
          </Panel>
          <Panel title="結末タグ" sub="このシナリオが配り得る結末。後続シナリオの前提タグと同じ仕組みで突き合わされる。">
            <div className={s.list}>
              {sc.endings.map((e) => (
                <div key={e.id} className={s.listItem}>
                  <span>{e.name}</span>
                  <span className={s.itemSub}>{e.grantsTag ? `→ 前提タグ「${e.grantsTag}」` : '→ 前提タグなし（単発として扱う）'}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
