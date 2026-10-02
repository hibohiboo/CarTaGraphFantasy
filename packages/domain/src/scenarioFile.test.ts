// scenarios/<id>.json の1ファイルを読む（docs/plans/2026-10-03-シナリオのJSON管理.md）。
// パスは import.meta.glob が返すキーの形（apps/web/src/mocks/scenarioFiles.ts）で試す。

import { describe, expect, it } from 'vitest';
import { parseScenarioFile } from './scenarioFile';

const PATH = '../../../../scenarios/sc-x.json';

const raw = (o: Record<string, unknown> = {}) => ({
  id: 'sc-x',
  title: 't',
  authorId: 'u',
  authorName: 'n',
  summary: '',
  referenceTags: [],
  prerequisiteTags: [],
  partySize: { min: 1, max: 1 },
  spaceModel: null,
  recommendedCp: 0,
  baseCp: 0,
  proposalHandling: 'auto-resolve',
  deck: [{ id: 'a', kind: 'intro', name: '導入', cards: [] }],
  endings: [],
  libraryStatus: 'draft',
  updatedAt: '2026-10-03T00:00:00.000Z',
  ...o,
});

describe('parseScenarioFile', () => {
  it('ファイル名と id が一致すれば Scenario を返す', () => {
    expect(parseScenarioFile(PATH, raw())).toEqual(raw());
  });

  it('Windows の区切り（シミュレーションのスクリプトが渡す絶対パス）でも、ファイル名を id と比べる', () => {
    expect(parseScenarioFile('D:\\repo\\scenarios\\sc-x.json', raw()).id).toBe('sc-x');
    expect(() => parseScenarioFile('D:\\repo\\scenarios\\sc-y.json', raw())).toThrow(/sc-y\.json/);
  });

  it('ファイル名と id が食い違うと、パスを含む例外を投げる', () => {
    expect(() => parseScenarioFile(PATH, raw({ id: 'sc-y' }))).toThrow(
      /scenarios\/sc-x\.json.*sc-y/s,
    );
  });

  it('形の誤った中身なら、パスと誤りの内容を含む例外を投げる', () => {
    expect(() => parseScenarioFile(PATH, raw({ proposalHandling: 'x' }))).toThrow(
      /scenarios\/sc-x\.json.*proposalHandling/s,
    );
  });

  it('参照の整合が崩れていると、パスと誤りの内容を含む例外を投げる', () => {
    const broken = raw({
      deck: [
        {
          id: 'a',
          kind: 'intro',
          name: '導入',
          cards: [{ id: 'lost', kind: 'choice', name: '迷う', tags: [], nextNodeId: 'nowhere' }],
        },
      ],
    });
    expect(() => parseScenarioFile(PATH, broken)).toThrow(/scenarios\/sc-x\.json.*nowhere/s);
  });
});
