import type { CardDef, CardKind, DeckNode, Scenario } from '@cartagraph/domain';
import { CARD_KIND_LABEL } from '@cartagraph/domain';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button, ErrorNote, Field, GameCard, Loading, PageHeader, Panel } from '../../components';
import { loadCardImage, removeCardImage, saveCardImage } from '../../lib/cardImageStorage';
import { useScenario, useUpdateScenario } from '../../lib/queries';
import s from '../pages.module.css';

/** 追加できるカード種別（ロケーションは専用の枠で扱うため含めない） */
const ADDABLE_KINDS: CardKind[] = ['npc', 'info', 'choice', 'enemy'];

/** 画像1枚あたりの警告しきい値（目安200KB。data URLはbase64なので概算） */
const IMAGE_WARN_BYTES = 200 * 1024;
const dataUrlBytes = (dataUrl: string) => Math.floor((dataUrl.length * 3) / 4);

/**
 * シーン構築画面（シナリオ製作者専用）。
 * docs/public/preview/scene-builder.html の試作をもとにReact化したもの
 * （docs/plans/2026-09-16-scene-builder.md）。
 * シーンの目的・終了条件は未決の仮ルール（docs/open-questions.md）。
 */
export function CreatorSceneEditPage() {
  const { scenarioId = '', sceneId = '' } = useParams();
  const scenario = useScenario(scenarioId);
  const update = useUpdateScenario();
  // SceneEditor は保存成功のたびに key が変わって再マウントするため、
  // 画像保存の失敗メッセージはここ（親）で持って再マウントをまたいで表示し続ける。
  const [imageSaveError, setImageSaveError] = useState<string | null>(null);

  if (scenario.isPending) return <Loading />;
  if (scenario.error) return <ErrorNote error={scenario.error} />;
  // kind !== 'scene' のノード（独立したnpc/info/enemyのプールノード、導入、結末）は
  // この画面の対象外（docs/plans/2026-09-16-scene-builder.md スコープ外）。
  // URLを直接叩いて開けないよう、シーン以外は「見つからない」扱いにする。
  const scene = scenario.data.deck.find((n) => n.id === sceneId && n.kind === 'scene');
  if (!scene) return <ErrorNote error={new Error('シーンが見つかりません')} />;

  return (
    <SceneEditor
      key={`${scenario.data.updatedAt}-${scene.id}`}
      sc={scenario.data}
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
        const deck = scenario.data.deck.map((n) => (n.id === nextScene.id ? nextScene : n));
        update.mutate({ id: scenarioId, patch: { deck } });
      }}
      saving={update.isPending}
      error={update.error}
    />
  );
}

function SceneEditor({
  sc,
  scene,
  save,
  saving,
  error,
  imageSaveError,
}: {
  sc: Scenario;
  scene: DeckNode;
  save: (n: DeckNode) => void;
  saving: boolean;
  error: unknown;
  imageSaveError: string | null;
}) {
  const [draft, setDraft] = useState<DeckNode>(scene);
  const [dirty, setDirty] = useState(false);
  useEffect(() => setDirty(JSON.stringify(draft) !== JSON.stringify(scene)), [draft, scene]);

  const [nameError, setNameError] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardKind, setNewCardKind] = useState<CardKind>('npc');
  const [editingLocation, setEditingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
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

  const confirmLocation = () => {
    const name = newLocationName.trim();
    if (!name) return;
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
    setEditingLocation(false);
    setNewLocationName('');
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
        actions={
          <Button disabled={!dirty || saving} onClick={onSave}>
            {saving ? '保存中…' : '保存'}
          </Button>
        }
      />
      {error ? <ErrorNote error={error} /> : null}
      <div className={s.twoCol}>
        <aside className="u-stack">
          <Panel title="シーン情報">
            <div className={s.form}>
              <Field label="シーン名">
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setField('name', e.target.value)}
                />
              </Field>
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
                「目的」「終了条件」は未決の仮ルール（docs/open-questions.md）。正式な仕様として決着したものではない。
              </p>
            </div>
          </Panel>
          <Panel title="ロケーション" sub="1シーン1ロケーションを想定した暫定分類">
            {location ? (
              <GameCard
                card={{
                  ...location,
                  portraitUrl: location.portraitUrl ?? loadCardImage(location.id),
                }}
                portrait
              />
            ) : (
              <p className="u-small u-dim">ロケーションは未設定</p>
            )}
            {location && loadCardImage(location.id) && !location.portraitUrl && (
              <p className="u-small u-dim">保存済みの画像を表示中</p>
            )}
            {editingLocation ? (
              <div className={s.form}>
                <Field label="新しいロケーション名">
                  <input
                    type="text"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                  />
                </Field>
                <div className="u-row">
                  <Button size="sm" onClick={confirmLocation}>
                    確定
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingLocation(false)}>
                    キャンセル
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNewLocationName(location?.name ?? '');
                  setEditingLocation(true);
                }}
              >
                {location ? '差し替え' : 'ロケーションを設定'}
              </Button>
            )}
          </Panel>
        </aside>
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
      </div>
    </>
  );
}
