// 再挑戦不可（docs/cartagraph/scenario-flow.md「連作・キャンペーンの表現：結末タグ」、unlock.md「強制力」の正式な例外）。
// 通常の募集への応募・GM による開始・GM 不在の募集からの開始の、どの始め方でも止める。

import type { EndingCardInfo } from '../card/model';
import type { Character } from '../character/model';

/**
 * PC がこのシナリオをもう一度遊べないなら、その理由の結末（結末タグのカードが持つ値）を返す（遊べるなら null）。
 * 決めるのは PC が持つ結末タグのカードだけ。シナリオの結末の再挑戦不可は見ない
 * （得たときの版の値が続き、後から付け外ししても既に得たカードには及ばない）
 */
export function replayBlockedBy(
  scenarioId: string,
  character: Pick<Character, 'deck'>,
): EndingCardInfo | null {
  for (const card of character.deck) {
    if (card.ending?.scenarioId === scenarioId && card.ending.noReplay) return card.ending;
  }
  return null;
}

export const replayBlockedMessage = (
  characterName: string,
  ending: Pick<EndingCardInfo, 'endingName'>,
) =>
  `${characterName}はこのシナリオの結末「${ending.endingName}」に至っているため、もう一度は遊べません`;
