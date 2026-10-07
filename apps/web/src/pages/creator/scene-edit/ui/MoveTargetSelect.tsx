import type { CardDef } from '@cartagraph/domain/card/model';
import { walk } from '@cartagraph/domain/scenario/deck';
import type { MoveTarget } from '@cartagraph/domain/scenario/edit';
import type { DeckNode } from '@cartagraph/domain/scenario/model';

/**
 * 選択肢カードの移り先（docs/plans/2026-10-07-選択肢の移り先と結末の編集.md D5）。
 * いまの移り先が候補に無いときは、それを選択肢に足して表示する（選び直さずに保存しても黙って消さない）。
 * デッキに無ければ「見つからない」、デッキにはあるが候補外（導入・自分自身など）なら「候補外」
 */
export function MoveTargetSelect({
  card,
  deck,
  targets,
  onChange,
}: {
  card: CardDef;
  deck: DeckNode[];
  targets: MoveTarget[];
  onChange: (card: CardDef) => void;
}) {
  const current = card.nextNodeId;
  const extra =
    current && !targets.some((t) => t.id === current)
      ? {
          id: current,
          label: (() => {
            const node = walk(deck).find((n) => n.id === current);
            return node ? `（候補外：${node.name}）` : `（見つからない：${current}）`;
          })(),
        }
      : null;
  return (
    <label className="u-small">
      移り先{' '}
      <select
        aria-label="移り先"
        value={current ?? ''}
        onChange={(e) => {
          // 「移り先なし」はキーごと消す（空文字を残すと参照の検査に落ちる）
          const { nextNodeId: _, ...rest } = card;
          onChange(e.target.value ? { ...rest, nextNodeId: e.target.value } : rest);
        }}
      >
        <option value="">移り先なし</option>
        {extra && <option value={extra.id}>{extra.label}</option>}
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}
