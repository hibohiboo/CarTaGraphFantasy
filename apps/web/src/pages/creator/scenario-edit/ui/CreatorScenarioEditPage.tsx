import { walk } from '@cartagraph/domain/scenario/deck';
import {
  addEnding as addEndingPair,
  referrerMessage,
  removeNode as removeDeckNode,
  removeEnding as removeEndingPair,
  unusedId,
} from '@cartagraph/domain/scenario/edit';
import type { DeckNode, EndingDef, Scenario } from '@cartagraph/domain/scenario/model';
import { type ReactNode, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  usePublishScenario,
  useUnpublishScenario,
  useUpdateScenario,
} from '@/entities/scenario/api/mutations';
import { useScenario } from '@/entities/scenario/api/queries';
import type { ScenarioFileResult, ScenarioSaveResult } from '@/entities/scenario/api/types';
import { DeckTree } from '@/entities/scenario/ui/DeckTree';
import { ScenarioFileNote } from '@/entities/scenario/ui/ScenarioFileNote';
import s from '@/shared/ui/page.module.css';
import {
  Button,
  EmptyNote,
  ErrorNote,
  Field,
  Loading,
  PageHeader,
  Panel,
  RoleBadge,
  StatusPill,
} from '@/shared/ui/ui';

const REFERENCE_TAGS = ['体・技・心を参照', 'HPを参照', '戦闘スキルを参照'];

/** シナリオ編集：メタデータ・デッキ構造・結末タグ（scenario-manage.html を編集可能にしたもの） */
export function CreatorScenarioEditPage() {
  const { scenarioId = '' } = useParams();
  const scenario = useScenario(scenarioId);
  const update = useUpdateScenario();
  const publish = usePublishScenario();
  const unpublish = useUnpublishScenario();
  // 知らせと誤りはページ側に持つ（Editor は保存のたびに key={updatedAt} で作り直されるので、中に置くと消える）
  // 操作を始めたら前の知らせを消す。別のシナリオへ移ったら出さない（ページのコンポーネントは使い回される）
  const [outcome, setOutcome] = useState<{
    scenarioId: string;
    file?: ScenarioFileResult;
    error?: unknown;
  } | null>(null);
  const run = (
    mutate: (callbacks: {
      onSuccess: (r: ScenarioSaveResult) => void;
      onError: (error: unknown) => void;
    }) => void,
  ) => {
    setOutcome(null);
    mutate({
      onSuccess: (r) => setOutcome({ scenarioId, file: r.file }),
      onError: (error) => setOutcome({ scenarioId, error }),
    });
  };
  const shown = outcome?.scenarioId === scenarioId ? outcome : null;

  if (scenario.isPending) return <Loading />;
  if (scenario.error) return <ErrorNote error={scenario.error} />;
  return (
    <Editor
      key={scenario.data.updatedAt}
      sc={scenario.data}
      save={(patch) => run((cb) => update.mutate({ id: scenarioId, patch }, cb))}
      setPublished={(published) =>
        run((cb) => (published ? publish : unpublish).mutate(scenarioId, cb))
      }
      saving={update.isPending || publish.isPending || unpublish.isPending}
      note={
        <>
          {shown?.error ? <ErrorNote error={shown.error} /> : null}
          <ScenarioFileNote file={shown?.file} />
        </>
      }
    />
  );
}

