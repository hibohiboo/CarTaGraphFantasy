import { walk } from '@cartagraph/domain/scenario/deck';
import {
  addEnding as addEndingPair,
  referrerMessage,
  removeNode as removeDeckNode,
  removeEnding as removeEndingPair,
  unusedId,
} from '@cartagraph/domain/scenario/edit';
import type {
  DeckNode,
  EndingDef,
  Scenario,
  ScenarioType,
} from '@cartagraph/domain/scenario/model';
import {
  editableSceneNodes,
  publishErrors,
  publishWarnings,
} from '@cartagraph/domain/scenario/readiness';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  useCopyScenario,
  usePublishScenario,
  useUnpublishScenario,
  useUpdateScenarioDraft,
} from '@/entities/scenario/api/mutations';
import { useEditableScenario } from '@/entities/scenario/api/queries';
import type {
  ScenarioDraftView,
  ScenarioFileResult,
  ScenarioPublication,
  ScenarioSaveResult,
} from '@/entities/scenario/api/types';
import { CopiedFromLine } from '@/entities/scenario/ui/CopiedFromLine';
import { DeckTree } from '@/entities/scenario/ui/DeckTree';
import { ScenarioFileNote } from '@/entities/scenario/ui/ScenarioFileNote';
import { ScenarioPublicationPill } from '@/entities/scenario/ui/ScenarioPublicationPill';
import { UNSAVED_CONFIRM_MESSAGE, useUnsavedGuard } from '@/shared/lib/useUnsavedGuard';
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
} from '@/shared/ui/ui';
import { creationSteps } from '../lib/steps';
import { CreationSteps } from './CreationSteps';
import { MetadataFold } from './MetadataFold';
import { NodeNameLink, PublishCheck } from './PublishCheck';

/** 保存・公開・非公開の後の知らせ（保存は下書きだけなのでファイルの結果を持たない） */
type Outcome = { scenarioId: string; saved?: true; file?: ScenarioFileResult; error?: unknown };

/**
 * シナリオ編集：メタデータ・デッキ構造・結末タグ（scenario-manage.html を編集可能にしたもの）。
 * 製作者は下書きを読み書きし、公開・公開し直す・非公開で公開版を変える。製作者でない人には公開版を読み取り専用で見せる
 * （docs/cartagraph/scenario-flow.md「シナリオの公開」、docs/plans/2026-10-11-シナリオの下書きのAPI.md G4）
 */
export function CreatorScenarioEditPage() {
  const { scenarioId = '' } = useParams();
  const source = useEditableScenario(scenarioId);
  const update = useUpdateScenarioDraft();
  const publish = usePublishScenario();
  const unpublish = useUnpublishScenario();
  const copy = useCopyScenario();
  const navigate = useNavigate();
  // 知らせと誤りはページ側に持つ（Editor は保存のたびに key={updatedAt} で作り直されるので、中に置くと消える）
  // 操作を始めたら前の知らせを消す。別のシナリオへ移ったら出さない（ページのコンポーネントは使い回される）
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // 「公開の前に決めること」の開閉もページ側に持つ（保存で Editor が作り直されても開いたままにする）
  const [metaOpen, setMetaOpen] = useState(false);
  const run = <R,>(
    mutate: (callbacks: { onSuccess: (r: R) => void; onError: (error: unknown) => void }) => void,
    done: (r: R) => Outcome,
  ) => {
    setOutcome(null);
    mutate({
      onSuccess: (r) => setOutcome(done(r)),
      onError: (error) => setOutcome({ scenarioId, error }),
    });
  };
  const shown = outcome?.scenarioId === scenarioId ? outcome : null;
  // 公開版をコピーして、そのコピーのシナリオ編集へ移る（一覧を読み直した後に移る。useCopyScenario）
  // onFail：コピーに失敗したとき（確かめ済みの移動の許可を取り消す。useUnsavedGuard）
  // 続けて押されても1件だけ作る（押した直後はまだ再描画されず、ボタンが押せなくなっていないため ref で止める）
  const copying = useRef(false);
  const copyScenario = (onFail?: () => void) => {
    if (copying.current) return;
    copying.current = true;
    run<ScenarioDraftView>(
      (cb) =>
        copy.mutate(scenarioId, {
          onError: (error) => {
            cb.onError(error);
            onFail?.();
          },
          onSuccess: (v) => navigate(`/creator/scenarios/${v.draft.id}`),
          onSettled: () => {
            copying.current = false;
          },
        }),
      () => ({ scenarioId }),
    );
  };

  if (source.status === 'pending') return <Loading />;
  if (source.status === 'error') return <ErrorNote error={source.error} />;
  if (source.status === 'readOnly') {
    const { sc } = source;
    return (
      <Editor
        key={sc.updatedAt}
        sc={sc}
        readOnly
        publication={sc.libraryStatus === 'published' ? 'listed' : 'unlisted'}
        changed={false}
        metaOpen={metaOpen}
        setMetaOpen={setMetaOpen}
        save={() => undefined}
        setPublished={() => undefined}
        copyScenario={copyScenario}
        saving={copy.isPending}
        note={
          <>
            {shown?.error ? <ErrorNote error={shown.error} /> : null}
            <EmptyNote>製作者でないため編集できません（公開版を表示しています）。</EmptyNote>
          </>
        }
      />
    );
  }
  const { view } = source;
  return (
    <Editor
      key={view.draft.updatedAt}
      sc={view.draft}
      readOnly={false}
      publication={view.publication}
      changed={view.changed}
      metaOpen={metaOpen}
      setMetaOpen={setMetaOpen}
      save={(patch) =>
        run(
          (cb) => update.mutate({ id: scenarioId, patch }, cb),
          () => ({ scenarioId, saved: true }),
        )
      }
      setPublished={(toPublish) =>
        run<ScenarioSaveResult>(
          (cb) => (toPublish ? publish : unpublish).mutate(scenarioId, cb),
          (r) => ({ scenarioId, file: r.file }),
        )
      }
      copyScenario={copyScenario}
      saving={update.isPending || publish.isPending || unpublish.isPending || copy.isPending}
      note={
        <>
          {shown?.error ? <ErrorNote error={shown.error} /> : null}
          {shown?.saved ? <EmptyNote>下書きを保存しました。</EmptyNote> : null}
          <ScenarioFileNote file={shown?.file} />
        </>
      }
    />
  );
}

