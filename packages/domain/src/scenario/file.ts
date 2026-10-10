// scenarios/<id>.json の1ファイルを読み、検査してシナリオにする（docs/plans/2026-10-03-シナリオのJSON管理.md）。
// 形（scenarioSchema）・ファイル名と id の一致・参照の整合（findScenarioRefErrors）・
// シナリオタイプと中身の食い違い（findScenarioTypeErrors）を確かめ、
// 誤りがあればファイルのパスを含めて例外を投げる。apps/web（MSW）とシミュレーションのスクリプトが使う。
// 公開でファイルへ書き込む前にも、同じ検査を例外ではなく結果で返す safeParseScenarioFile を、
// MSW と開発サーバーの口（apps/web/vite/）の両方が使う（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）。

import { z } from 'zod';
import type { Scenario } from './model';
import { scenarioSchema } from './model';
import { findScenarioRefErrors, findSystemCardRefErrors } from './refs';
import { findScenarioTypeErrors } from './type';

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
  // 参照の誤りとシナリオタイプの食い違いは、一度に報告する（直して出し直す二度手間を避ける）
  const sections = [
    ['参照に誤りがある', findScenarioRefErrors(scenario)],
    ['シナリオタイプと中身が食い違っている', findScenarioTypeErrors(scenario)],
  ] as const;
  const message = sections
    .filter(([, errors]) => errors.length > 0)
    .map(([title, errors]) => `${path} の${title}:\n${errors.map((e) => `- ${e}`).join('\n')}`)
    .join('\n');
  if (message) return { ok: false, message };
  return { ok: true, scenario };
}

export function parseScenarioFile(path: string, raw: unknown): Scenario {
  const result = safeParseScenarioFile(path, raw);
  if (!result.ok) throw new Error(result.message);
  return result.scenario;
}

/**
 * 遊べるシナリオのファイル群（パス → 中身）を読み、id 順で返す。parseScenarioFile の検査に加え、
 * システムのカード一覧への参照（findSystemCardRefErrors）も確かめ、誤りはファイルのパスつきの例外にする
 * （apps/web/src/mocks/scenarioFiles.ts が起動時に使う。docs/plans/2026-10-10-ルールとカードプールのJSON管理.md E6）
 */
export function loadScenarioFiles(
  files: Record<string, unknown>,
  systemCardIds: string[],
): Scenario[] {
  return Object.entries(files)
    .map(([path, raw]) => {
      const scenario = parseScenarioFile(path, raw);
      const errors = findSystemCardRefErrors(scenario, systemCardIds);
      if (errors.length > 0) {
        throw new Error(
          `${path} のシステムのカードの参照に誤りがある:\n${errors.map((e) => `- ${e}`).join('\n')}`,
        );
      }
      return scenario;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
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
