import type { DeckNode } from '@cartagraph/domain/scenario/model';
import { Link } from 'react-router';
import { Panel } from '@/shared/ui/ui';
import type { SceneLinkTargets } from '../lib/sceneCheck';

/**
 * このシーン・結末のノードのつながり：選択肢の移り先、ここへ来るシーン、デッキの並びの前・次
 * （docs/plans/2026-10-17-シナリオ製作の導線.md D10・G5）。開けるノードはそのシーン編集へのリンク、入れ子のノードは名前だけ。
 * 製作者でない人にも出す（読むときにも辿りたい）
 */
export function SceneLinks({ scenarioId, links }: { scenarioId: string; links: SceneLinkTargets }) {
  const nodeLink = (n: DeckNode) =>
    links.editableIds.has(n.id) ? (
      <Link to={`/creator/scenarios/${scenarioId}/scenes/${n.id}`}>{n.name}</Link>
    ) : (
      n.name
    );
  const list = (nodes: DeckNode[]) =>
    nodes.length === 0 ? (
      'なし'
    ) : (
      <ul style={{ margin: 0 }}>
        {nodes.map((n) => (
          <li key={n.id}>{nodeLink(n)}</li>
        ))}
      </ul>
    );
  return (
    <Panel title="つながり" sub="このシーンから進む先と、このシーンへ来るシーン">
      <dl style={{ margin: 0 }}>
        <dt className="u-small u-dim">選択肢の移り先</dt>
        <dd style={{ margin: '0 0 8px' }}>{list(links.targets)}</dd>
        <dt className="u-small u-dim">ここへ来るシーン</dt>
        <dd style={{ margin: '0 0 8px' }}>{list(links.referrers)}</dd>
        <dt className="u-small u-dim">デッキの並びの前</dt>
        <dd style={{ margin: '0 0 8px' }}>{list(links.prev ? [links.prev] : [])}</dd>
        <dt className="u-small u-dim">デッキの並びの次</dt>
        <dd style={{ margin: 0 }}>{list(links.next ? [links.next] : [])}</dd>
      </dl>
    </Panel>
  );
}