/** 保存と、公開の状態に合わせた公開・公開し直す・非公開のボタン。編集中に押すと保存前の内容で公開されるので、保存してからにする */
function PublishActions({
  publication,
  changed,
  dirty,
  blocked,
  saving,
  save,
  setPublished,
}: {
  publication: ScenarioPublication;
  changed: boolean;
  dirty: boolean;
  /** 公開の前の確かめに誤りがある（公開・公開し直すを押せなくする。保存・非公開は押せる） */
  blocked: boolean;
  saving: boolean;
  save: () => void;
  setPublished: (published: boolean) => void;
}) {
  const listed = publication === 'listed';
  const action = (label: string, published: boolean) => (
    <Button
      variant="ghost"
      disabled={dirty || saving || (published && blocked)}
      onClick={() => setPublished(published)}
    >
      {label}
    </Button>
  );
  return (
    <>
      <Button disabled={!dirty || saving} onClick={save}>
        {saving ? '保存中…' : '保存'}
      </Button>
      {listed ? null : action('シナリオ集へ公開', true)}
      {listed && changed ? action('公開し直す', true) : null}
      {listed ? action('非公開にする', false) : null}
    </>
  );
}

/** 下書きが公開版に届いていないことの注意（下書きはファイルに書かないので、リロードで消える。D5） */
function DraftNotes({
  publication,
  changed,
}: {
  publication: ScenarioPublication;
  changed: boolean;
}) {
  return (
    <>
      {changed ? <EmptyNote>保存した変更は、公開し直すまで GM・PL に届きません。</EmptyNote> : null}
      {publication === 'none' || changed ? (
        <EmptyNote>公開していない編集は、リロードで消えます。</EmptyNote>
      ) : null}
    </>
  );
}

/**
 * 保存していない編集があるときの移動の確かめと、「コピーして編集」の確かめ。
 * コピーされるのは公開版で未保存の編集は消えるので、コピーを作る前に確かめ、認めたらその後の移動は止めない
 */
function useCopyWithConfirm(dirty: boolean, copyScenario: (onFail?: () => void) => void) {
  const { allowNextNavigation } = useUnsavedGuard(dirty);
  return () => {
    if (!dirty) return copyScenario();
    if (!window.confirm(UNSAVED_CONFIRM_MESSAGE)) return;
    copyScenario(allowNextNavigation());
  };
}

