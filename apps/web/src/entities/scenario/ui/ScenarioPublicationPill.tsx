import { StatusPill } from '@/shared/ui/ui';
import type { ScenarioPublication } from '../api/types';

/**
 * シナリオの公開の状態の言葉（docs/plans/2026-10-11-シナリオの下書きのAPI.md G4）。「未公開」「非公開」は仕様の別の意味
 * （カードの未公開情報・冒険記の公開範囲）とぶつかるので、状態の表示には使わない
 */
export const PUBLICATION_LABEL: Record<ScenarioPublication, string> = {
  none: '下書きのみ',
  listed: 'シナリオ集に公開中',
  unlisted: 'シナリオ集から外している',
};

/** 公開の状態と、公開版と違う変更があるか */
export function ScenarioPublicationPill({
  publication,
  changed,
}: {
  publication: ScenarioPublication;
  changed: boolean;
}) {
  return (
    <span className="u-row">
      <StatusPill status={publication === 'listed' ? 'approved' : 'neutral'}>
        {PUBLICATION_LABEL[publication]}
      </StatusPill>
      {changed ? <StatusPill status="warn">公開版と違う変更あり</StatusPill> : null}
    </span>
  );
}
