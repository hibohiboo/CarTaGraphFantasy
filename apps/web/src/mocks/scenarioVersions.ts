// シナリオの版の履歴（docs/plans/2026-10-14-セッションの独立.md G4）。公開・公開し直すたびに新しい版を残し、
// 版の中身は後から変えない。募集とセッションは版番号を持ち、ここから引く。
// 純粋な関数だけを置く（履歴の置き場 db は handlers.ts が持つ）。

import type { Scenario } from '@cartagraph/domain/scenario/model';

/** シナリオ id ごとの版の履歴。添字 i が版 i+1 */
export type ScenarioVersions = Record<string, Scenario[]>;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** キーの順によらない JSON（下書きと公開版・版を比べるため） */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

/** libraryStatus・updatedAt を除いた中身（版が増えるかどうかの比べ方。下書きの変更ありと同じ） */
export const contentOf = ({ libraryStatus: _, updatedAt: __, ...rest }: Scenario) => rest;

/** いちばん新しい版の番号（公開したことが無ければ 0） */
export const latestVersion = (versions: ScenarioVersions, id: string): number =>
  versions[id]?.length ?? 0;

/** その版（無ければ undefined）。版番号は1以上の整数 */
export const versionOf = (
  versions: ScenarioVersions,
  id: string,
  version: number,
): Scenario | undefined => (Number.isInteger(version) ? versions[id]?.[version - 1] : undefined);

/** 次に公開するシナリオが、いちばん新しい版と違う（新しい版が要る）か。履歴が無ければ要る */
export function needsNewVersion(versions: ScenarioVersions, next: Scenario): boolean {
  const latest = versions[next.id]?.at(-1);
  return !latest || canonical(contentOf(latest)) !== canonical(contentOf(next));
}

/** 新しい版を足す（公開した時点の深い写し）。足した版番号を返す */
export function appendVersion(versions: ScenarioVersions, scenario: Scenario): number {
  const list = versions[scenario.id] ?? [];
  versions[scenario.id] = [...list, clone(scenario)];
  return list.length + 1;
}

/** 公開版のあるシナリオを版1にした履歴（シード） */
export function seedVersions(published: Scenario[]): ScenarioVersions {
  const versions: ScenarioVersions = {};
  for (const s of published) appendVersion(versions, s);
  return versions;
}

/** `:version` を版番号として読む（先頭に0を付けない正の整数だけ。`01`・`1e0`・`+1`・`1.5`・`0`・`-1` は読めない） */
export function parseVersion(raw: unknown): number | null {
  return typeof raw === 'string' && /^[1-9][0-9]*$/.test(raw) ? Number(raw) : null;
}
