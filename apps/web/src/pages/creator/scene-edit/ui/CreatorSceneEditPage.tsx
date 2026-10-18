import type { CardDef, CardKind } from '@cartagraph/domain/card/model';
import { CARD_KIND_LABEL } from '@cartagraph/domain/card/model';
import { moveTargets } from '@cartagraph/domain/scenario/edit';
import type { DeckNode, Scenario } from '@cartagraph/domain/scenario/model';
import { editableSceneNodes } from '@cartagraph/domain/scenario/readiness';
import { type ReactNode, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useUpdateScenarioDraft } from '@/entities/scenario/api/mutations';
import { useEditableScenario } from '@/entities/scenario/api/queries';
import type { ScenarioDraftView } from '@/entities/scenario/api/types';
import { useUnsavedGuard } from '@/shared/lib/useUnsavedGuard';
import s from '@/shared/ui/page.module.css';
import { Button, EmptyNote, ErrorNote, Field, Loading, PageHeader, Panel } from '@/shared/ui/ui';
import { loadCardImage, removeCardImage, saveCardImage } from '../api/cardImageStorage';
import { nodeWarnings, sceneLinkTargets } from '../lib/sceneCheck';
import { EndingNodeEditor } from './EndingNodeEditor';
import { LocationPanel } from './LocationPanel';
import { MoveTargetSelect } from './MoveTargetSelect';
import { SaveButton } from './SaveButton';
import { SceneLinks } from './SceneLinks';
import { SceneWarnings } from './SceneWarnings';

/** 追加できるカード種別（ロケーションは専用の枠で扱うため含めない） */
const ADDABLE_KINDS: CardKind[] = ['npc', 'info', 'choice', 'enemy'];

/** 画像1枚あたりの警告しきい値（目安200KB。data URLはbase64なので概算） */
const IMAGE_WARN_BYTES = 200 * 1024;
const dataUrlBytes = (dataUrl: string) => Math.floor((dataUrl.length * 3) / 4);

/**
 * シーン構築画面（シナリオ製作者専用）。
 * 試作HTML scene-builder.html をもとにReact化したもの（試作は削除済みで git 履歴にある）
 * （docs/plans/2026-09-16-scene-builder.md）。
 * シーンの目的・終了条件は未決の仮ルール（docs/provisional/scene-objective.md）。
 * 導入も同じ画面で編集する（目的・終了条件は出さない）。結末は EndingNodeEditor
 * （docs/plans/2026-10-07-選択肢の移り先と結末の編集.md）。
 * 製作者は下書きを読み書きする（公開はシナリオ編集から）。製作者でない人には公開版を読み取り専用で見せる
 * （docs/plans/2026-10-11-シナリオの下書きのAPI.md G4）。
 */
/** 下書きを保存した知らせ・公開していない編集が消える注意・製作者でない人への案内 */
function SceneNotes({
  notAuthor,
  saved,
  view,
}: {
  notAuthor: boolean;
  saved: boolean;
  view: ScenarioDraftView | null;
}) {
  if (notAuthor)
    return <EmptyNote>製作者でないため編集できません（公開版を表示しています）。</EmptyNote>;
  return (
    <>
      {saved ? <EmptyNote>下書きを保存しました。</EmptyNote> : null}
      {view && (view.publication === 'none' || view.changed) ? (
        <EmptyNote>
          公開していない編集は、リロードで消えます。公開・公開し直すのはシナリオ編集の画面から。
        </EmptyNote>
      ) : null}
    </>
  );
}