function Editor({
  sc,
  save,
  setPublished,
  saving,
  note,
}: {
  sc: Scenario;
  save: (p: Partial<Scenario>) => void;
  setPublished: (published: boolean) => void;
  saving: boolean;
  note: ReactNode;
}) {
  const [draft, setDraft] = useState<Scenario>(sc);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(sc), [draft, sc]);

  const set = <K extends keyof Scenario>(k: K, v: Scenario[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  const toggleTag = (t: string) =>
    set(
      'referenceTags',
      draft.referenceTags.includes(t)
        ? draft.referenceTags.filter((x) => x !== t)
        : [...draft.referenceTags, t],
    );

  // 移り先として指されているノード・結末を消そうとしたときの理由（docs/plans/2026-10-07-選択肢の移り先と結末の編集.md D1・D2）
  const [deckBlocked, setDeckBlocked] = useState<string | null>(null);
  const [endingBlocked, setEndingBlocked] = useState<string | null>(null);
  // 同じ時刻に続けて押しても id が重ならないように（unusedId）
  const freshNodeId = (d: Scenario) => {
    const taken = new Set(walk(d.deck).map((n) => n.id));
    return unusedId(`d-${Date.now()}`, (id) => taken.has(id));
  };

  const addScene = () => {
    const scenes = draft.deck.filter((n) => n.kind === 'scene').length;
    const node: DeckNode = {
      id: freshNodeId(draft),
      kind: 'scene',
      name: `${scenes + 1} 新しいシーン`,
      cards: [],
    };
    const endingIdx = draft.deck.findIndex((n) => n.kind === 'ending');
    const deck = [...draft.deck];
    deck.splice(endingIdx < 0 ? deck.length : endingIdx, 0, node);
    set('deck', deck);
  };
  const removeNode = (id: string) => {
    const r = removeDeckNode(draft.deck, id);
    if (!r.ok) {
      setDeckBlocked(referrerMessage(r.referrers));
      setEndingBlocked(null);
      return;
    }
    setDeckBlocked(null);
    setEndingBlocked(null);
    set('deck', r.deck);
  };
  const toggleDense = (id: string) =>
    set(
      'deck',
      draft.deck.map((n) => (n.id === id ? { ...n, dense: !n.dense } : n)),
    );
  // 結末と、それを指す結末のノードを対で足す・消す（D6・D2）
  const addEnding = () =>
    setDraft((d) => {
      const taken = new Set(d.endings.map((e) => e.id));
      return addEndingPair(d, '新しい結末', {
        endingId: unusedId(`e-${Date.now()}`, (id) => taken.has(id)),
        nodeId: freshNodeId(d),
      });
    });
  const removeEnding = (id: string) => {
    const r = removeEndingPair(draft, id);
    if (!r.ok) {
      setEndingBlocked(referrerMessage(r.referrers));
      setDeckBlocked(null);
      return;
    }
    setEndingBlocked(null);
    setDeckBlocked(null);
    setDraft(r.scenario);
  };
  const setEnding = (id: string, patch: Partial<EndingDef>) =>
    set(
      'endings',
      draft.endings.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );

  // シーン編集は保存済みのシナリオから開くので、まだ保存していないノードには「編集」を出さない
  // （押すと「シーンが見つかりません」になり、編集中の下書きも消えるため）
  const savedNodeIds = new Set(walk(sc.deck).map((n) => n.id));
  const editLink = (n: DeckNode) =>
    savedNodeIds.has(n.id) ? (
      <Link to={`/creator/scenarios/${sc.id}/scenes/${n.id}`}>編集</Link>
    ) : (
      <span className="u-small u-dim">保存すると編集できる</span>
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
            <RoleBadge badgeRole="creator">シナリオ製作者</RoleBadge>
            <StatusPill status={sc.libraryStatus === 'published' ? 'approved' : 'neutral'}>
              {sc.libraryStatus === 'published' ? 'シナリオ集に公開中' : '下書き'}
            </StatusPill>
            <Button disabled={!dirty || saving} onClick={() => save(draft)}>
              {saving ? '保存中…' : '保存'}
            </Button>
            {/* 編集中に押すと保存前の内容で公開されるので、保存してからにする */}
            <Button
              variant="ghost"
              disabled={dirty || saving}
              onClick={() => setPublished(sc.libraryStatus !== 'published')}
            >
              {sc.libraryStatus === 'published' ? '非公開にする' : 'シナリオ集へ公開'}
            </Button>
          </>
        }
      />
      {dirty ? <EmptyNote>保存してから公開・非公開にできます。</EmptyNote> : null}
      {note}
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
            sub="導入→シーン→結末の入れ子。カスタマイズはGMの仕事だが、土台となる構造・取捨選択肢はここで用意する。"
            actions={
              <Button size="sm" variant="ghost" onClick={addScene}>
                シーンを追加
              </Button>
            }
          >
            {deckBlocked ? <ErrorNote error={new Error(deckBlocked)} /> : null}
            <DeckTree
              nodes={draft.deck}
              renderActions={(n) =>
                n.kind === 'scene' ? (
                  <>
                    {editLink(n)}
                    <Button size="sm" variant="ghost" onClick={() => toggleDense(n.id)}>
                      {n.dense ? '軽量に' : '濃密に'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeNode(n.id)}>
                      削除
                    </Button>
                  </>
                ) : n.kind === 'intro' || n.kind === 'ending' ? (
                  // 導入・結末も同じ画面で編集する（D4）。消すのは結末の枠の「削除」から
                  editLink(n)
                ) : null
              }
            />
          </Panel>
          <Panel
            title="結末"
            sub="結末は成功／失敗の2値に限らず、任意の数を定義できる。結末を追加すると、それを指す結末のノードもデッキにできる。結末タグは後続シナリオの前提タグと同じ仕組みで突き合わされる。"
            actions={
              <Button size="sm" variant="ghost" onClick={addEnding}>
                結末を追加
              </Button>
            }
          >
            {endingBlocked ? <ErrorNote error={new Error(endingBlocked)} /> : null}
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
                    placeholder="結末タグ（空なら単発）"
                    onChange={(ev) => setEnding(e.id, { grantsTag: ev.target.value || undefined })}
                    aria-label="結末タグ"
                  />
                  <Button size="sm" variant="ghost" onClick={() => removeEnding(e.id)}>
                    削除
                  </Button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
