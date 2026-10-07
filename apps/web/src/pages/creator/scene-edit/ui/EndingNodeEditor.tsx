import type { DeckNode, Scenario } from '@cartagraph/domain/scenario/model';
import { type ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router';
import s from '@/shared/ui/page.module.css';
import { Button, ErrorNote, Field, PageHeader, Panel } from '@/shared/ui/ui';

/**
 * 結末のノードの編集：名前と「指す結末」だけ（docs/plans/2026-10-07-選択肢の移り先と結末の編集.md D4）。
 * GM 不在のセッションでは結末のノードへ進むと終わる。カードの編集は C2 のスコープ外で、既にあるカードは保存しても残す
 */
export function EndingNodeEditor({
  sc,
  node,
  save,
  saving,
  error,
  fileNote,
}: {
  sc: Scenario;
  node: DeckNode;
  save: (n: DeckNode) => void;
  saving: boolean;
  error: unknown;
  fileNote: ReactNode;
}) {
  const [draft, setDraft] = useState<DeckNode>(node);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(node), [draft, node]);

  return (
    <>
      <PageHeader
        title={draft.name || '（無題の結末のノード）'}
        crumb={
          <>
            {sc.title} ／ <Link to={`/creator/scenarios/${sc.id}`}>シナリオ編集へ戻る</Link>
          </>
        }
        actions={
          <Button disabled={!dirty || saving} onClick={() => save(draft)}>
            {saving ? '保存中…' : '保存'}
          </Button>
        }
      />
      {error ? <ErrorNote error={error} /> : null}
      {fileNote}
      <Panel
        title="結末のノードの情報"
        sub="GM 不在のセッションでは、このノードへ進むと終わる。指す結末に結末タグがあれば、ドライバーのキャラクターにすぐ付く（GM 不在のソロの仮ルール）。"
      >
        <div className={s.form}>
          <Field label="結末のノードの名前">
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </Field>
          <Field label="指す結末">
            <select
              value={draft.endingId ?? ''}
              onChange={(e) => {
                // 「指さない」はキーごと消す（空文字を残すと参照の検査に落ちる）
                const endingId = e.target.value;
                setDraft(({ endingId: _, ...rest }) => (endingId ? { ...rest, endingId } : rest));
              }}
            >
              <option value="">指さない</option>
              {/* 結末に無い id（手で直した JSON など）は「指さない」に見せず、そのまま出す（MoveTargetSelect と同じ） */}
              {draft.endingId && !sc.endings.some((e) => e.id === draft.endingId) && (
                <option value={draft.endingId}>（見つからない：{draft.endingId}）</option>
              )}
              {sc.endings.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Panel>
    </>
  );
}