export function CreatorSceneEditPage() {
  const { scenarioId = '', sceneId = '' } = useParams();
  const source = useEditableScenario(scenarioId);
  const update = useUpdateScenarioDraft();
  // SceneEditor は保存成功のたびに key が変わって再マウントするため、
  // 画像保存の失敗メッセージはここ（親）で持って再マウントをまたいで表示し続ける。
  const [imageSaveError, setImageSaveError] = useState<string | null>(null);
  // 保存したシナリオとシーン。別のシーンへ移ったら（ページのコンポーネントは使い回される）「保存しました」を出さない
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // 補足の開閉（null は既定：製作者は閉じて、読み取り専用は開いて始める）
  const [supplementOpen, setSupplementOpen] = useState<boolean | null>(null);
  const here = `${scenarioId}/${sceneId}`;

  if (source.status === 'error') return <ErrorNote error={source.error} />;
  if (source.status === 'pending') return <Loading />;
  const { sc } = source;
  const notAuthor = source.status === 'readOnly';
  const view = source.status === 'own' ? source.view : null;
  // プール用のノード（独立した npc/info/enemy）は、URL を直接叩いても開けないよう「見つからない」扱いにする
  const scene = editableSceneNodes(sc.deck).find((n) => n.id === sceneId);
  if (!scene) return <ErrorNote error={new Error('シーンが見つかりません')} />;

  const saveNode = (next: DeckNode) => {
    setSavedAt(null);
    update.mutate(
      { id: scenarioId, patch: { deck: sc.deck.map((n) => (n.id === next.id ? next : n)) } },
      { onSuccess: () => setSavedAt(here) },
    );
  };
  // 知らせはこの親に持つので、保存のたびの再マウントをまたいで残る
  const notes = <SceneNotes notAuthor={notAuthor} saved={savedAt === here} view={view} />;

  return (
    <fieldset disabled={notAuthor} className={s.plainFieldset}>
      {scene.kind === 'ending' ? (
        <EndingNodeEditor
          key={`${sc.updatedAt}-${scene.id}`}
          sc={sc}
          node={scene}
          save={saveNode}
          saving={update.isPending}
          error={update.error}
          notes={notes}
          readOnly={notAuthor}
        />
      ) : (
        <SceneEditor
          key={`${sc.updatedAt}-${scene.id}`}
          sc={sc}
          scene={scene}
          imageSaveError={imageSaveError}
          save={(nextScene) => {
            // 仮の画像URL（data URL）は、保存のタイミングで初めて localStorage へ書き込む
            // （アップロードしただけでは書き込まない。docs/plans/2026-09-16-scene-builder.md 決定7）。
            // localStorageは容量上限（QuotaExceededError等）を超えることがあるため、失敗しても
            // シナリオ本体の保存（update.mutate）は必ず実行する。
            setImageSaveError(null);
            for (const c of nextScene.cards) {
              if (!c.portraitUrl) continue;
              try {
                saveCardImage(c.id, c.portraitUrl);
              } catch {
                setImageSaveError(
                  '画像の保存に失敗しました（容量が大きすぎる可能性があります）。他の変更は保存されます。',
                );
              }
            }
            saveNode(nextScene);
          }}
          saving={update.isPending}
          error={update.error}
          notes={notes}
          readOnly={notAuthor}
          supplementOpen={supplementOpen ?? notAuthor}
          onSupplementToggle={setSupplementOpen}
        />
      )}
    </fieldset>
  );
}

