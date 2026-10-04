// 再挑戦不可（docs/cartagraph/scenario-flow.md「連作・キャンペーンの表現：結末タグ」、unlock.md「強制力」の正式な例外）。
// 通常の募集への応募・GM による開始・GM 不在の募集からの開始の、どの始め方でも止める。

import type { Character } from '../character/model';
import type { EndingDef, Scenario } from './model';

/**
 * PC がこのシナリオをもう一度遊べないなら、その理由の結末を返す（遊べるなら null）。
 * 結末タグの文字列で判定するので、別のシナリオが同じ結末タグを配っていても止まる（仕様の「結末タグを持つPC」どおり）
 */
export function replayBlockedBy(
  scenario: Pick<Scenario, 'endings'>,
  character: Pick<Character, 'endingTags'>,
): EndingDef | null {
  return (
    scenario.endings.find(
      (e) => e.noReplay && e.grantsTag && character.endingTags.includes(e.grantsTag),
    ) ?? null
  );
}

export const replayBlockedMessage = (characterName: string, ending: Pick<EndingDef, 'name'>) =>
  `${characterName}はこのシナリオの結末「${ending.name}」に至っているため、もう一度は遊べません`;
