// scenarios/<id>.json の1ファイルを読む（docs/plans/2026-10-03-シナリオのJSON管理.md）。
// パスは import.meta.glob が返すキーの形（apps/web/src/mocks/scenarioFiles.ts）で試す。

import { describe, expect, it } from 'vitest';
import {
  parseScenarioFile,
  safeParseScenarioFile,
  scenarioFileIdPattern,
  toScenarioFile,
} from './file';

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

// 公開で書き込む前の検査（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）。
// safeParseScenarioFile へ書き直しても、例外の文が変わらないことを完全一致で固定する。
describe('parseScenarioFile の誤りの文', () => {
  it('形の誤り', () => {
    expect(() => parseScenarioFile(PATH, raw({ proposalHandling: 'x' }))).toThrow(
      new Error(
        `${PATH} の形が誤っている:\n✖ Invalid option: expected one of "gm-required"|"disabled"|"auto-resolve"\n  → at proposalHandling`,
      ),
    );
  });

  it('ファイル名と id の食い違い', () => {
    expect(() => parseScenarioFile(PATH, raw({ id: 'sc-y' }))).toThrow(
      new Error(`${PATH} のファイル名と id「sc-y」が食い違っている`),
    );
  });

  it('参照の誤り', () => {
    expect(() => parseScenarioFile(PATH, brokenRef())).toThrow(
      new Error(
        `${PATH} の参照に誤りがある:\n- カード「lost」の nextNodeId「nowhere」のノードが無い`,
      ),
    );
  });
});

const brokenRef = () =>
  raw({
    deck: [
      {
        id: 'a',
        kind: 'intro',
        name: '導入',
        cards: [{ id: 'lost', kind: 'choice', name: '迷う', tags: [], nextNodeId: 'nowhere' }],
      },
    ],
  });

describe('safeParseScenarioFile', () => {
  it('通るシナリオは ok と検査済みのシナリオを返す', () => {
    expect(safeParseScenarioFile(PATH, raw())).toEqual({ ok: true, scenario: raw() });
  });

  it.each([
    ['形の誤り', raw({ proposalHandling: 'x' })],
    ['ファイル名と id の食い違い', raw({ id: 'sc-y' })],
    ['参照の誤り', brokenRef()],
  ])('%s は、parseScenarioFile の例外と同じ文を返す', (_, r) => {
    let thrown = '';
    try {
      parseScenarioFile(PATH, r);
    } catch (e) {
      thrown = (e as Error).message;
    }
    expect(thrown).not.toBe('');
    expect(safeParseScenarioFile(PATH, r)).toEqual({ ok: false, message: thrown });
  });

  it.each([null, 'x', 1])('中身が %j でも例外を投げず、誤りを返す', (r) => {
    expect(safeParseScenarioFile(PATH, r).ok).toBe(false);
  });

  it.each(['sc-1001', 'sc-corridor-after'])('id「%s」はファイルにできる', (id) => {
    expect(safeParseScenarioFile(`scenarios/${id}.json`, raw({ id })).ok).toBe(true);
  });

  it.each(['Sc-x', 'sc_x', '.', '..'])(
    'id「%s」はファイル名と一致していても、ファイルにできない',
    (id) => {
      const r = safeParseScenarioFile(`scenarios/${id}.json`, raw({ id }));
      expect(r).toEqual({ ok: false, message: expect.stringContaining(`id「${id}」`) });
    },
  );

  it('scenarioFileIdPattern は英小文字・数字・ハイフンだけを許す', () => {
    expect(scenarioFileIdPattern.test('sc-1001')).toBe(true);
    expect(scenarioFileIdPattern.test('../x')).toBe(false);
    expect(scenarioFileIdPattern.test('')).toBe(false);
  });
});

describe('toScenarioFile', () => {
  const img = 'data:image/png;base64,AAAA';
  const card = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    kind: 'skill',
    name: id,
    tags: [],
    portraitUrl: img,
    ...extra,
  });
  const withImages = () =>
    parseScenarioFile(
      PATH,
      raw({
        soloStarter: { hp: 10, baseActionValue: 10, cards: [card('starter')] },
        deck: [
          {
            id: 'a',
            kind: 'intro',
            name: '導入',
            cards: [
              card('top'),
              card('shop', {
                soloEffect: {
                  gainCards: [card('gained', { soloEffect: { achievement: card('deep') } })],
                },
              }),
            ],
            children: [
              {
                id: 'b',
                kind: 'scene',
                name: '子',
                cards: [],
                children: [{ id: 'c', kind: 'scene', name: '孫', cards: [card('grandchild')] }],
              },
            ],
          },
        ],
      }),
    );

  it('どこにあるカードでも、data: の portraitUrl を落とす', () => {
    const out = toScenarioFile(withImages());
    const intro = out.deck[0];
    expect(out.soloStarter?.cards[0]).not.toHaveProperty('portraitUrl');
    expect(intro?.cards[0]).not.toHaveProperty('portraitUrl');
    expect(intro?.cards[1]).not.toHaveProperty('portraitUrl');
    const gained = intro?.cards[1]?.soloEffect?.gainCards?.[0];
    expect(gained).not.toHaveProperty('portraitUrl');
    expect(gained?.soloEffect?.achievement).not.toHaveProperty('portraitUrl');
    expect(intro?.children?.[0]?.children?.[0]?.cards[0]).not.toHaveProperty('portraitUrl');
    expect(JSON.stringify(out)).not.toContain('data:');
  });

  it.each(['/images/a.png', 'https://x/data:a', ''])('data: 以外の「%s」は残す', (url) => {
    const s = parseScenarioFile(
      PATH,
      raw({
        deck: [{ id: 'a', kind: 'intro', name: '導入', cards: [card('x', { portraitUrl: url })] }],
      }),
    );
    expect(toScenarioFile(s).deck[0]?.cards[0]?.portraitUrl).toBe(url);
  });

  it('引数のシナリオは書き換えない', () => {
    const s = withImages();
    toScenarioFile(s);
    expect(s.deck[0]?.cards[0]?.portraitUrl).toBe(img);
  });
});
