// シナリオのコピー（docs/plans/2026-10-14-シナリオのコピー.md G4、docs/cartagraph/scenario-flow.md「シナリオのコピー」）。
// 純粋な関数だけを置く（下書きの置き場 db は handlers.ts が持つ）。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import type { ScenarioDraft } from '@cartagraph/schemas/scenarios/response';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

type CopyOptions = {
  /** コピー元の版番号（`copiedFrom.version`） */
  version: number;
  me: { id: string; name: string };
  /** コピーの id */
  id: string;
  now: string;
};

/**
 * 公開版（source）を、自分の下書きとしてコピーする。題名以外は深く写し（`$comment`・画像・結末タグも）、
 * id・作者・題名（「〇〇のコピー」）・状態・更新日時・親だけを差し替える。元が親を持っていても写さず、
 * 直接の親（source 自身）を持つ。source は書き換えない
 */
export function copyOf(source: Scenario, { version, me, id, now }: CopyOptions): ScenarioDraft {
  return {
    ...clone(source),
    id,
    authorId: me.id,
    authorName: me.name,
    title: `${source.title}のコピー`,
    libraryStatus: 'draft',
    updatedAt: now,
    copiedFrom: { scenarioId: source.id, version },
  };
}
