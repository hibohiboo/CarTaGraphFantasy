import { DECK_NODE_LABEL, type DeckNode } from '@cartagraph/domain';
import type { ReactNode } from 'react';
import s from './DeckTree.module.css';

/** シナリオデッキの入れ子構造（導入→シーン→エンディング）を1列で表示する */
export function DeckTree({
  nodes,
  currentId,
  excludedIds,
  renderActions,
}: {
  nodes: DeckNode[];
  currentId?: string;
  excludedIds?: Set<string>;
  renderActions?: (node: DeckNode) => ReactNode;
}) {
  return (
    <div className={s.tree}>
      {nodes.map((n) => (
        <div
          key={n.id}
          className={s.node}
          data-kind={n.kind}
          data-nested={n.kind !== 'intro' && n.kind !== 'ending' ? 'true' : undefined}
          data-current={n.id === currentId ? 'true' : undefined}
          data-excluded={excludedIds?.has(n.id) ? 'true' : undefined}
        >
          <span className={s.kind}>{DECK_NODE_LABEL[n.kind]}</span>
          <span className={s.name}>{n.name}</span>
          <span className={s.meta}>
            {n.dense && <span className={s.dense}>濃密</span>}
            {n.cards.length > 0 && <span>{n.cards.length}枚</span>}
            {n.id === currentId && <span>進行中</span>}
            {renderActions && <span className={s.nodeActions}>{renderActions(n)}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
