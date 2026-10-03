// scenarios/<id>.json の1ファイルを読み、検査してシナリオにする（docs/plans/2026-10-03-シナリオのJSON管理.md）。
// 形（scenarioSchema）・ファイル名と id の一致・参照の整合（findScenarioRefErrors）を確かめ、
// 誤りがあればファイルのパスを含めて例外を投げる。apps/web（MSW）とシミュレーションのスクリプトが使う。

import { z } from 'zod';
import type { Scenario } from './model';
import { scenarioSchema } from './model';
import { findScenarioRefErrors } from './refs';

export function parseScenarioFile(path: string, raw: unknown): Scenario {
  const parsed = scenarioSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`${path} の形が誤っている:\n${z.prettifyError(parsed.error)}`);
  }
  const scenario = parsed.data;
  // glob のキー（../scenarios/x.json）と Windows の絶対パス（D:\...\x.json）の両方を受ける
  const fileId = path.replace(/^.*[\\/]/, '').replace(/\.json$/, '');
  if (scenario.id !== fileId) {
    throw new Error(`${path} のファイル名と id「${scenario.id}」が食い違っている`);
  }
  const errors = findScenarioRefErrors(scenario);
  if (errors.length > 0) {
    throw new Error(`${path} の参照に誤りがある:\n${errors.map((e) => `- ${e}`).join('\n')}`);
  }
  return scenario;
}