function SceneEditor({
  sc,
  scene,
  save,
  saving,
  error,
  notes,
  readOnly,
  imageSaveError,
  supplementOpen,
  onSupplementToggle,
}: {
  sc: Scenario;
  scene: DeckNode;
  save: (n: DeckNode) => void;
  saving: boolean;
  error: unknown;
  notes: ReactNode;
  /** 製作者でない人に公開版を見せるとき。保存のボタンを出さない */
  readOnly: boolean;
  imageSaveError: string | null;
  /** 補足（ロケーション・目的・終了条件）の開閉。保存で作り直されても開いたままにするため親が持つ */
  supplementOpen: boolean;
  onSupplementToggle: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<DeckNode>(scene);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(scene), [draft, scene]);
  useUnsavedGuard(dirty);
  const warnings = useMemo(() => nodeWarnings(sc, draft), [sc, draft]);
  const links = useMemo(() => sceneLinkTargets(sc.deck, draft), [sc.deck, draft]);

  const [nameError, setNameError] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardKind, setNewCardKind] = useState<CardKind>('npc');
  const [imageError, setImageError] = useState<string | null>(null);
  const nextId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const openAddCard = () => {
    setNewCardName('');
    setNewCardKind('npc');
    setNameError(null);
    setAddingCard(true);
  };
  const cancelAddCard = () => {
    setAddingCard(false);
    setNewCardName('');
    setNameError(null);
  };

  const setField = <K extends keyof DeckNode>(k: K, v: DeckNode[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const location = draft.cards.find((c) => c.kind === 'location');
  const otherCards = draft.cards.filter((c) => c.kind !== 'location');

  const confirmLocation = (name: string) => {
    const oldId = location?.id;
    const nextLocation: CardDef = location
      ? { ...location, name }
      : { id: nextId('loc'), kind: 'location', name, tags: [] };
    // 差し替え（新しいidで作り直す）でも、名前だけの編集（同じidのまま）でも動くよう、
    // idが変わった場合だけ古い画像を掃除する
    if (oldId && oldId !== nextLocation.id) removeCardImage(oldId);
    setField(
      'cards',
      draft.cards.some((c) => c.kind === 'location')
        ? draft.cards.map((c) => (c.kind === 'location' ? nextLocation : c))
        : [nextLocation, ...draft.cards],
    );
  };

  const confirmAddCard = () => {
    const name = newCardName.trim();
    if (!name) {
      setNameError('名前を入力してください');
      return;
    }
    const card: CardDef = { id: nextId('c'), kind: newCardKind, name, tags: [] };
    setField('cards', [...draft.cards, card]);
    cancelAddCard();
  };

  const isIntro = scene.kind === 'intro';
  const targets = useMemo(() => moveTargets(sc.deck, scene.id), [sc.deck, scene.id]);
  const replaceCard = (next: CardDef) =>
    setField(
      'cards',
      draft.cards.map((c) => (c.id === next.id ? next : c)),
    );
  const updateCard = (id: string, patch: Partial<CardDef>) =>
    setField(
      'cards',
      draft.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  const removeCard = (id: string) => {
    removeCardImage(id);
    setField(
      'cards',
      draft.cards.filter((c) => c.id !== id),
    );
  };
  const onImageSelected = (card: CardDef, file: File) => {
    setImageError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') updateCard(card.id, { portraitUrl: reader.result });
    };
    reader.onerror = () => setImageError(`「${card.name}」の画像を読み込めませんでした`);
    reader.readAsDataURL(file);
  };

  const onSave = () => save(draft);

  return (
    <>
      <PageHeader
        title={draft.name || '（無題のシーン）'}
        crumb={
          <>
            {sc.title} ／ <Link to={`/creator/scenarios/${sc.id}`}>シナリオ編集へ戻る</Link>
          </>
        }
        actions={<SaveButton readOnly={readOnly} dirty={dirty} saving={saving} onSave={onSave} />}
      />
      {error ? <ErrorNote error={error} /> : null}
      {notes}
      <div className="u-stack">
        <Panel title={isIntro ? '導入の情報' : 'シーン情報'}>
          <div className={s.form}>
            <Field label={isIntro ? '導入の名前' : 'シーン名'}>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            </Field>
          </div>
        </Panel>
        {readOnly ? null : <SceneWarnings kinds={warnings} />}
        <div className="u-stack">
          <Panel
            title="配置されているカード"
            sub="NPC・情報・イベント・エネミーカードをこのシーンに置く"
            actions={
              <Button size="sm" variant="ghost" onClick={openAddCard}>
                ＋カードを追加
              </Button>
            }
          >
            {imageError && (
              <p className="u-small" style={{ color: 'var(--rejected)' }}>
                {imageError}
              </p>
            )}
            {imageSaveError && (
              <p className="u-small" style={{ color: 'var(--rejected)' }}>
                {imageSaveError}
              </p>
            )}
            {addingCard && (
              <div className={s.form}>
                <Field label="新しいカードの名前">
                  <input
                    type="text"
                    value={newCardName}
                    onChange={(e) => {
                      setNewCardName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                  />
                </Field>
                <Field label="種別">
                  <select
                    value={newCardKind}
                    onChange={(e) => setNewCardKind(e.target.value as CardKind)}
                  >
                    {ADDABLE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {CARD_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </Field>
                {nameError && (
                  <p className="u-small" style={{ color: 'var(--rejected)' }}>
                    {nameError}
                  </p>
                )}
                <div className="u-row">
                  <Button size="sm" onClick={confirmAddCard}>
                    追加
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelAddCard}>
                    キャンセル
                  </Button>
                </div>
              </div>
            )}
            {otherCards.length === 0 && !addingCard && (
              <p className="u-small u-dim">まだカードがありません</p>
            )}
            <ul className={s.list} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {otherCards.map((c) => {
                const zone = c.zone ?? 'pl';
                const fallbackImage = !c.portraitUrl ? loadCardImage(c.id) : undefined;
                const bytes = c.portraitUrl ? dataUrlBytes(c.portraitUrl) : 0;
                return (
                  <li key={c.id} className={s.listItem} data-card-row data-card-id={c.id}>
                    <div className={s.itemLeft}>
                      <span className={s.itemSub}>{CARD_KIND_LABEL[c.kind]}</span>
                      <span>{c.name}</span>
                      {c.faceDown && <span className={s.itemSub}>（裏）</span>}
                    </div>
                    <span
                      className={s.metaRow}
                      style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateCard(c.id, { zone: zone === 'gm' ? 'pl' : 'gm' })}
                      >
                        ゾーン：{zone === 'gm' ? 'GM専用' : 'PL可視'}
                      </Button>
                      {/* エネミーカードは常に公開＋状態タグで表現し、裏表は使わない
                          （docs/cartagraph/card-face-back.md） */}
                      {c.kind !== 'enemy' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateCard(c.id, { faceDown: !c.faceDown })}
                        >
                          {c.faceDown ? '表にする' : '裏にする'}
                        </Button>
                      )}
                      {c.kind === 'choice' && (
                        <MoveTargetSelect
                          card={c}
                          deck={sc.deck}
                          targets={targets}
                          onChange={replaceCard}
                        />
                      )}
                      <label className="u-small">
                        画像を選択
                        <input
                          type="file"
                          accept="image/*"
                          aria-label="画像を選択"
                          style={{ display: 'block' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onImageSelected(c, file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {dirty && c.portraitUrl && (
                        <span className="u-small u-dim">画像を設定済み（未保存）</span>
                      )}
                      {bytes > IMAGE_WARN_BYTES && (
                        <span className="u-small" style={{ color: 'var(--pending)' }}>
                          画像サイズが大きめです
                        </span>
                      )}
                      {fallbackImage && (
                        <span className="u-small u-dim">保存済みの画像を表示中</span>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => removeCard(c.id)}>
                        削除
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
        <SceneLinks scenarioId={sc.id} links={links} />
        <details
          className={s.foldPanel}
          open={supplementOpen}
          onToggle={(e) => onSupplementToggle(e.currentTarget.open)}
        >
          <summary className={s.foldSummary}>
            <h2 className="u-inline" style={{ display: 'inline', fontSize: '1rem' }}>
              補足
            </h2>
            <span className={s.foldLine}>
              {isIntro ? 'ロケーション' : 'ロケーション・目的（仮）・終了条件（仮）'}
            </span>
          </summary>
          <div className={`${s.foldBody} u-stack`}>
            {!isIntro && (
              <div className={s.form}>
                <Field label="目的（仮）">
                  <textarea
                    value={draft.objective ?? ''}
                    onChange={(e) => setField('objective', e.target.value)}
                    placeholder="このシーンでPLに何をさせたいか"
                  />
                </Field>
                <Field label="終了条件（仮）">
                  <textarea
                    value={draft.endCondition ?? ''}
                    onChange={(e) => setField('endCondition', e.target.value)}
                    placeholder="GMがこのシーンを終えて次へ進む目安"
                  />
                </Field>
                <p className="u-small u-dim">
                  「目的」「終了条件」は未決の仮ルール（docs/provisional/scene-objective.md）。正式な仕様として決着したものではない。
                </p>
              </div>
            )}
            <LocationPanel location={location} onConfirm={confirmLocation} />
          </div>
        </details>
      </div>
    </>
  );
}
