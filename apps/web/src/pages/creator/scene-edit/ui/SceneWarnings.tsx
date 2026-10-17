import type { NodeWarningKind } from '../lib/sceneCheck';

const WARNING_TEXT: Record<NodeWarningKind, string> = {
  deadEnd: 'GM 不在で遊ぶと、ここで先へ進めません（先へ進む選択肢がありません）',
  unreachable: 'GM 不在で遊ぶと、導入から届きません（どの選択肢からもつながっていません）',
};

/**
 * このシーンの注意（公開を止めない。シナリオ編集の「公開の前の確かめ」と同じ判定）。
 * role="alert" にしない（保存の失敗の知らせと取り違えないため）
 */
export function SceneWarnings({ kinds }: { kinds: NodeWarningKind[] }) {
  if (kinds.length === 0) return null;
  return (
    <section aria-label="このシーンの注意">
      <ul style={{ margin: 0 }}>
        {kinds.map((k) => (
          <li key={k}>{WARNING_TEXT[k]}</li>
        ))}
      </ul>
      <p className="u-small u-dim">注意があっても公開はできます。</p>
    </section>
  );
}
