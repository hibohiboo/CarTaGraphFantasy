// 基本操作8「次のシーンへ進む」（docs/cartagraph/play-and-field.md）の遷移計算。
// セッションを書き換えず、遷移後の状態だけを返す（Functional Core）。適用は呼び出し側（MSW ハンドラ等）が行う。

import {
  type AutoCombatEnemy,
  type CardDef,
  type DeckNode,
  type Scenario,
  type Session,
  SYSTEM_GM_ID,
} from './index';

/** シナリオデッキを入れ子まで探す。path は最上位の祖先から見つかったノードまで */
export function findDeckNode(
  deck: DeckNode[],
  id: string,
): { node: DeckNode; topIndex: number; path: DeckNode[] } | null {
  const search = (nodes: DeckNode[], ancestors: DeckNode[]): DeckNode[] | null => {
    for (const n of nodes) {
      const path = [...ancestors, n];
      if (n.id === id) return path;
      const found = n.children && search(n.children, path);
      if (found) return found;
    }
    return null;
  };
  const path = search(deck, []);
  if (!path) return null;
  return { node: path[path.length - 1], topIndex: deck.indexOf(path[0]), path };
}

export type TransitionPlan =
  | { ok: false; error: string }
  | {
      ok: true;
      currentScene: Session['currentScene'];
      /** 手札に配り直す選択肢カード。自動戦闘のノードでは空（勝利後に配る） */
      choices: CardDef[];
      /** 移り先が自動戦闘のノードなら、その相手と上限 */
      autoCombat?: { enemy: AutoCombatEnemy; maxRounds: number };
      /** 人間GMのいないセッションで結末ノードへ移ったら true */
      ended: boolean;
    };

export function planTransition(
  scenario: Pick<Scenario, 'deck'>,
  session: Pick<Session, 'gmId'>,
  nextNodeId: string,
): TransitionPlan {
  const found = findDeckNode(scenario.deck, nextNodeId);
  if (!found) return { ok: false, error: `移り先のシーン（${nextNodeId}）がシナリオにありません` };
  const { node, topIndex, path } = found;
  // 自動戦闘はGM不在のソロプレイ限定（docs/cartagraph/auto-combat.md）。人間GMのセッションでは入らない
  if (node.autoCombat && session.gmId !== SYSTEM_GM_ID)
    return {
      ok: false,
      error: `「${node.name}」は自動戦闘のシーンのため、人間GMのセッションでは進めません`,
    };
  return {
    ok: true,
    currentScene: {
      index: topIndex,
      total: scenario.deck.length,
      name: node.name,
      path: path.map((n) => n.name).join(' › '),
      nodeId: node.id,
    },
    choices: node.autoCombat ? [] : node.cards.filter((c) => c.kind === 'choice'),
    ...(node.autoCombat && { autoCombat: node.autoCombat }),
    // 結末で自動終了するのは人間GMのいないセッションだけ（play-and-field.md「次のシーンへ進む」）
    ended: node.kind === 'ending' && session.gmId === SYSTEM_GM_ID,
  };
}
