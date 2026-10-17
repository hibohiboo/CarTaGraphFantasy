import type { Scenario } from '@cartagraph/domain/scenario/model';
import type { ReactNode } from 'react';
import { useScenarioVersion } from '../api/queries';

/**
 * コピーしたシナリオの、親への導線「〇〇（作者：△△）のコピー」（docs/cartagraph/scenario-flow.md「シナリオのコピー」）。
 * 親の題名・作者は、コピーした版のもの。読み込み中と、読めない（親の版が 404・通信失敗）ときは、名前が取れないので1行ごと出さない。
 * リンク先は、ルートを知るページが渡す（entities はルートを知らない）
 */
export function CopiedFromLine({
  copiedFrom,
  renderLink,
}: {
  copiedFrom: NonNullable<Scenario['copiedFrom']>;
  renderLink: (scenarioId: string, label: string) => ReactNode;
}) {
  const parent = useScenarioVersion(copiedFrom.scenarioId, copiedFrom.version);
  if (!parent.data) return null;
  const label = `${parent.data.title}（作者：${parent.data.authorName}）`;
  return (
    <p className="u-small" data-testid="copied-from">
      {renderLink(copiedFrom.scenarioId, label)}のコピー
    </p>
  );
}
