import type { DeckNode, EndingDef, Scenario } from '@cartagraph/domain';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Button,
  DeckTree,
  ErrorNote,
  Field,
  Loading,
  PageHeader,
  Panel,
  RoleBadge,
  StatusPill,
} from '../../components';
import { useScenario, useUpdateScenario } from '../../lib/queries';
import s from '../pages.module.css';

const REFERENCE_TAGS = ['体・技・心を参照', 'HPを参照', '戦闘スキルを参照'];

/** シナリオ編集：メタデータ・デッキ構造・結末タグ（scenario-manage.html を編集可能にしたもの） */
export function CreatorScenarioEditPage() {
  const { scenarioId = '' } = useParams();
  const scenario = useScenario(scenarioId);
  const update = useUpdateScenario();

  if (scenario.isPending) return <Loading />;
  if (scenario.error) return <ErrorNote error={scenario.error} />;
  return (
    <Editor
      key={scenario.data.updatedAt}
      sc={scenario.data}
      save={(patch) => update.mutate({ id: scenarioId, patch })}
      saving={update.isPending}
      error={update.error}
    />
  );
}

function Editor({
  sc,
  save,
  saving,
  error,
}: {
  sc: Scenario;
  save: (p: Partial<Scenario>) => void;
  saving: boolean;
  error: unknown;
}) {
  const [draft, setDraft] = useState<Scenario>(sc);
  const [dirty, setDirty] = useState(false);
  useEffect(() => setDirty(JSON.stringify(draft) !== JSON.stringify(sc)), [draft, sc]);

  const set = <K extends keyof Scenario>(k: K, v: Scenario[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  const toggleTag = (t: string) =>
    set(
      'referenceTags',
      draft.referenceTags.includes(t)
        ? draft.referenceTags.filter((x) => x !== t)
        : [...draft.referenceTags, t],
    );

  const addScene = () => {
    const scenes = draft.deck.filter((n) => n.kind === 'scene').length;
    const node: DeckNode = {
      id: `d-${Date.now()}`,
      kind: 'scene',
      name: `${scenes + 1} 新しいシーン`,
      cards: [],
    };
    const endingIdx = draft.deck.findIndex((n) => n.kind === 'ending');
    const deck = [...draft.deck];
    deck.splice(endingIdx < 0 ? deck.length : endingIdx, 0, node);
    set('deck', deck);
  };
  const removeNode = (id: string) =>
    set(
      'deck',
      draft.deck.filter((n) => n.id !== id),
    );
  const toggleDense = (id: string) =>
    set(
      'deck',
      draft.deck.map((n) => (n.id === id ? { ...n, dense: !n.dense } : n)),
    );
  const addEnding = () =>
    set('endings', [...draft.endings, { id: `e-${Date.now()}`, name: '新しい結末' }]);
  const setEnding = (id: string, patch: Partial<EndingDef>) =>
    set(
      'endings',
      draft.endings.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );

  return (
    <>
      <PageHeader
        title={draft.title || '（無題）'}
        crumb={
          <>
            シナリオ製作者：{sc.authorName} ／ <Link to="/creator/scenarios">一覧へ戻る</Link>
          </>
        }
        actions={
          <>
            {/* biome-ignore lint/a11y/useValidAriaRole: RoleBadge の role は独自propで、ARIAのrole属性ではない */}
            <RoleBadge role="creator">シナリオ製作者</RoleBadge>
            <StatusPill status={sc.libraryStatus === 'published' ? 'approved' : 'neutral'}>
              {sc.libraryStatus === 'published' ? '共有ライブラリ公開中' : '下書き'}
            </StatusPill>
            <Button disabled={!dirty || saving} onClick={() => save(draft)}>
              {saving ? '保存中…' : '保存'}
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() =>
                save({ libraryStatus: sc.libraryStatus === 'published' ? 'draft' : 'published' })
              }
            >
              {sc.libraryStatus === 'published' ? '非公開にする' : '共有ライブラリへ公開'}
            </Button>
          </>
        }
      />
      {error ? <ErrorNote error={error} /> : null}
      <div className={s.twoCol}>
        <aside className="u-stack">
          <Panel
            title="メタデータ"
            sub="GMがシナリオを選ぶ際の判断材料。前提タグを満たさなくても応募自体は止めない。"
          >
            <div className={s.form}>
              <Field label="タイトル">
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => set('title', e.target.value)}
                />
              </Field>
              <Field label="概要">
                <textarea value={draft.summary} onChange={(e) => set('summary', e.target.value)} />
              </Field>
              <div>
                <div className={s.metaLabel}>
                  参照するデータ種別（旅人／探索者／冒険者はこの組み合わせの通称）
                </div>
                {REFERENCE_TAGS.map((t) => (
                  <label key={t} className="u-row u-small" style={{ marginTop: 4 }}>
                    <input
                      type="checkbox"
                      style={{ width: 'auto' }}
                      checked={draft.referenceTags.includes(t)}
                      onChange={() => toggleTag(t)}
                    />
                    {t}
                  </label>
                ))}
              </div>
              <Field label="前提タグ（カンマ区切り。前作の結末タグも同じ仕組み）">
                <input
                  type="text"
                  value={draft.prerequisiteTags.join(', ')}
                  onChange={(e) =>
                    set(
                      'prerequisiteTags',
                      e.target.value
                        .split(/[,、]/)
                        .map((x) => x.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </Field>
              <div className={s.formRow}>
                <Field label="想定人数（最小）">
                  <input
                    type="number"
                    min={1}
                    value={draft.partySize.min}
                    onChange={(e) =>
                      set('partySize', { ...draft.partySize, min: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="想定人数（最大）">
                  <input
                    type="number"
                    min={1}
                    value={draft.partySize.max}
                    onChange={(e) =>
                      set('partySize', { ...draft.partySize, max: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
              <Field label="空間モデル（戦闘がある場合）">
                <select
                  value={draft.spaceModel ?? ''}
                  onChange={(e) =>
                    set('spaceModel', (e.target.value || null) as Scenario['spaceModel'])
                  }
                >
                  <option value="">戦闘なし</option>
                  <option value="1d">1次元（敵後衛／敵前衛／味方前衛／味方後衛）</option>
                  <option value="2d">2次元（1マス1キャラクター）</option>
                </select>
              </Field>
              <div className={s.formRow}>
                <Field label="推奨CP（ソフトガイド）">
                  <input
                    type="number"
                    min={0}
                    value={draft.recommendedCp}
                    onChange={(e) => set('recommendedCp', Number(e.target.value))}
                  />
                </Field>
                <Field label="クリア時の基本CP">
                  <input
                    type="number"
                    min={0}
                    value={draft.baseCp}
                    onChange={(e) => set('baseCp', Number(e.target.value))}
                  />
                </Field>
              </div>
            </div>
          </Panel>
        </aside>
        <div className="u-stack">
          <Panel
            title="シナリオデッキの構造"
            sub="導入→シーン→エンディングの入れ子。カスタマイズはGMの仕事だが、土台となる構造・取捨選択肢はここで用意する。"
            actions={
              <Button size="sm" variant="ghost" onClick={addScene}>
                シーンを追加
              </Button>
            }
          >
            <DeckTree
              nodes={draft.deck}
              renderActions={(n) =>
                n.kind === 'scene' ? (
                  <>
                    <Link to={`/creator/scenarios/${sc.id}/scenes/${n.id}`}>編集</Link>
                    <Button size="sm" variant="ghost" onClick={() => toggleDense(n.id)}>
                      {n.dense ? '軽量に' : '濃密に'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeNode(n.id)}>
                      削除
                    </Button>
                  </>
                ) : null
              }
            />
          </Panel>
          <Panel
            title="結末タグ"
            sub="結末は成功／失敗の2値に限らず、任意の数を定義できる。配るタグは後続シナリオの前提タグと同じ仕組みで突き合わされる。"
            actions={
              <Button size="sm" variant="ghost" onClick={addEnding}>
                結末を追加
              </Button>
            }
          >
            <div className={s.list}>
              {draft.endings.map((e) => (
                <div key={e.id} className={s.listItem}>
                  <input
                    type="text"
                    style={{ flex: 2, minWidth: 160, width: 'auto' }}
                    value={e.name}
                    onChange={(ev) => setEnding(e.id, { name: ev.target.value })}
                    aria-label="結末の名前"
                  />
                  <input
                    type="text"
                    style={{ flex: 1, minWidth: 140, width: 'auto' }}
                    value={e.grantsTag ?? ''}
                    placeholder="配る前提タグ（空なら単発）"
                    onChange={(ev) => setEnding(e.id, { grantsTag: ev.target.value || undefined })}
                    aria-label="配る前提タグ"
                  />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