function Editor({
  sc,
  readOnly,
  publication,
  changed,
  metaOpen,
  setMetaOpen,
  save,
  setPublished,
  copyScenario,
  saving,
  note,
}: {
  sc: Scenario;
  /** 製作者でない人に公開版を見せるとき。入力と操作を押せなくする */
  readOnly: boolean;
  publication: ScenarioPublication;
  changed: boolean;
  /** 「公開の前に決めること」が開いているか（読み取り専用では常に開く） */
  metaOpen: boolean;
  setMetaOpen: (open: boolean) => void;
  save: (p: Partial<Scenario>) => void;
  setPublished: (published: boolean) => void;
  /** 公開版をコピーして自分の下書きにする（公開版があるときだけ出す。未保存の編集があっても押せる） */
  copyScenario: (onFail?: () => void) => void;
  saving: boolean;
  note: ReactNode;
}) {
  const [draft, setDraft] = useState<Scenario>(sc);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(sc), [draft, sc]);
  const copyWithConfirm = useCopyWithConfirm(dirty, copyScenario);
  const metaRef = useRef<HTMLDetailsElement>(null);
  // 公開の前の確かめと案内の段は、編集中の値で判定する（保存しないまま足したシーンも数える）
  const errors = useMemo(() => publishErrors(draft), [draft]);
  const warnings = useMemo(() => publishWarnings(draft), [draft]);
  const steps = useMemo(() => creationSteps(draft, publication), [draft, publication]);

  const set = <K extends keyof Scenario>(k: K, v: Scenario[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  // 「戦闘なし」なら空間モデルを持たない（docs/cartagraph/scenario-type.md）。付けたときに外す
  const toggleType = (flag: keyof ScenarioType) =>
    setDraft((d) => {
      const scenarioType = { ...d.scenarioType, [flag]: !d.scenarioType[flag] };
      return { ...d, scenarioType, ...(scenarioType.noCombat && { spaceModel: null }) };
    });

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
      // 通常進行（省いた状態）に戻すときはキーごと消す（dense: false が残ると、公開版と違う変更ありのままになる）
      draft.deck.map((n) => {
        if (n.id !== id) return n;
        if (n.dense) {
          const { dense: _, ...light } = n;
          return light;
        }
        return { ...n, dense: true };
      }),
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
  // 確かめの注意のノード：保存済みで開けるならシーン編集へのリンク、保存前に足した開けるノードは「保存すると編集できる」、入れ子は名前だけ
  const savedEditableIds = new Set(editableSceneNodes(sc.deck).map((n) => n.id));
  const draftEditableIds = new Set(editableSceneNodes(draft.deck).map((n) => n.id));
  const nodeLink = (node: DeckNode) => {
    const state = savedEditableIds.has(node.id)
      ? 'editable'
      : draftEditableIds.has(node.id)
        ? 'unsaved'
        : 'nested';
    return <NodeNameLink scenarioId={sc.id} node={node} state={state} />;
  };
  const openDecide = () => {
    setMetaOpen(true);
    metaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const guide =
    readOnly || publication !== 'none' ? null : (
      <CreationSteps steps={steps} onOpenDecide={openDecide} />
    );
  const check = readOnly ? null : (
    <PublishCheck errors={errors} warnings={warnings} nodeLink={nodeLink} />
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
            <ScenarioPublicationPill publication={publication} changed={changed} />
            {publication === 'none' ? null : (
              <Button variant="ghost" disabled={saving} onClick={copyWithConfirm}>
                コピーして編集
              </Button>
            )}
            {readOnly ? null : (
              <PublishActions
                publication={publication}
                changed={changed}
                dirty={dirty}
                blocked={errors.length > 0}
                saving={saving}
                save={() => save(draft)}
                setPublished={setPublished}
              />
            )}
          </>
        }
      />
      {sc.copiedFrom ? (
        <CopiedFromLine
          copiedFrom={sc.copiedFrom}
          renderLink={(id, label) => <Link to={`/creator/scenarios/${id}`}>{label}</Link>}
        />
      ) : null}
      {dirty ? <EmptyNote>保存してから公開・非公開にできます。</EmptyNote> : null}
      {readOnly ? null : <DraftNotes publication={publication} changed={changed} />}
      {note}
      <fieldset disabled={readOnly} className={s.plainFieldset}>
        <div className="u-stack">
          <Field label="タイトル">
            <input type="text" value={draft.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          {guide}
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
                      {n.dense ? '通常進行に' : 'じっくり進行に'}
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

          {check}
          <MetadataFold
            draft={draft}
            open={readOnly || metaOpen}
            onToggle={(open) => {
              if (!readOnly) setMetaOpen(open);
            }}
            foldRef={metaRef}
            set={set}
            toggleType={toggleType}
          />
        </div>
      </fieldset>
    </>
  );
}
