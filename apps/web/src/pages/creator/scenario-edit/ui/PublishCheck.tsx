import type { ScenarioErrorSection } from '@cartagraph/domain/scenario/file';
import type { DeckNode } from '@cartagraph/domain/scenario/model';
import type { PublishWarning } from '@cartagraph/domain/scenario/readiness';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import s from '@/shared/ui/page.module.css';

const WARNING_TEXT = {
  deadEnd: 'GM 不在で遊ぶと、ここで先へ進めません',
  unreachable: 'GM 不在で遊ぶと、導入から届きません',
} as const;

/**
 * 公開の前の確かめ：公開を止める誤りと、止めない注意（docs/plans/2026-10-17-シナリオ製作の導線.md D3・D4、G3）。
 * 注意は role="alert" にしない（保存・公開の失敗の知らせと取り違えないため）
 */
export function PublishCheck({
  errors,
  warnings,
  nodeLink,
}: {
  errors: ScenarioErrorSection[];
  warnings: PublishWarning[];
  /** 注意のノードの名前（開けるノードならシーン編集へのリンク、保存前なら「保存すると編集できる」） */
  nodeLink: (node: DeckNode) => ReactNode;
}) {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <section aria-label="公開の前の確かめ" className={s.check}>
        <p>公開の前の確かめ：問題はありません</p>
      </section>
    );
  }
  return (
    <section aria-label="公開の前の確かめ" className={s.check}>
      <h2 className={s.checkTitle}>公開の前の確かめ</h2>
      {errors.length > 0 ? (
        <div data-section="errors">
          <h3 className={s.checkSub}>公開できない理由</h3>
          {errors.map(({ title, errors: lines }) => (
            <div key={title}>
              <p className="u-small">{title}</p>
              <ul>
                {lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div data-section="warnings">
          <h3 className={s.checkSub}>注意（公開はできます）</h3>
          <ul>
            {warnings.map((w) =>
              w.kind === 'noSummary' ? (
                <li key="noSummary">
                  概要が未記入です（GM がシナリオを選ぶときの紹介文になります）
                </li>
              ) : (
                <li key={`${w.kind}-${w.node.id}`}>
                  {nodeLink(w.node)}：{WARNING_TEXT[w.kind]}
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** 注意のノードの名前を、開けるノードならシーン編集へのリンクにする */
export function NodeNameLink({
  scenarioId,
  node,
  state,
}: {
  scenarioId: string;
  node: DeckNode;
  /** editable：保存済みで開ける／unsaved：保存前に足した開けるノード／nested：入れ子・プール用で開けない */
  state: 'editable' | 'unsaved' | 'nested';
}) {
  if (state === 'editable')
    return <Link to={`/creator/scenarios/${scenarioId}/scenes/${node.id}`}>{node.name}</Link>;
  return (
    <>
      {node.name}
      {state === 'unsaved' ? <span className="u-small u-dim">（保存すると編集できる）</span> : null}
    </>
  );
}
