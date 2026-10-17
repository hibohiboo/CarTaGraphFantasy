import type { Scenario } from '@cartagraph/domain/scenario/model';
import { scenarioTypeLabel } from '@cartagraph/domain/scenario/type';

const SPACE_LABEL = { '1d': '1次元', '2d': '2次元' } as const;

/**
 * 「公開の前に決めること」を畳んだときに見せる、今の値の1行の要約
 * （例：冒険・2〜4人・推奨CP 3・空間なし。docs/plans/2026-10-17-シナリオ製作の導線.md G3）
 */
export function scenarioSummaryLine(sc: Scenario): string {
  const { min, max } = sc.partySize;
  const parts = [
    scenarioTypeLabel(sc.scenarioType),
    min === max ? `${min}人` : `${min}〜${max}人`,
    `推奨CP ${sc.recommendedCp}`,
    sc.spaceModel ? `空間${SPACE_LABEL[sc.spaceModel]}` : '空間なし',
  ];
  if (sc.prerequisiteTags.length > 0) parts.push(`前提タグ ${sc.prerequisiteTags.length}件`);
  if (sc.summary.trim() === '') parts.push('概要が未記入');
  return parts.join('・');
}
