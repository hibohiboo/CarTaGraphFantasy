// scenarios/<id>.json の1ファイルを読み、検査してシナリオにする（docs/plans/2026-10-03-シナリオのJSON管理.md）。
// 形（scenarioSchema）・ファイル名と id の一致・参照の整合（findScenarioRefErrors）を確かめ、
// 誤りがあればファイルのパスを含めて例外を投げる。apps/web（MSW）とシミュレーションのスクリプトが使う。
// 公開でファイルへ書き込む前にも、同じ検査を例外ではなく結果で返す safeParseScenarioFile を、
// MSW と開発サーバーの口（apps/web/vite/）の両方が使う（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）。

import { z } from 'zod';
import type { Scenario } from './model';
import { scenarioSchema } from './model';
import { findScenarioRefErrors } from './refs';

/** ファイルにできるシナリオの id（ファイル名になるので、リポジトリの外を指せない文字だけ） */
export const scenarioFileIdPattern = /^[a-z0-9-]+$/;

export type ScenarioFileParseResult =
  | { ok: true; scenario: Scenario }
  | { ok: false; message: string };

export function safeParseScenarioFile(path: string, raw: unknown): ScenarioFileParseResult {
  const parsed = scenarioSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: `${path} の形が誤っている:\n${z.prettifyError(parsed.error)}` };
  }
  const scenario = parsed.data;
  // glob のキー（../scenarios/x.json）と Windows の絶対パス（D:\...\x.json）の両方を受ける
  const fileId = path.replace(/^.*[\\/]/, '').replace(/\.json$/, '');
  if (scenario.id !== fileId) {
    return { ok: false, message: `${path} のファイル名と id「${scenario.id}」が食い違っている` };
  }
  if (!scenarioFileIdPattern.test(scenario.id)) {
    return {
      ok: false,
      message: `${path} の id「${scenario.id}」は、英小文字・数字・ハイフンだけにする`,
    };
  }
  const errors = findScenarioRefErrors(scenario);
  if (errors.length > 0) {
    return {
      ok: false,
      message: `${path} の参照に誤りがある:\n${errors.map((e) => `- ${e}`).join('\n')}`,
    };
  }
  return { ok: true, scenario };
}

export function parseScenarioFile(path: string, raw: unknown): Scenario {
  const result = safeParseScenarioFile(path, raw);
  if (!result.ok) throw new Error(result.message);
  return result.scenario;
}

/**
 * ファイルに書く形にする。カード画像の data URL（ブラウザの localStorage にだけ置く画像）を落とした
 * 深い複製を返す。portraitUrl はカードにだけあるキーなので、カードがどこにあっても落ちる。
 */
export function toScenarioFile(scenario: Scenario): Scenario {
  return JSON.parse(
    JSON.stringify(scenario, (key, value: unknown) =>
      key === 'portraitUrl' && typeof value === 'string' && value.startsWith('data:')
        ? undefined
        : value,
    ),
  ) as Scenario;
}
